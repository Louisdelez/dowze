import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { advancePhase } from '@dowze/core';
import type { ExpeditionPhase } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { expeditions, expeditionSkills } from '../db/schema';

export interface CreateExpeditionInput {
  slug: string;
  title: string;
  grandeQuestion: string;
  durationWeeks: number;
  skillIds?: string[];
}

@Injectable()
export class ExpeditionsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list() {
    return this.db.select().from(expeditions);
  }

  async get(id: string) {
    const rows = await this.db.select().from(expeditions).where(eq(expeditions.id, id));
    const expedition = rows[0];
    if (!expedition) throw new NotFoundException(`expédition ${id} introuvable`);
    const skills = await this.db
      .select()
      .from(expeditionSkills)
      .where(eq(expeditionSkills.expeditionId, id));
    return { ...expedition, skillIds: skills.map((s) => s.skillId) };
  }

  async create(input: CreateExpeditionInput) {
    const inserted = await this.db
      .insert(expeditions)
      .values({
        slug: input.slug,
        title: input.title,
        grandeQuestion: input.grandeQuestion,
        durationWeeks: input.durationWeeks,
      })
      .returning();
    const expedition = inserted[0];
    if (!expedition) throw new Error('échec de création de l’expédition');
    if (input.skillIds?.length) {
      await this.db
        .insert(expeditionSkills)
        .values(input.skillIds.map((skillId) => ({ expeditionId: expedition.id, skillId })))
        .onConflictDoNothing();
    }
    return expedition;
  }

  /** Avance l'expédition à la phase suivante (Étincelle→…→Trace). */
  async advance(id: string) {
    const current = await this.get(id);
    const next = advancePhase(current.phase as ExpeditionPhase);
    const status = next === 'trace' ? 'terminee' : 'en-cours';
    await this.db.update(expeditions).set({ phase: next, status }).where(eq(expeditions.id, id));
    return { id, phase: next, status };
  }
}
