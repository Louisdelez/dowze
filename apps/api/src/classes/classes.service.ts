import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { AssignResult, MyClassView } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  accounts,
  classes,
  conversationParticipants,
  conversations,
  chatMessages,
  learnerRank,
  memberships,
  profiles,
} from '../db/schema';
import { RANKS } from '../results/ranks';
import { assignClasses, MAX_SIZE, type Candidate } from './assign';

/** Année scolaire courante (une nouvelle classe est attribuée chaque année). */
const CURRENT_SCHOOL_YEAR = 2026;

function rankName(level: number): string {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, level - 1))]?.name ?? 'Fer';
}

function ageFromBirth(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

@Injectable()
export class ClassesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async isModerator(profileId: string): Promise<boolean> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!p) return false;
    const a = (await this.db.select().from(accounts).where(eq(accounts.id, p.accountId)))[0];
    return a?.role === 'moderateur';
  }

  private async nameOf(profileId: string): Promise<string> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    return p?.displayName ?? '';
  }

  private async rankOf(profileId: string): Promise<number> {
    const r = (await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId)))[0];
    return r?.rank ?? 1;
  }

  /** (Ré)assigne toutes les classes de l'année scolaire — réservé aux modérateurs. */
  async assignAll(actorProfileId: string, schoolYear: number): Promise<AssignResult> {
    if (!(await this.isModerator(actorProfileId))) throw new ForbiddenException('réservé aux modérateurs');

    // Candidats : tous les profils + leur rang + langue + âge.
    const allProfiles = await this.db.select().from(profiles);
    const candidates: Candidate[] = [];
    for (const p of allProfiles) {
      candidates.push({
        profileId: p.id,
        level: await this.rankOf(p.id),
        lang: (p.locale || 'fr').split('-')[0] ?? 'fr',
        age: ageFromBirth(p.birthDate),
      });
    }

    // Purge des classes existantes de l'année (idempotence).
    const old = await this.db.select().from(classes).where(eq(classes.schoolYear, schoolYear));
    if (old.length > 0) {
      const oldIds = old.map((c) => c.id);
      const oldConvs = await this.db.select().from(conversations).where(inArray(conversations.classId, oldIds));
      const convIds = oldConvs.map((c) => c.id);
      if (convIds.length > 0) {
        await this.db.delete(chatMessages).where(inArray(chatMessages.conversationId, convIds));
        await this.db.delete(conversationParticipants).where(inArray(conversationParticipants.conversationId, convIds));
        await this.db.delete(conversations).where(inArray(conversations.id, convIds));
      }
      await this.db.delete(memberships).where(inArray(memberships.classeId, oldIds));
      await this.db.delete(classes).where(inArray(classes.id, oldIds));
    }

    // Assignation.
    const assigned = assignClasses(candidates);
    const resultClasses: AssignResult['classes'] = [];
    let i = 0;
    for (const a of assigned) {
      const name = `${rankName(a.level)} · ${a.lang}${a.isMultilingual ? ' (multilingue)' : ''}`;
      const slug = `c-${schoolYear}-${a.level}-${a.lang}-${i}`;
      const cls = (
        await this.db
          .insert(classes)
          .values({
            slug,
            name,
            locale: a.lang,
            timezone: 'Europe/Zurich',
            type: 'tronc-commun',
            level: a.level,
            primaryLang: a.lang,
            isMultilingual: a.isMultilingual,
            schoolYear,
          })
          .returning()
      )[0];
      if (!cls) continue;
      // Canal de classe = conversation (messagerie Phase A) → block/signalement/supervision inclus.
      const chan = (
        await this.db
          .insert(conversations)
          .values({ type: 'class_channel', classId: cls.id, name, createdBy: actorProfileId })
          .returning()
      )[0];
      for (const pid of a.memberIds) {
        await this.db.insert(memberships).values({
          classeId: cls.id,
          profileId: pid,
          schoolYear,
          assignmentReason: a.reason,
        }).onConflictDoNothing();
        if (chan) await this.db.insert(conversationParticipants).values({ conversationId: chan.id, profileId: pid }).onConflictDoNothing();
      }
      resultClasses.push({ name, level: a.level, lang: a.lang, isMultilingual: a.isMultilingual, size: a.memberIds.length, reason: a.reason });
      i++;
    }

    return { created: resultClasses.length, totalLearners: candidates.length, classes: resultClasses };
  }

  /** Ajoute un apprenant à une classe (membre + participant au canal). */
  private async join(classId: string, profileId: string, schoolYear: number): Promise<void> {
    await this.db
      .insert(memberships)
      .values({ classeId: classId, profileId, schoolYear, assignmentReason: 'rolling' })
      .onConflictDoNothing();
    const chan = (
      await this.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.classId, classId), eq(conversations.type, 'class_channel')))
    )[0];
    if (chan)
      await this.db
        .insert(conversationParticipants)
        .values({ conversationId: chan.id, profileId })
        .onConflictDoNothing();
  }

  /**
   * Attribution CONTINUE : place l'apprenant dans une classe de son (année × niveau × langue) avec
   * de la place, sinon en crée une nouvelle. Max de slots, PAS de minimum (comme une vraie école :
   * on rejoint même seul, et on peut rejoindre en cours d'année tant qu'il reste de la place).
   */
  async assignOne(profileId: string, schoolYear = CURRENT_SCHOOL_YEAR): Promise<string | null> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!p) return null;
    const level = await this.rankOf(profileId);
    const lang = (p.locale || 'fr').split('-')[0] ?? 'fr';

    const existing = await this.db
      .select()
      .from(classes)
      .where(and(eq(classes.schoolYear, schoolYear), eq(classes.level, level), eq(classes.primaryLang, lang)));
    for (const c of existing) {
      const count = (await this.db.select().from(memberships).where(eq(memberships.classeId, c.id))).length;
      if (count < MAX_SIZE) {
        await this.join(c.id, profileId, schoolYear);
        return c.id;
      }
    }

    // Aucune classe avec de la place → on en crée une nouvelle.
    const name = `${rankName(level)} · ${lang}`;
    const slug = `c-${schoolYear}-${level}-${lang}-${existing.length}-${profileId.slice(0, 8)}`;
    const cls = (
      await this.db
        .insert(classes)
        .values({
          slug,
          name,
          locale: lang,
          timezone: 'Europe/Zurich',
          type: 'tronc-commun',
          level,
          primaryLang: lang,
          isMultilingual: false,
          schoolYear,
        })
        .returning()
    )[0];
    if (!cls) return null;
    await this.db
      .insert(conversations)
      .values({ type: 'class_channel', classId: cls.id, name, createdBy: profileId })
      .returning();
    await this.join(cls.id, profileId, schoolYear);
    return cls.id;
  }

  /** La classe de l'apprenant pour l'année en cours (+ son canal). Auto-attribution si aucune. */
  async myClass(profileId: string): Promise<MyClassView> {
    let mine = await this.db
      .select()
      .from(memberships)
      .where(and(eq(memberships.profileId, profileId), eq(memberships.schoolYear, CURRENT_SCHOOL_YEAR)));
    if (mine.length === 0) {
      await this.assignOne(profileId, CURRENT_SCHOOL_YEAR);
      mine = await this.db
        .select()
        .from(memberships)
        .where(and(eq(memberships.profileId, profileId), eq(memberships.schoolYear, CURRENT_SCHOOL_YEAR)));
    }
    const m = mine[0];
    const empty: MyClassView = {
      hasClass: false,
      id: null,
      name: '',
      level: 1,
      lang: 'fr',
      isMultilingual: false,
      channelId: null,
      members: [],
      assignmentReason: '',
    };
    if (!m) return empty;
    const cls = (await this.db.select().from(classes).where(eq(classes.id, m.classeId)))[0];
    if (!cls) return empty;

    const chan = (
      await this.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.classId, cls.id), eq(conversations.type, 'class_channel')))
    )[0];

    const memberRows = await this.db.select().from(memberships).where(eq(memberships.classeId, cls.id));
    const members = await Promise.all(
      memberRows.map(async (mr) => ({ profileId: mr.profileId, name: await this.nameOf(mr.profileId), level: await this.rankOf(mr.profileId) })),
    );

    return {
      hasClass: true,
      id: cls.id,
      name: cls.name,
      level: cls.level,
      lang: cls.primaryLang,
      isMultilingual: cls.isMultilingual,
      channelId: chan?.id ?? null,
      members,
      assignmentReason: m.assignmentReason,
    };
  }
}
