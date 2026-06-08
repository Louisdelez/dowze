import { Inject, Injectable } from '@nestjs/common';
import { computePlacement, type Placement } from '@dowze/core';
import { DB, type Database } from '../db/drizzle.module';
import { masteryStates } from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';

@Injectable()
export class DiagnosticService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
  ) {}

  /** Place l'élève sur le Cursus et enregistre les compétences déjà maîtrisées. */
  async run(
    profileId: string,
    demonstratedSkillIds: string[],
    nowIso: string,
  ): Promise<Placement> {
    const skills = await this.graph.loadGraph();
    const placement = computePlacement(skills, demonstratedSkillIds);

    if (placement.masteredSkillIds.length > 0) {
      await this.db
        .insert(masteryStates)
        .values(
          placement.masteredSkillIds.map((skillId) => ({
            profileId,
            skillId,
            pMastery: 1,
            attempts: 1,
            correct: 1,
            lastUpdated: new Date(nowIso),
          })),
        )
        .onConflictDoNothing();
    }
    return placement;
  }
}
