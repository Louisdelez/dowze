import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { initialCard, review } from '@dowze/core';
import type { Sm2Card, Sm2Grade } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { sm2Cards } from '../db/schema';

type Row = typeof sm2Cards.$inferSelect;

function toCard(row: Row): Sm2Card {
  return {
    skillId: row.skillId,
    repetitions: row.repetitions,
    easeFactor: row.easeFactor,
    intervalDays: row.intervalDays,
    dueDateIso: row.dueDate ? row.dueDate.toISOString() : null,
    lastReviewedIso: row.lastReviewed ? row.lastReviewed.toISOString() : null,
  };
}

@Injectable()
export class SpacedRepetitionService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Applique une révision SM-2 et persiste la carte mise à jour. */
  async review(
    profileId: string,
    skillId: string,
    grade: Sm2Grade,
    nowIso: string,
  ): Promise<Sm2Card> {
    const existing = await this.db
      .select()
      .from(sm2Cards)
      .where(and(eq(sm2Cards.profileId, profileId), eq(sm2Cards.skillId, skillId)));

    const current = existing[0] ? toCard(existing[0]) : initialCard(skillId);
    const next = review(current, grade, nowIso);

    await this.db
      .insert(sm2Cards)
      .values({
        profileId,
        skillId,
        repetitions: next.repetitions,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        dueDate: next.dueDateIso ? new Date(next.dueDateIso) : null,
        lastReviewed: next.lastReviewedIso ? new Date(next.lastReviewedIso) : null,
      })
      .onConflictDoUpdate({
        target: [sm2Cards.profileId, sm2Cards.skillId],
        set: {
          repetitions: next.repetitions,
          easeFactor: next.easeFactor,
          intervalDays: next.intervalDays,
          dueDate: next.dueDateIso ? new Date(next.dueDateIso) : null,
          lastReviewed: next.lastReviewedIso ? new Date(next.lastReviewedIso) : null,
        },
      });

    return next;
  }
}
