import type { Skill } from '@dowze/schemas';

/**
 * La « frontière d'apprentissage » : à partir des compétences déjà maîtrisées,
 * quelles compétences peut-on apprendre maintenant (tous leurs prérequis sont
 * acquis) ? C'est la base de la **prescription** du Cursus (l'élève ne choisit pas).
 */

/** Compétences non encore maîtrisées dont TOUS les prérequis sont maîtrisés. */
export function learnableSkills(
  skills: readonly Skill[],
  masteredIds: ReadonlySet<string>,
): Skill[] {
  return skills.filter(
    (s) => !masteredIds.has(s.id) && s.prerequisites.every((p) => masteredIds.has(p)),
  );
}

/**
 * La prochaine compétence prescrite : la plus « basse » dans le graphe
 * (profondeur minimale, puis ordre de slug pour le déterminisme).
 */
export function nextPrescribedSkill(
  skills: readonly Skill[],
  masteredIds: ReadonlySet<string>,
): Skill | null {
  const candidates = learnableSkills(skills, masteredIds).sort(
    (a, b) => a.depth - b.depth || a.slug.localeCompare(b.slug),
  );
  return candidates[0] ?? null;
}
