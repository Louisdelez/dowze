import { describe, it, expect } from 'vitest';
import type { Rubric, Validation } from '@dowze/schemas';
import {
  evaluateAgainstRubric,
  aggregatePeerReviews,
  badgeLevel,
  unblocksProgression,
} from './tier';

const SKILL = '11111111-1111-4111-8111-111111111111';

const rubric: Rubric = {
  skillId: SKILL,
  criteria: [
    { id: 'critere-1', label: 'C1', description: '', required: true },
    { id: 'critere-2', label: 'C2', description: '', required: true },
    { id: 'critere-3', label: 'C3 (indicatif)', description: '', required: false },
  ],
};

function peer(passed: boolean): Validation {
  return {
    id: SKILL,
    skillId: SKILL,
    learnerId: SKILL,
    tier: 'pair',
    reviewerId: SKILL,
    verdicts: [],
    passed,
    evidenceUrl: null,
    createdAtIso: '2026-06-08T10:00:00.000Z',
  };
}

describe('validation par paliers', () => {
  it('grille : passe si tous les critères requis sont acquis', () => {
    expect(
      evaluateAgainstRubric(rubric, [
        { criterionId: 'critere-1', met: true, comment: '' },
        { criterionId: 'critere-2', met: true, comment: '' },
      ]),
    ).toBe(true);
  });

  it('grille : échoue si un critère requis manque', () => {
    expect(
      evaluateAgainstRubric(rubric, [{ criterionId: 'critere-1', met: true, comment: '' }]),
    ).toBe(false);
  });

  it('pairs : exige ≥ 2 reviewers et une majorité stricte', () => {
    expect(aggregatePeerReviews([peer(true)]).passed).toBe(false); // 1 seul
    expect(aggregatePeerReviews([peer(true), peer(true)]).passed).toBe(true);
    expect(aggregatePeerReviews([peer(true), peer(false)]).passed).toBe(false); // égalité
    expect(aggregatePeerReviews([peer(true), peer(true), peer(false)]).passed).toBe(true);
  });

  it('consensus = unanimité', () => {
    expect(aggregatePeerReviews([peer(true), peer(true)]).consensus).toBe(true);
    expect(aggregatePeerReviews([peer(true), peer(false)]).consensus).toBe(false);
  });

  it('niveau de badge selon les paliers', () => {
    expect(badgeLevel({ peerPassed: false, expertEndorsed: false })).toBe('auto-declare');
    expect(badgeLevel({ peerPassed: true, expertEndorsed: false })).toBe('valide-par-pair');
    expect(badgeLevel({ peerPassed: true, expertEndorsed: true })).toBe('endosse-expert');
  });

  it('une validation réussie débloque la progression', () => {
    expect(unblocksProgression(peer(true))).toBe(true);
    expect(unblocksProgression(peer(false))).toBe(false);
  });
});
