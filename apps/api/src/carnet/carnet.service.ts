import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
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
