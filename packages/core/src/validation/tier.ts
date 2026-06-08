import type { Rubric, Validation, CriterionVerdict, BadgeLevel } from '@dowze/schemas';

/**
 * Validation par paliers, modèle École 42 (cf. docs/10-APP-WEB/09-validation.md).
 * - Auto-validation : factuelle, **débloque** la suite (non bloquante).
 * - Validation par les pairs : plus forte, en file, **non bloquante**.
 * - Endossement expert : option, le plus fort.
 */

/** Une soumission passe la grille si tous les critères *requis* sont acquis. */
export function evaluateAgainstRubric(
  rubric: Rubric,
  verdicts: readonly CriterionVerdict[],
): boolean {
  const met = new Map(verdicts.map((v) => [v.criterionId, v.met]));
  return rubric.criteria.filter((c) => c.required).every((c) => met.get(c.id) === true);
}

export interface PeerAggregation {
  reviewerCount: number;
  /** Validé : au moins 2 pairs ET majorité stricte de « réussi ». */
  passed: boolean;
  /** Consensus : unanimité des pairs (tous d'accord). */
  consensus: boolean;
}

/** Agrège les revues de pairs (≥ 2 reviewers, majorité stricte). */
export function aggregatePeerReviews(reviews: readonly Validation[]): PeerAggregation {
  const peers = reviews.filter((r) => r.tier === 'pair');
  const count = peers.length;
  const yes = peers.filter((r) => r.passed).length;
  return {
    reviewerCount: count,
    passed: count >= 2 && yes * 2 > count,
    consensus: count >= 2 && (yes === count || yes === 0),
  };
}

/** Le niveau de badge (Open Badges) selon les paliers atteints. */
export function badgeLevel(opts: {
  peerPassed: boolean;
  expertEndorsed: boolean;
}): BadgeLevel {
  if (opts.expertEndorsed) return 'endosse-expert';
  if (opts.peerPassed) return 'valide-par-pair';
  return 'auto-declare';
}

/**
 * L'auto-validation réussie **débloque** la progression (non bloquante).
 * Les paliers supérieurs renforcent la confiance sans bloquer.
 */
export function unblocksProgression(validation: Validation): boolean {
  return validation.passed;
}
