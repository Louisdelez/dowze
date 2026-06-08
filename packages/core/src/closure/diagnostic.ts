import type { Skill } from '@dowze/schemas';
import { buildSkillMap, computeClosure } from './graph';
import { nextPrescribedSkill } from './frontier';

/**
 * Diagnostic / placement (PUR). À partir des compétences que l'élève **démontre**
 * déjà, on en déduit son placement sur le Cursus : démontrer une compétence
 * implique que toute sa chaîne de prérequis est maîtrisée (clôture). On en
 * déduit la première compétence prescrite.
 */
export interface Placement {
  masteredSkillIds: string[];
  entrySkillId: string | null;
}

export function computePlacement(
  skills: readonly Skill[],
  demonstratedIds: readonly string[],
): Placement {
  const map = buildSkillMap(skills);
  const mastered = new Set<string>();
  for (const id of demonstratedIds) {
    if (!map.has(id)) continue;
    mastered.add(id);
    for (const prerequisite of computeClosure(id, map).prerequisites) {
      mastered.add(prerequisite);
    }
  }
  const entry = nextPrescribedSkill(skills, mastered);
  return { masteredSkillIds: [...mastered], entrySkillId: entry?.id ?? null };
}
