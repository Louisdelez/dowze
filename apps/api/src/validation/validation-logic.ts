import { aggregatePeerReviews, badgeLevel } from '@dowze/core';
import type { Validation, BadgeLevel } from '@dowze/schemas';

/**
 * Synthèse des paliers de validation d'une compétence pour un apprenant (PURE).
 * S'appuie sur @dowze/core (agrégation des pairs + niveau de badge).
 */
export interface BadgeSummary {
  badge: BadgeLevel;
  peerPassed: boolean;
  expertEndorsed: boolean;
  reviewerCount: number;
}

export function summarizeValidations(validations: readonly Validation[]): BadgeSummary {
  const peer = aggregatePeerReviews(validations);
  const expertEndorsed = validations.some((v) => v.tier === 'expert' && v.passed);
  return {
    badge: badgeLevel({ peerPassed: peer.passed, expertEndorsed }),
    peerPassed: peer.passed,
    expertEndorsed,
    reviewerCount: peer.reviewerCount,
  };
}
