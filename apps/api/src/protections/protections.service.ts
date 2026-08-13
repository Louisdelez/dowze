import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type {
  AiModerationFlag,
  GuardianControls,
  ModeratorQueue,
  ModerationReport,
  ResetRequest,
  SupervisionItemView,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  accounts,
  aiModerationFlags,
  chatMessages,
  conversationParticipants,
  conversations,
  friendships,
  guardians,
  parentalAlerts,
  profiles,
  resetRequests,
  supervisionItems,
  userReports,
} from '../db/schema';

@Injectable()
export class ProtectionsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async nameOf(profileId: string): Promise<string> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    return p?.displayName ?? '';
  }

  private async profileForAccount(accountId: string) {
    return (
      (await this.db.select().from(profiles).where(eq(profiles.accountId, accountId)))[0] ?? null
    );
  }

  // ---------------- Espace modérateur ----------------

  async isModerator(profileId: string): Promise<boolean> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!p) return false;
    const a = (await this.db.select().from(accounts).where(eq(accounts.id, p.accountId)))[0];
    return a?.role === 'moderateur';
  }

  async moderatorQueue(profileId: string): Promise<ModeratorQueue> {
    if (!(await this.isModerator(profileId)))
      return { isModerator: false, reports: [], resetRequests: [], aiFlags: [] };

    const reportRows = await this.db
      .select()
      .from(userReports)
      .where(inArray(userReports.status, ['open', 'reviewing']))
      .orderBy(desc(userReports.createdAt))
      .limit(100);

    const reports: ModerationReport[] = [];
    for (const r of reportRows) {
      // Accès contextuel : la fenêtre des derniers messages de la conversation signalée (pas tout l'historique).
      let context: ModerationReport['context'] = [];
      if (r.conversationId) {
        const msgs = await this.db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, r.conversationId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(20);
        context = await Promise.all(
          msgs.reverse().map(async (m) => ({
            id: m.id,
            senderId: m.senderId,
            senderName: await this.nameOf(m.senderId),
            body: m.status === 'anonymized' ? '' : m.body,
            kind: m.kind as ModerationReport['context'][number]['kind'],
            meta: (m.meta as Record<string, unknown> | null) ?? null,
            mine: false,
            status: m.status as 'active' | 'anonymized',
            held: m.holdState === 'held_out',
            createdAt: m.createdAt.toISOString(),
          })),
        );
      }
      reports.push({
        id: r.id,
        reporterName: await this.nameOf(r.reporterId),
        reportedName: await this.nameOf(r.reportedId),
        reason: r.reason,
        status: r.status as ModerationReport['status'],
        createdAtIso: r.createdAt.toISOString(),
        context,
      });
    }

    const resetRows = await this.db
      .select()
      .from(resetRequests)
      .where(eq(resetRequests.status, 'pending_moderator'))
      .orderBy(desc(resetRequests.createdAt));
    const resetList = await Promise.all(resetRows.map((r) => this.toResetView(r)));

    // Signalements de l'IA de modération.
    const flagRows = await this.db
      .select()
      .from(aiModerationFlags)
      .where(eq(aiModerationFlags.status, 'open'))
      .orderBy(desc(aiModerationFlags.createdAt))
      .limit(100);
    const aiFlags: AiModerationFlag[] = await Promise.all(
      flagRows.map(async (f) => {
        const msg = (
          await this.db.select().from(chatMessages).where(eq(chatMessages.id, f.messageId))
        )[0];
        return {
          id: f.id,
          authorName: await this.nameOf(f.authorId),
          category: f.category,
          reason: f.reason,
          severity: f.severity,
          messageBody: msg?.status === 'anonymized' ? '(supprimé)' : (msg?.body ?? ''),
          createdAtIso: f.createdAt.toISOString(),
        };
      }),
    );

    return { isModerator: true, reports, resetRequests: resetList, aiFlags };
  }

  async resolveAiFlag(profileId: string, flagId: string): Promise<{ ok: true }> {
    if (!(await this.isModerator(profileId)))
      throw new ForbiddenException('réservé aux modérateurs');
    await this.db
      .update(aiModerationFlags)
      .set({ status: 'resolved', resolvedAt: new Date(), resolverId: profileId })
      .where(eq(aiModerationFlags.id, flagId));
    return { ok: true as const };
  }

  private async toResetView(r: typeof resetRequests.$inferSelect): Promise<ResetRequest> {
    return {
      id: r.id,
      childName: await this.nameOf(r.profileId),
      scope: r.scope as 'messages' | 'account',
      requestedBy: r.requestedBy as 'self' | 'parent',
      status: r.status as ResetRequest['status'],
      createdAtIso: r.createdAt.toISOString(),
    };
  }

  async resolveReport(profileId: string, reportId: string): Promise<{ ok: true }> {
    if (!(await this.isModerator(profileId)))
      throw new ForbiddenException('réservé aux modérateurs');
    await this.db
      .update(userReports)
      .set({ status: 'resolved', resolvedAt: new Date(), resolverId: profileId })
      .where(eq(userReports.id, reportId));
    return { ok: true as const };
  }

  async moderatorDecideReset(
    profileId: string,
    resetId: string,
    approve: boolean,
  ): Promise<{ ok: true }> {
    if (!(await this.isModerator(profileId)))
      throw new ForbiddenException('réservé aux modérateurs');
    const req = (
      await this.db.select().from(resetRequests).where(eq(resetRequests.id, resetId))
    )[0];
    if (!req) throw new NotFoundException('demande introuvable');
    if (req.status !== 'pending_moderator') throw new BadRequestException('demande déjà traitée');
    if (approve) await this.executeReset(req.profileId, req.scope);
    await this.db
      .update(resetRequests)
      .set({
        status: approve ? 'approved' : 'rejected',
        moderatorId: profileId,
        resolvedAt: new Date(),
      })
      .where(eq(resetRequests.id, resetId));
    return { ok: true as const };
  }

  /** Remise à 0 : efface TOUS les messages + amis de l'élève (compte intact). */
  private async executeReset(profileId: string, _scope: string): Promise<void> {
    // 1. Messages envoyés par l'élève.
    await this.db.delete(chatMessages).where(eq(chatMessages.senderId, profileId));
    // 2. Amitiés impliquant l'élève.
    await this.db
      .delete(friendships)
      .where(or(eq(friendships.userLow, profileId), eq(friendships.userHigh, profileId)));
    // 3. Sa participation aux conversations.
    const myParts = await this.db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.profileId, profileId));
    await this.db
      .delete(conversationParticipants)
      .where(eq(conversationParticipants.profileId, profileId));
    // 4. Conversations directes devenues orphelines (≤ 1 participant restant).
    for (const p of myParts) {
      const c = (
        await this.db.select().from(conversations).where(eq(conversations.id, p.conversationId))
      )[0];
      if (c?.type !== 'direct') continue;
      const remaining = await this.db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, c.id));
      if (remaining.length <= 1) {
        await this.db.delete(chatMessages).where(eq(chatMessages.conversationId, c.id));
        await this.db
          .delete(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, c.id));
        await this.db.delete(conversations).where(eq(conversations.id, c.id));
      }
    }
    // 5. Items de supervision de l'élève.
    await this.db.delete(supervisionItems).where(eq(supervisionItems.childProfileId, profileId));
  }

  // ---------------- Demande de remise à 0 par l'élève ----------------

  /** L'élève demande une remise à 0. Sous accord parental → passe d'abord par le parent. */
  async requestReset(profileId: string, scope: 'messages' | 'account'): Promise<ResetRequest> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!p) throw new NotFoundException('profil introuvable');
    const guardian = (
      await this.db.select().from(guardians).where(eq(guardians.minorAccountId, p.accountId))
    )[0];
    // Sous accord parental (un responsable existe) → validation parentale d'abord ; sinon direct modérateur.
    const status = guardian ? 'pending_parent' : 'pending_moderator';
    const inserted = (
      await this.db
        .insert(resetRequests)
        .values({ profileId, scope, requestedBy: 'self', requesterRef: profileId, status })
        .returning()
    )[0];
    if (!inserted) throw new BadRequestException('demande impossible');
    return this.toResetView(inserted);
  }

  // ---------------- Contrôles parentaux (Espace responsable) ----------------

  async guardianControls(childAccountId: string): Promise<GuardianControls> {
    const child = await this.profileForAccount(childAccountId);
    if (!child) throw new NotFoundException('élève introuvable');
    const guardian = (
      await this.db.select().from(guardians).where(eq(guardians.minorAccountId, childAccountId))
    )[0];

    const items = await this.db
      .select()
      .from(supervisionItems)
      .where(
        and(
          eq(supervisionItems.childAccountId, childAccountId),
          eq(supervisionItems.status, 'pending'),
        ),
      )
      .orderBy(desc(supervisionItems.createdAt));
    const queue: SupervisionItemView[] = await Promise.all(
      items.map((it) => this.toSupervisionView(it)),
    );

    const pendingChildResetRows = await this.db
      .select()
      .from(resetRequests)
      .where(and(eq(resetRequests.profileId, child.id), eq(resetRequests.status, 'pending_parent')))
      .orderBy(desc(resetRequests.createdAt));
    const pendingChildResets = await Promise.all(
      pendingChildResetRows.map((r) => this.toResetView(r)),
    );

    // Alertes de l'IA de modération concernant cet enfant (immédiates).
    const alertRows = await this.db
      .select()
      .from(parentalAlerts)
      .where(eq(parentalAlerts.minorAccountId, childAccountId))
      .orderBy(desc(parentalAlerts.createdAt))
      .limit(20);
    const aiAlerts = alertRows.map((a) => ({
      id: a.id,
      reason: a.reason,
      severity: a.severity,
      createdAtIso: a.createdAt.toISOString(),
    }));

    return {
      guardianId: guardian?.id ?? null,
      childAccountId,
      childName: child.displayName,
      supervised: guardian?.supervised ?? false,
      queue,
      pendingChildResets,
      aiAlerts,
    };
  }

  private async toSupervisionView(
    it: typeof supervisionItems.$inferSelect,
  ): Promise<SupervisionItemView> {
    let otherName = '';
    let preview = '';
    if (it.kind === 'friend_request') {
      otherName = it.friendTargetId ? await this.nameOf(it.friendTargetId) : '';
      preview = "Demande d'ami";
    } else if (it.messageId) {
      const m = (
        await this.db.select().from(chatMessages).where(eq(chatMessages.id, it.messageId))
      )[0];
      otherName = m ? await this.nameOf(m.senderId) : '';
      preview = m?.body ?? '';
    }
    return {
      id: it.id,
      direction: it.direction as 'in' | 'out',
      kind: it.kind as 'message' | 'friend_request',
      otherName,
      preview,
      createdAtIso: it.createdAt.toISOString(),
    };
  }

  /** Active/désactive le mode supervisé (crée le responsable au besoin). */
  async setSupervised(
    childAccountId: string,
    on: boolean,
    guardianEmail: string,
  ): Promise<{ supervised: boolean }> {
    const existing = (
      await this.db.select().from(guardians).where(eq(guardians.minorAccountId, childAccountId))
    )[0];
    if (existing) {
      await this.db.update(guardians).set({ supervised: on }).where(eq(guardians.id, existing.id));
    } else {
      await this.db.insert(guardians).values({
        minorAccountId: childAccountId,
        email: guardianEmail || 'parent@dowze',
        supervised: on,
      });
    }
    return { supervised: on };
  }

  /** Le parent valide/refuse un item de la file (message ou demande d'ami, entrant ou sortant). */
  async resolveSupervision(
    childAccountId: string,
    itemId: string,
    approve: boolean,
  ): Promise<{ ok: true }> {
    const it = (
      await this.db.select().from(supervisionItems).where(eq(supervisionItems.id, itemId))
    )[0];
    if (!it || it.childAccountId !== childAccountId)
      throw new NotFoundException('élément introuvable');
    if (it.status !== 'pending') throw new BadRequestException('déjà traité');

    if (it.kind === 'message' && it.messageId) {
      if (it.direction === 'out') {
        if (approve)
          await this.db
            .update(chatMessages)
            .set({ holdState: 'clear' })
            .where(eq(chatMessages.id, it.messageId));
        else
          await this.db
            .update(chatMessages)
            .set({ status: 'anonymized', body: '' })
            .where(eq(chatMessages.id, it.messageId));
      }
      // 'in' : l'approbation (status='approved') suffit à révéler le message côté enfant.
    } else if (it.kind === 'friend_request' && it.friendTargetId) {
      const child = it.childProfileId;
      const other = it.friendTargetId;
      const low = child < other ? child : other;
      const high = child < other ? other : child;
      if (approve) {
        if (it.direction === 'out')
          await this.db
            .update(friendships)
            .set({ status: 'pending' })
            .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
        // 'in' : l'approbation suffit à révéler la demande entrante côté enfant.
      } else {
        // Refus → on supprime la relation en attente.
        await this.db
          .delete(friendships)
          .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
      }
    }

    await this.db
      .update(supervisionItems)
      .set({ status: approve ? 'approved' : 'rejected', resolvedAt: new Date() })
      .where(eq(supervisionItems.id, itemId));
    return { ok: true as const };
  }

  /** Le parent approuve la demande de remise à 0 de son enfant → part au modérateur. */
  async parentDecideChildReset(
    childAccountId: string,
    resetId: string,
    approve: boolean,
  ): Promise<{ ok: true }> {
    const child = await this.profileForAccount(childAccountId);
    if (!child) throw new NotFoundException('élève introuvable');
    const req = (
      await this.db.select().from(resetRequests).where(eq(resetRequests.id, resetId))
    )[0];
    if (!req || req.profileId !== child.id) throw new NotFoundException('demande introuvable');
    if (req.status !== 'pending_parent') throw new BadRequestException('déjà traité');
    await this.db
      .update(resetRequests)
      .set(
        approve
          ? { status: 'pending_moderator', parentApprovedAt: new Date() }
          : { status: 'rejected', resolvedAt: new Date() },
      )
      .where(eq(resetRequests.id, resetId));
    return { ok: true as const };
  }

  /** Le parent demande lui-même une remise à 0 → directement au modérateur. */
  async parentCreateReset(
    childAccountId: string,
    scope: 'messages' | 'account',
    guardianEmail: string,
  ): Promise<ResetRequest> {
    const child = await this.profileForAccount(childAccountId);
    if (!child) throw new NotFoundException('élève introuvable');
    const inserted = (
      await this.db
        .insert(resetRequests)
        .values({
          profileId: child.id,
          scope,
          requestedBy: 'parent',
          requesterRef: guardianEmail,
          status: 'pending_moderator',
        })
        .returning()
    )[0];
    if (!inserted) throw new BadRequestException('demande impossible');
    return this.toResetView(inserted);
  }
}
