import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  computeWeeklyPlanning,
  nextPrescribedSkill,
  type PlanningOutput,
} from '@dowze/core';
import type { Slot } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { availabilitySlots, sm2Cards, masteryStates, planningEntries } from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { buildPlanningItems } from './planning-items';

@Injectable()
export class PlanningService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
  ) {}

  /**
   * Génère le planning d'une semaine : révisions dues (SM-2) + prochaine
   * compétence prescrite, agencées dans les créneaux (déterministe via core).
   */
  async generateWeek(
    profileId: string,
    weekStartIso: string,
    nowIso: string,
  ): Promise<PlanningOutput> {
    const slotRows = await this.db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.profileId, profileId));
    const slots: Slot[] = slotRows.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startMinute: r.startMinute,
      durationMin: r.durationMin,
    }));

    const now = new Date(nowIso);
    const cards = await this.db.select().from(sm2Cards).where(eq(sm2Cards.profileId, profileId));
    const dueSkillIds = cards
      .filter((c) => c.dueDate === null || c.dueDate <= now)
      .map((c) => c.skillId);

    const mastery = await this.db
      .select()
      .from(masteryStates)
      .where(eq(masteryStates.profileId, profileId));
    const masteredIds = new Set(mastery.filter((m) => m.pMastery >= 0.95).map((m) => m.skillId));

    const skills = await this.graph.loadGraph();
    const next = nextPrescribedSkill(skills, masteredIds);

    const items = buildPlanningItems({ dueSkillIds, nextSkillId: next?.id ?? null });
    const output = computeWeeklyPlanning({
      profileId,
      weekStartIso,
      slots,
      items,
      idFactory: () => randomUUID(),
    });

    if (output.entries.length > 0) {
      await this.db.insert(planningEntries).values(
        output.entries.map((e) => ({
          id: e.id,
          profileId: e.profileId,
          date: new Date(e.dateIso),
          kind: e.kind,
          skillId: e.skillId,
          expeditionId: e.expeditionId,
          durationMin: e.durationMin,
          status: e.status,
        })),
      );
    }
    return output;
  }
}
