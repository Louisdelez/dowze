import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lte } from 'drizzle-orm';
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import { DB, type Database } from '../db/drizzle.module';
import { fsrsCards } from '../db/schema';

/**
 * Planification de la révision espacée avec FSRS (Free Spaced Repetition Scheduler).
 * L'app détient l'état (comme pour le BKT) ; FSRS calcule seulement QUAND revoir.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

type Row = typeof fsrsCards.$inferSelect;

function rowToCard(row: Row): FsrsCard {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview ?? undefined,
  } as FsrsCard;
}

@Injectable()
export class FsrsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Enregistre une révision (note FSRS) et reprogramme la carte.
   *  Transaction + verrou de ligne : le rescheduling est un read-modify-write — deux notes concurrentes
   *  faisaient sauter l'intervalle de deux crans ou se perdaient (audit 08-2026). */
  async rate(profileId: string, skillId: string, rating: Grade, nowIso: string): Promise<void> {
    const now = new Date(nowIso);
    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(fsrsCards)
        .where(and(eq(fsrsCards.profileId, profileId), eq(fsrsCards.skillId, skillId)))
        .for('update');

      const card = existing[0] ? rowToCard(existing[0]) : createEmptyCard(now);
      const { card: next } = scheduler.next(card, now, rating);

      const values = {
        profileId,
        skillId,
        due: next.due,
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: Math.round(next.elapsed_days),
        scheduledDays: Math.round(next.scheduled_days),
        reps: next.reps,
        lapses: next.lapses,
        state: next.state as number,
        lastReview: next.last_review ?? now,
      };

      await tx
        .insert(fsrsCards)
        .values(values)
        .onConflictDoUpdate({ target: [fsrsCards.profileId, fsrsCards.skillId], set: values });
    });
  }

  /** Compétences dues à réviser (échéance passée), les plus en retard d'abord. */
  async due(profileId: string, nowIso: string): Promise<string[]> {
    const rows = await this.db
      .select()
      .from(fsrsCards)
      .where(and(eq(fsrsCards.profileId, profileId), lte(fsrsCards.due, new Date(nowIso))))
      .orderBy(asc(fsrsCards.due));
    return rows.map((r) => r.skillId);
  }
}

/** Traduit un résultat de séance en note FSRS. */
export function outcomeToRating(outcome: 'maitrise' | 'progres' | 'bloque'): Grade {
  switch (outcome) {
    case 'maitrise':
      return Rating.Easy;
    case 'progres':
      return Rating.Good;
    case 'bloque':
      return Rating.Again;
  }
}
