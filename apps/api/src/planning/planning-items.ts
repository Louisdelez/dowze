import type { PlanningItem } from '@dowze/core';

/**
 * Construit la liste priorisée des tâches d'une semaine (PURE, testable) :
 * d'abord les **révisions dues** (SM-2), puis la **prochaine compétence prescrite**.
 */
export interface BuildItemsInput {
  dueSkillIds: readonly string[];
  nextSkillId: string | null;
  reviewMin?: number;
  learnMin?: number;
}

export function buildPlanningItems(input: BuildItemsInput): PlanningItem[] {
  const reviewMin = input.reviewMin ?? 15;
  const learnMin = input.learnMin ?? 25;

  const items: PlanningItem[] = input.dueSkillIds.map((skillId) => ({
    kind: 'revision',
    skillId,
    durationMin: reviewMin,
  }));

  if (input.nextSkillId) {
    items.push({ kind: 'apprentissage', skillId: input.nextSkillId, durationMin: learnMin });
  }

  return items;
}
