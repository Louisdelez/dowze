import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { nextPrescribedSkill } from '@dowze/core';
import { DB, type Database } from '../db/drizzle.module';
import { carnetEntries, masteryStates } from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { buildResumePrompt } from './resume-prompt';

@Injectable()
export class CarnetService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
  ) {}

  addEntry(profileId: string, note: string, skillId: string | null) {
    return this.db
      .insert(carnetEntries)
      .values({ profileId, note, skillId })
      .returning()
      .then((r) => r[0]);
  }

  list(profileId: string) {
    return this.db
      .select()
      .from(carnetEntries)
      .where(eq(carnetEntries.profileId, profileId))
      .orderBy(desc(carnetEntries.createdAt));
  }

  /** La DERNIÈRE note pour UNE compétence — requête scopée `LIMIT 1` (audit perf 08-2026 : `compose`
   *  chargeait TOUT le carnet, embeddings compris, juste pour trouver cette note). */
  async lastNoteFor(profileId: string, skillId: string): Promise<string | null> {
    const row = (
      await this.db
        .select({ note: carnetEntries.note })
        .from(carnetEntries)
        .where(and(eq(carnetEntries.profileId, profileId), eq(carnetEntries.skillId, skillId)))
        .orderBy(desc(carnetEntries.createdAt))
        .limit(1)
    )[0];
    return row?.note ?? null;
  }

  /** Le prompt de reprise contextualisé (état entre sessions). */
  async resumePrompt(profileId: string): Promise<{ prompt: string }> {
    const mastery = await this.db
      .select()
      .from(masteryStates)
      .where(eq(masteryStates.profileId, profileId));
    const masteredIds = new Set(mastery.filter((m) => m.pMastery >= 0.95).map((m) => m.skillId));

    const skills = await this.graph.loadGraph();
    const next = nextPrescribedSkill(skills, masteredIds);

    const entries = await this.list(profileId);
    const lastNote = entries[0]?.note ?? null;

    return {
      prompt: buildResumePrompt({
        nextSkillTitle: next?.title ?? null,
        masteredCount: masteredIds.size,
        lastNote,
      }),
    };
  }
}
