import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { initialMastery, updateMastery } from '@dowze/core';
import { bktParamsSchema, type BktParams, type MasteryState } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { masteryStates } from '../db/schema';

const DEFAULT_BKT: BktParams = bktParamsSchema.parse({});

type Row = typeof masteryStates.$inferSelect;

function toState(row: Row): MasteryState {
  return {
    skillId: row.skillId,
    pMastery: row.pMastery,
    attempts: row.attempts,
    correct: row.correct,
    lastUpdatedIso: row.lastUpdated ? row.lastUpdated.toISOString() : null,
  };
}

@Injectable()
export class ProgressionService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Tous les états de maîtrise d'un profil. */
  async getMastery(profileId: string): Promise<MasteryState[]> {
    const rows = await this.db
      .select()
      .from(masteryStates)
      .where(eq(masteryStates.profileId, profileId));
    return rows.map(toState);
  }

  /** Enregistre une observation (réussite/échec) et met à jour la maîtrise (BKT). */
  async observe(
    profileId: string,
    skillId: string,
    correct: boolean,
    nowIso: string,
  ): Promise<MasteryState> {
    const existing = await this.db
      .select()
      .from(masteryStates)
      .where(and(eq(masteryStates.profileId, profileId), eq(masteryStates.skillId, skillId)));

    const current = existing[0] ? toState(existing[0]) : initialMastery(skillId, DEFAULT_BKT);
    const next = updateMastery(current, DEFAULT_BKT, correct, nowIso);

    await this.db
      .insert(masteryStates)
      .values({
        profileId,
        skillId,
        pMastery: next.pMastery,
        attempts: next.attempts,
        correct: next.correct,
        lastUpdated: new Date(nowIso),
      })
      .onConflictDoUpdate({
        target: [masteryStates.profileId, masteryStates.skillId],
        set: {
          pMastery: next.pMastery,
          attempts: next.attempts,
          correct: next.correct,
          lastUpdated: new Date(nowIso),
        },
      });

    return next;
  }
}
