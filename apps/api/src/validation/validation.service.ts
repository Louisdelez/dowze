import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { evaluateAgainstRubric } from '@dowze/core';
import type { Rubric, CriterionVerdict, Validation } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  rubrics,
  rubricCriteria,
  validations,
  validationVerdicts,
  peerReviewQueue,
} from '../db/schema';
import { summarizeValidations, type BadgeSummary } from './validation-logic';

type ValidationRow = typeof validations.$inferSelect;

function toValidation(row: ValidationRow): Validation {
  return {
    id: row.id,
    skillId: row.skillId,
    learnerId: row.learnerId,
    tier: row.tier as Validation['tier'],
    reviewerId: row.reviewerId,
    verdicts: [],
    passed: row.passed,
    evidenceUrl: row.evidenceUrl,
    createdAtIso: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ValidationService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** La grille (rubrique) d'une compétence. */
  async getRubric(skillId: string): Promise<Rubric | null> {
    const head = await this.db.select().from(rubrics).where(eq(rubrics.skillId, skillId));
    if (!head[0]) return null;
    const criteria = await this.db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.skillId, skillId));
    return {
      skillId,
      criteria: criteria.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
        required: c.required,
      })),
    };
  }

  /**
   * Auto-validation : si la grille passe, on enregistre la validation (palier
   * `auto`, qui **débloque** la suite) et on place la compétence en file de
   * revue par les pairs (non bloquant).
   */
  async selfValidate(
    profileId: string,
    skillId: string,
    verdicts: CriterionVerdict[],
  ): Promise<{ passed: boolean }> {
    const rubric = await this.getRubric(skillId);
    if (!rubric) throw new NotFoundException(`grille introuvable pour ${skillId}`);

    const passed = evaluateAgainstRubric(rubric, verdicts);
    const inserted = await this.db
      .insert(validations)
      .values({ skillId, learnerId: profileId, tier: 'auto', passed })
      .returning({ id: validations.id });

    const validationId = inserted[0]?.id;
    if (validationId && verdicts.length > 0) {
      await this.db.insert(validationVerdicts).values(
        verdicts.map((v) => ({
          validationId,
          criterionId: v.criterionId,
          met: v.met,
          comment: v.comment,
        })),
      );
    }
    if (passed) {
      await this.db.insert(peerReviewQueue).values({ skillId, learnerId: profileId });
    }
    return { passed };
  }

  /** Une revue par un pair (palier `pair`, plus fort, non bloquant). */
  async peerReview(
    reviewerId: string,
    learnerId: string,
    skillId: string,
    passed: boolean,
  ): Promise<{ ok: true }> {
    await this.db
      .insert(validations)
      .values({ skillId, learnerId, tier: 'pair', reviewerId, passed });
    return { ok: true };
  }

  /** Le niveau de badge atteint (auto / pair / expert). */
  async badge(skillId: string, learnerId: string): Promise<BadgeSummary> {
    const rows = await this.db
      .select()
      .from(validations)
      .where(and(eq(validations.skillId, skillId), eq(validations.learnerId, learnerId)));
    return summarizeValidations(rows.map(toValidation));
  }
}
