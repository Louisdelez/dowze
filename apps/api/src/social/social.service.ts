import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, inArray, ne, or } from 'drizzle-orm';
import type {
  ChatMessage,
  ConversationSummary,
  ConversationView,
  SendMessageInput,
  SocialOverview,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  blocks,
  conversationParticipants,
  conversations,
  friendships,
  chatMessages,
  guardians,
  profiles,
  supervisionItems,
  userReports,
  validationSubjects,
} from '../db/schema';
import { XpService } from '../xp/xp.service';
import { AiModerationService } from '../ai-moderation/ai-moderation.service';
import { RealtimeService } from '../realtime/realtime.service';
import { DOWZE_BOT_PROFILE_ID } from '../common/bot';

/** Ordre canonique d'une paire d'amis (une seule ligne par paire). */
function pair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

@Injectable()
export class SocialService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly xp: XpService,
    private readonly aiModeration: AiModerationService,
    private readonly realtime: RealtimeService,
  ) {}

  private async nameOf(profileId: string): Promise<string> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    return p?.displayName ?? '';
  }

  // ---------------- Blocage (masquage bidirectionnel en MP) ----------------

  /** L'ensemble des profils masqués pour moi (que je bloque OU qui me bloquent). */
  private async blockedSet(profileId: string): Promise<Set<string>> {
    const rows = await this.db
      .select()
      .from(blocks)
      .where(or(eq(blocks.blockerId, profileId), eq(blocks.blockedId, profileId)));
    const s = new Set<string>();
    for (const r of rows) s.add(r.blockerId === profileId ? r.blockedId : r.blockerId);
    return s;
  }

  async block(profileId: string, target: string): Promise<{ ok: true }> {
    if (target === profileId) throw new BadRequestException('on ne se bloque pas soi-même');
    await this.db.insert(blocks).values({ blockerId: profileId, blockedId: target }).onConflictDoNothing();
    return { ok: true as const };
  }

  async unblock(profileId: string, target: string): Promise<{ ok: true }> {
    await this.db
      .delete(blocks)
      .where(and(eq(blocks.blockerId, profileId), eq(blocks.blockedId, target)));
    return { ok: true as const };
  }

  /** Signaler un utilisateur (avec message) → file de modération. */
  async report(
    profileId: string,
    reportedProfileId: string,
    reason: string,
    conversationId: string | null,
  ): Promise<{ ok: true }> {
    if (reportedProfileId === profileId) throw new BadRequestException('on ne se signale pas soi-même');

    // Anti-brigading : plafond de signalements par 24 h + dédoublonnage d'une cible déjà signalée.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.db
      .select()
      .from(userReports)
      .where(and(eq(userReports.reporterId, profileId), gte(userReports.createdAt, since)));
    if (recent.length >= 20) {
      throw new ForbiddenException('Trop de signalements en 24 h. Réessaie plus tard.');
    }
    // Un signalement encore ouvert contre la même personne → ne pas en recréer (évite le spam de file).
    if (recent.some((r) => r.reportedId === reportedProfileId && r.status !== 'resolved')) {
      return { ok: true as const };
    }

    await this.db.insert(userReports).values({ reporterId: profileId, reportedId: reportedProfileId, reason, conversationId });
    return { ok: true as const };
  }

  // ---------------- Mode supervisé (validation parentale) ----------------

  /** Le responsable (avec `supervised`) du compte d'un profil, s'il existe. */
  private async guardianFor(
    profileId: string,
  ): Promise<{ supervised: boolean; accountId: string } | null> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!p) return null;
    const g = (await this.db.select().from(guardians).where(eq(guardians.minorAccountId, p.accountId)))[0];
    return g ? { supervised: g.supervised, accountId: p.accountId } : null;
  }

  private async isSupervised(profileId: string): Promise<boolean> {
    return (await this.guardianFor(profileId))?.supervised ?? false;
  }

  /** Les message_ids cachés à un enfant supervisé (item entrant non encore approuvé). */
  private async heldIncomingMessageIds(profileId: string): Promise<Set<string>> {
    const items = await this.db
      .select()
      .from(supervisionItems)
      .where(
        and(
          eq(supervisionItems.childProfileId, profileId),
          eq(supervisionItems.direction, 'in'),
          eq(supervisionItems.kind, 'message'),
          ne(supervisionItems.status, 'approved'),
        ),
      );
    const s = new Set<string>();
    for (const it of items) if (it.messageId) s.add(it.messageId);
    return s;
  }

  // ---------------- Amis ----------------

  private async metaOf(profileId: string): Promise<{ name: string; tag: string | null }> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    return { name: p?.displayName ?? '', tag: p?.tag ?? null };
  }

  async overview(profileId: string): Promise<SocialOverview> {
    const rows = await this.db
      .select()
      .from(friendships)
      .where(or(eq(friendships.userLow, profileId), eq(friendships.userHigh, profileId)));
    const blocked = await this.blockedSet(profileId);
    const heldReq = await this.heldIncomingFriendTargets(profileId);

    const friends: SocialOverview['friends'] = [];
    const incoming: SocialOverview['incoming'] = [];
    const outgoing: SocialOverview['outgoing'] = [];

    for (const r of rows) {
      const other = r.userLow === profileId ? r.userHigh : r.userLow;
      if (blocked.has(other)) continue; // masquage bidirectionnel
      const meta = await this.metaOf(other);
      const base = { profileId: other, name: meta.name, tag: meta.tag, level: await this.xp.level(other) };
      if (r.status === 'accepted') friends.push({ ...base, status: 'friends' });
      else if (r.status === 'blocked') continue;
      else if (r.status === 'held_out') outgoing.push({ ...base, status: 'outgoing' }); // supervisé : en attente parent
      else if (r.requestedBy === profileId) outgoing.push({ ...base, status: 'outgoing' });
      else if (heldReq.has(other)) continue; // demande entrante cachée jusqu'à validation parentale
      else incoming.push({ ...base, status: 'incoming' });
    }
    const me = await this.metaOf(profileId);
    return { meProfileId: profileId, meName: me.name, meTag: me.tag, friends, incoming, outgoing };
  }

  /** Requérants dont la demande entrante m'est cachée (item 'in' friend_request non approuvé). */
  private async heldIncomingFriendTargets(profileId: string): Promise<Set<string>> {
    const items = await this.db
      .select()
      .from(supervisionItems)
      .where(
        and(
          eq(supervisionItems.childProfileId, profileId),
          eq(supervisionItems.direction, 'in'),
          eq(supervisionItems.kind, 'friend_request'),
          ne(supervisionItems.status, 'approved'),
        ),
      );
    const s = new Set<string>();
    for (const it of items) if (it.friendTargetId) s.add(it.friendTargetId);
    return s;
  }

  /** Envoyer une demande d'ami. */
  async request(profileId: string, target: string): Promise<SocialOverview> {
    if (target === profileId) throw new BadRequestException('on ne s’ajoute pas soi-même');
    const t = (await this.db.select().from(profiles).where(eq(profiles.id, target)))[0];
    if (!t) throw new NotFoundException('profil introuvable');
    if ((await this.blockedSet(profileId)).has(target))
      throw new ForbiddenException('utilisateur indisponible');

    const { low, high } = pair(profileId, target);
    const existing = (
      await this.db
        .select()
        .from(friendships)
        .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    )[0];

    const senderSupervised = await this.isSupervised(profileId);
    const targetSupervised = await this.isSupervised(target);

    if (!existing) {
      // Sortant supervisé → retenu (held_out) jusqu'à validation parentale.
      const status = senderSupervised ? 'held_out' : 'pending';
      await this.db.insert(friendships).values({ userLow: low, userHigh: high, requestedBy: profileId, status });
      if (senderSupervised) await this.enqueueSupervision(profileId, 'out', 'friend_request', null, target);
      // Entrant supervisé côté cible → caché à l'enfant jusqu'à validation.
      else if (targetSupervised) await this.enqueueSupervision(target, 'in', 'friend_request', null, profileId);
    } else if (existing.status === 'pending' && existing.requestedBy !== profileId) {
      await this.setStatus(low, high, 'accepted');
    }
    return this.overview(profileId);
  }

  /** Crée un item de file de validation parentale pour un enfant supervisé. */
  private async enqueueSupervision(
    childProfileId: string,
    direction: 'in' | 'out',
    kind: 'message' | 'friend_request',
    messageId: string | null,
    friendTargetId: string | null,
  ): Promise<void> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, childProfileId)))[0];
    if (!p) return;
    await this.db.insert(supervisionItems).values({
      childProfileId,
      childAccountId: p.accountId,
      direction,
      kind,
      messageId,
      friendTargetId,
    });
  }

  /** Accepter une demande reçue. */
  async accept(profileId: string, target: string): Promise<SocialOverview> {
    const { low, high } = pair(profileId, target);
    const f = await this.mustFind(low, high);
    if (f.status !== 'pending' || f.requestedBy === profileId)
      throw new BadRequestException('aucune demande à accepter');
    await this.setStatus(low, high, 'accepted');
    return this.overview(profileId);
  }

  /** Refuser une demande, ou retirer un ami : supprime la ligne. */
  async remove(profileId: string, target: string): Promise<SocialOverview> {
    const { low, high } = pair(profileId, target);
    await this.db
      .delete(friendships)
      .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high), ne(friendships.status, 'blocked')));
    return this.overview(profileId);
  }

  private async setStatus(low: string, high: string, status: string): Promise<void> {
    await this.db
      .update(friendships)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
  }

  private async mustFind(low: string, high: string) {
    const f = (
      await this.db
        .select()
        .from(friendships)
        .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    )[0];
    if (!f) throw new NotFoundException('relation introuvable');
    return f;
  }

  private async areFriends(a: string, b: string): Promise<boolean> {
    const { low, high } = pair(a, b);
    const f = (
      await this.db
        .select()
        .from(friendships)
        .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    )[0];
    return f?.status === 'accepted';
  }

  /** Recherche d'utilisateurs pour ajouter en ami : soit "Nom#tag" exact, soit pseudo partiel. */
  async search(profileId: string, q: string): Promise<SocialOverview['friends']> {
    const raw = q.trim();
    if (raw.length < 2) return [];
    // "Nom#1234" → recherche exacte (type Discord).
    const hashIdx = raw.lastIndexOf('#');
    const exactName = hashIdx > 0 ? raw.slice(0, hashIdx).trim().toLowerCase() : null;
    const exactTag = hashIdx > 0 ? raw.slice(hashIdx + 1).trim() : null;
    const partial = raw.toLowerCase();

    const all = await this.db.select().from(profiles);
    const rels = await this.db
      .select()
      .from(friendships)
      .where(or(eq(friendships.userLow, profileId), eq(friendships.userHigh, profileId)));
    const blocked = await this.blockedSet(profileId);

    const statusWith = (other: string): 'friends' | 'incoming' | 'outgoing' | 'blocked' | 'none' => {
      const { low, high } = pair(profileId, other);
      const r = rels.find((x) => x.userLow === low && x.userHigh === high);
      if (!r) return 'none';
      if (r.status === 'accepted') return 'friends';
      if (r.status === 'blocked') return 'blocked';
      return r.requestedBy === profileId ? 'outgoing' : 'incoming';
    };

    const out: SocialOverview['friends'] = [];
    for (const p of all) {
      if (p.id === profileId) continue;
      if (p.id === DOWZE_BOT_PROFILE_ID) continue; // le bot Dowze n'est pas une personne à ajouter
      if (blocked.has(p.id)) continue; // masquage bidirectionnel
      const match =
        exactName !== null
          ? p.displayName.toLowerCase() === exactName && p.tag === exactTag
          : p.displayName.toLowerCase().includes(partial);
      if (!match) continue;
      const st = statusWith(p.id);
      if (st === 'blocked') continue;
      out.push({ profileId: p.id, name: p.displayName, tag: p.tag, level: await this.xp.level(p.id), status: st });
      if (out.length >= 20) break;
    }
    return out;
  }

  // ---------------- Conversations ----------------

  /** Toutes mes conversations, triées par dernier message. */
  async inbox(profileId: string): Promise<ConversationSummary[]> {
    const mine = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.profileId, profileId));
    if (mine.length === 0) return [];
    const convIds = mine.map((m) => m.conversationId);
    const convs = await this.db.select().from(conversations).where(inArray(conversations.id, convIds));
    convs.sort(
      (a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0),
    );
    const blocked = await this.blockedSet(profileId);
    const heldIn = await this.heldIncomingMessageIds(profileId);

    const out: ConversationSummary[] = [];
    for (const c of convs) {
      // Le canal de classe n'apparaît PAS dans Messages : il a son propre espace « Ma classe ».
      if (c.type === 'class_channel') continue;
      if (c.type === 'direct' && (await this.otherIsBlocked(c.id, profileId, blocked))) continue;
      const part = mine.find((m) => m.conversationId === c.id);
      const recent = await this.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, c.id))
        .orderBy(desc(chatMessages.createdAt))
        .limit(8);
      // Dernier message VISIBLE pour moi (exclut retenus sortants d'autrui + entrants non validés).
      const last = recent.find(
        (m) => !(m.holdState === 'held_out' && m.senderId !== profileId) && !heldIn.has(m.id),
      );
      const unread = last ? !part?.lastReadMessageId || part.lastReadMessageId !== last.id : false;
      out.push({
        id: c.id,
        type: c.type as ConversationSummary['type'],
        title: await this.titleFor(c, profileId),
        lastBody: last ? (last.status === 'anonymized' ? '(message supprimé)' : last.body) : null,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        unread,
      });
    }
    return out;
  }

  private async titleFor(c: typeof conversations.$inferSelect, viewerId: string): Promise<string> {
    if (c.name) return c.name;
    if (c.type === 'direct') {
      const others = (
        await this.db
          .select()
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, c.id))
      ).filter((p) => p.profileId !== viewerId);
      const other = others[0];
      return other ? this.nameOf(other.profileId) : 'Conversation';
    }
    return 'Groupe';
  }

  /** Dans un MP, l'autre participant est-il masqué (bloqué) ? */
  private async otherIsBlocked(conversationId: string, viewerId: string, blocked: Set<string>): Promise<boolean> {
    const parts = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    return parts.some((p) => p.profileId !== viewerId && blocked.has(p.profileId));
  }

  private async assertParticipant(conversationId: string, profileId: string): Promise<void> {
    const p = (
      await this.db
        .select()
        .from(conversationParticipants)
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.profileId, profileId),
          ),
        )
    )[0];
    if (!p) throw new ForbiddenException('tu ne fais pas partie de cette conversation');
  }

  /** Voir une conversation + ses chatMessages (marque comme lu). */
  async conversation(profileId: string, conversationId: string): Promise<ConversationView> {
    await this.assertParticipant(conversationId, profileId);
    const c = (await this.db.select().from(conversations).where(eq(conversations.id, conversationId)))[0];
    if (!c) throw new NotFoundException('conversation introuvable');

    // MP avec un utilisateur bloqué : conversation masquée.
    if (c.type === 'direct' && (await this.otherIsBlocked(c.id, profileId, await this.blockedSet(profileId))))
      throw new ForbiddenException('conversation indisponible');

    const heldIn = await this.heldIncomingMessageIds(profileId);
    // Blocage asymétrique en groupe/classe : je ne vois plus les messages des gens que j'ai bloqués.
    const iBlocked = c.type === 'direct' ? new Set<string>() : await this.iBlocked(profileId);
    const allRows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);
    // Exclut : retenus sortants d'autrui (mode supervisé) + entrants non validés par mon parent + auteurs bloqués.
    const rows = allRows.filter(
      (m) =>
        !(m.holdState === 'held_out' && m.senderId !== profileId) &&
        !heldIn.has(m.id) &&
        !iBlocked.has(m.senderId),
    );

    const msgs = await Promise.all(rows.map((m) => this.toChatMessage(m, profileId)));

    const last = rows[rows.length - 1];
    if (last) {
      await this.db
        .update(conversationParticipants)
        .set({ lastReadMessageId: last.id })
        .where(
          and(
            eq(conversationParticipants.conversationId, conversationId),
            eq(conversationParticipants.profileId, profileId),
          ),
        );
    }

    let otherId: string | null = null;
    if (c.type === 'direct') {
      const parts = await this.db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, c.id));
      otherId = parts.find((p) => p.profileId !== profileId)?.profileId ?? null;
    }

    return { id: c.id, type: c.type as ConversationView['type'], title: await this.titleFor(c, profileId), otherId, messages: msgs };
  }

  private async toChatMessage(m: typeof chatMessages.$inferSelect, viewerId: string): Promise<ChatMessage> {
    return {
      id: m.id,
      senderId: m.senderId,
      senderName: await this.nameOf(m.senderId),
      body: m.status === 'anonymized' ? '' : m.body,
      kind: m.kind as ChatMessage['kind'],
      meta: (m.meta as Record<string, unknown> | null) ?? null,
      mine: m.senderId === viewerId,
      status: m.status as ChatMessage['status'],
      held: m.holdState === 'held_out',
      createdAt: m.createdAt.toISOString(),
    };
  }

  /** Envoyer un message (les chatMessages sont immuables : pas d'édition/suppression, cf. doc 26 §7.0). */
  async send(profileId: string, conversationId: string, input: SendMessageInput): Promise<ChatMessage> {
    await this.assertParticipant(conversationId, profileId);

    // MP avec un utilisateur bloqué : envoi impossible.
    const conv = (await this.db.select().from(conversations).where(eq(conversations.id, conversationId)))[0];
    if (conv?.type === 'direct' && (await this.otherIsBlocked(conversationId, profileId, await this.blockedSet(profileId))))
      throw new ForbiddenException('conversation indisponible');

    // Mode supervisé : si l'expéditeur est supervisé, le message est RETENU jusqu'à validation parentale.
    const senderSupervised = await this.isSupervised(profileId);
    const inserted = (
      await this.db
        .insert(chatMessages)
        .values({
          conversationId,
          senderId: profileId,
          body: input.body,
          kind: input.kind,
          meta: input.meta ?? null,
          holdState: senderSupervised ? 'held_out' : 'clear',
        })
        .returning()
    )[0];
    if (!inserted) throw new BadRequestException('envoi impossible');

    if (senderSupervised) {
      await this.enqueueSupervision(profileId, 'out', 'message', inserted.id, null);
    } else {
      // Chaque autre participant supervisé : le message lui est caché jusqu'à validation de son parent.
      const parts = await this.db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));
      for (const p of parts) {
        if (p.profileId === profileId) continue;
        if (await this.isSupervised(p.profileId))
          await this.enqueueSupervision(p.profileId, 'in', 'message', inserted.id, null);
      }
    }

    await this.db
      .update(conversations)
      .set({ lastMessageAt: inserted.createdAt })
      .where(eq(conversations.id, conversationId));

    // IA de modération : détecte → alerte parent + modération immédiatement (ne bannit jamais).
    await this.aiModeration.scanMessage(inserted.id, profileId, conversationId, input.body);

    // Temps réel : notifier les flux SSE. Message retenu (supervisé) → seulement l'expéditeur.
    const recipients = senderSupervised
      ? [profileId]
      : (
          await this.db
            .select()
            .from(conversationParticipants)
            .where(eq(conversationParticipants.conversationId, conversationId))
        ).map((p) => p.profileId);
    for (const pid of recipients) {
      void this.realtime.publishToUser(pid, { type: 'message', conversationId });
    }

    return this.toChatMessage(inserted, profileId);
  }

  /** Indicateur « en train d'écrire » → diffusé aux autres participants (TTL court côté client). */
  async typing(profileId: string, conversationId: string): Promise<{ ok: true }> {
    await this.assertParticipant(conversationId, profileId);
    const name = await this.nameOf(profileId);
    const parts = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    for (const p of parts) {
      if (p.profileId === profileId) continue;
      void this.realtime.publishToUser(p.profileId, { type: 'typing', conversationId, from: profileId, name });
    }
    return { ok: true as const };
  }

  /** Les profils que J'AI bloqués (masquage asymétrique en groupe/classe). */
  private async iBlocked(profileId: string): Promise<Set<string>> {
    const rows = await this.db.select().from(blocks).where(eq(blocks.blockerId, profileId));
    return new Set(rows.map((r) => r.blockedId));
  }

  /** Démarrer (ou retrouver) un MP avec un ami. */
  async startDirect(profileId: string, friendProfileId: string): Promise<{ conversationId: string }> {
    if ((await this.blockedSet(profileId)).has(friendProfileId))
      throw new ForbiddenException('utilisateur indisponible');
    if (!(await this.areFriends(profileId, friendProfileId)))
      throw new ForbiddenException('vous devez être amis pour discuter en privé');

    // Chercher un MP existant réunissant exactement ces deux profils.
    const mine = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.profileId, profileId));
    for (const m of mine) {
      const c = (await this.db.select().from(conversations).where(eq(conversations.id, m.conversationId)))[0];
      if (c?.type !== 'direct') continue;
      const parts = await this.db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, c.id));
      if (parts.length === 2 && parts.some((p) => p.profileId === friendProfileId)) {
        return { conversationId: c.id };
      }
    }

    const conv = (
      await this.db.insert(conversations).values({ type: 'direct', createdBy: profileId }).returning()
    )[0];
    if (!conv) throw new BadRequestException('création impossible');
    await this.db.insert(conversationParticipants).values([
      { conversationId: conv.id, profileId },
      { conversationId: conv.id, profileId: friendProfileId },
    ]);
    return { conversationId: conv.id };
  }

  /** Créer un groupe avec des amis. */
  async createGroup(profileId: string, name: string, memberIds: string[]): Promise<{ conversationId: string }> {
    const uniqueMembers = [...new Set(memberIds.filter((id) => id !== profileId))];
    for (const id of uniqueMembers) {
      if (!(await this.areFriends(profileId, id)))
        throw new ForbiddenException('on ne peut ajouter que des amis à un groupe');
    }
    const conv = (
      await this.db.insert(conversations).values({ type: 'group', name, createdBy: profileId }).returning()
    )[0];
    if (!conv) throw new BadRequestException('création impossible');
    await this.db.insert(conversationParticipants).values([
      { conversationId: conv.id, profileId, role: 'admin' },
      ...uniqueMembers.map((id) => ({ conversationId: conv.id, profileId: id })),
    ]);
    return { conversationId: conv.id };
  }

  /** Option 3 de la validation : partager un sujet in-app vers une conversation. */
  async shareSubject(profileId: string, conversationId: string, subjectId: string): Promise<ChatMessage> {
    const subject = (
      await this.db.select().from(validationSubjects).where(eq(validationSubjects.id, subjectId))
    )[0];
    if (!subject) throw new NotFoundException('sujet introuvable');
    return this.send(profileId, conversationId, {
      body: `Peux-tu évaluer mon sujet « ${subject.title} » ?`,
      kind: 'subject_share',
      meta: { subjectId, title: subject.title },
    });
  }
}
