import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { XpView } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, learnerXp, profiles } from '../db/schema';

// Courbe QUADRATIQUE (jamais de mur, recherche 2026) : coût n→n+1 = 25·n².
const XP_COEF = 25;
const DAILY_CAP = 400; // plafond global d'XP/jour (anti-abus, esprit Stack Overflow 200 rép/j).
const ACTIVE_CAP = 40; // plafond d'XP « temps actif »/jour (source la plus risquée → petite & plafonnée).
const ACTIVE_BLOCK_SEC = 600; // +5 XP par bloc de 10 min ACTIF.
const STREAK_PALIERS = [3, 7, 14, 30];

/** XP cumulé requis pour ATTEINDRE le niveau L. */
function totalToReach(L: number): number {
  return Math.round((XP_COEF * (L - 1) * L * (2 * L - 1)) / 6);
}
function levelInfo(xp: number): { level: number; into: number; forNext: number } {
  let level = 1;
  while (level < 200 && totalToReach(level + 1) <= xp) level += 1;
  const base = totalToReach(level);
  const next = totalToReach(level + 1);
  return { level, into: xp - base, forNext: next - base };
}

type Row = typeof learnerXp.$inferSelect;

@Injectable()
export class XpService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private todayStr(): string {
    // JJ calendaire (UTC) — suffisant pour les plafonds journaliers.
    return new Date().toISOString().slice(0, 10);
  }

  /** Charge (ou initialise) la ligne XP, en remettant à zéro les compteurs journaliers si le jour a changé. */
  private async ensureRow(profileId: string): Promise<Row> {
    const rows = await this.db.select().from(learnerXp).where(eq(learnerXp.profileId, profileId));
    let row = rows[0];
    if (!row) {
      const ins = await this.db.insert(learnerXp).values({ profileId, today: this.todayStr() }).returning();
      row = ins[0]!;
    }
    if (row.today !== this.todayStr()) {
      const upd = await this.db
        .update(learnerXp)
        .set({ xpToday: 0, activeSecondsToday: 0, today: this.todayStr(), updatedAt: new Date() })
        .where(eq(learnerXp.profileId, profileId))
        .returning();
      row = upd[0] ?? row;
    }
    return row;
  }

  private toView(row: Row): XpView {
    const info = levelInfo(row.xp);
    return {
      level: info.level,
      xp: row.xp,
      xpIntoLevel: info.into,
      xpForNext: info.forNext,
      progressPct: info.forNext > 0 ? Math.round((info.into / info.forNext) * 100) / 100 : 1,
      streak: row.streak,
      xpToday: row.xpToday,
    };
  }

  async view(profileId: string): Promise<XpView> {
    return this.toView(await this.ensureRow(profileId));
  }

  async level(profileId: string): Promise<number> {
    return levelInfo((await this.ensureRow(profileId)).xp).level;
  }

  /** Crédite un montant d'XP (respecte le plafond global journalier). Retourne l'XP réellement crédité. */
  async award(profileId: string, amount: number): Promise<number> {
    if (amount <= 0) return 0;
    const row = await this.ensureRow(profileId);
    const credit = Math.max(0, Math.min(amount, DAILY_CAP - row.xpToday));
    if (credit === 0) return 0;
    await this.db
      .update(learnerXp)
      .set({ xp: row.xp + credit, xpToday: row.xpToday + credit, updatedAt: new Date() })
      .where(eq(learnerXp.profileId, profileId));
    return credit;
  }

  /** Connexion quotidienne : +20 XP (1×/jour) + bonus de série plafonné. Met à jour la série. */
  async daily(profileId: string): Promise<XpView> {
    const row = await this.ensureRow(profileId);
    const today = this.todayStr();
    if (row.lastLoginDate === today) return this.toView(row); // déjà crédité aujourd'hui
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const streak = row.lastLoginDate === yesterday ? row.streak + 1 : 1;
    const paliers = STREAK_PALIERS.filter((p) => streak >= p).length;
    const bonus = Math.min(30, 5 * paliers);
    await this.db
      .update(learnerXp)
      .set({ streak, lastLoginDate: today, updatedAt: new Date() })
      .where(eq(learnerXp.profileId, profileId));
    await this.award(profileId, 20 + bonus);
    return this.view(profileId);
  }

  /** Heartbeat de temps ACTIF (le client n'envoie que des secondes actives validées ; le serveur plafonne). */
  async active(profileId: string, seconds: number): Promise<XpView> {
    const row = await this.ensureRow(profileId);
    const s = Math.max(0, Math.min(120, Math.floor(seconds))); // borne un heartbeat à 2 min
    const before = row.activeSecondsToday;
    const after = before + s;
    const creditedBefore = Math.min(ACTIVE_CAP, Math.floor(before / ACTIVE_BLOCK_SEC) * 5);
    const creditedAfter = Math.min(ACTIVE_CAP, Math.floor(after / ACTIVE_BLOCK_SEC) * 5);
    const delta = creditedAfter - creditedBefore;
    await this.db
      .update(learnerXp)
      .set({ activeSecondsToday: after, updatedAt: new Date() })
      .where(eq(learnerXp.profileId, profileId));
    if (delta > 0) await this.award(profileId, delta);
    return this.view(profileId);
  }

  /** Ancienneté du compte en jours (pour l'éligibilité d'évaluateur). */
  async accountAgeDays(profileId: string): Promise<number> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!prof) return 0;
    const acc = (await this.db.select().from(accounts).where(eq(accounts.id, prof.accountId)))[0];
    if (!acc) return 0;
    return Math.floor((Date.now() - acc.createdAt.getTime()) / 86400000);
  }
}
