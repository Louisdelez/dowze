import { describe, it, expect } from 'vitest';
import type { Validation } from '@dowze/schemas';
import { summarizeValidations } from './validation-logic';

const S = '11111111-1111-4111-8111-111111111111';

function v(tier: Validation['tier'], passed: boolean): Validation {
  return {
    id: S,
    skillId: S,
    learnerId: S,
    tier,
    reviewerId: S,
    verdicts: [],
    passed,
    evidenceUrl: null,
    createdAtIso: '2026-06-08T10:00:00.000Z',
  };
}

describe('synthèse des validations → badge', () => {
  it('auto-déclaré sans validation par les pairs', () => {
    const s = summarizeValidations([v('auto', true)]);
    expect(s.badge).toBe('auto-declare');
    expect(s.peerPassed).toBe(false);
  });

  it('validé par les pairs avec 2 avis positifs', () => {
    const s = summarizeValidations([v('pair', true), v('pair', true)]);
    expect(s.peerPassed).toBe(true);
    expect(s.badge).toBe('valide-par-pair');
    expect(s.reviewerCount).toBe(2);
  });

  it('endossé expert prime sur les pairs', () => {
    const s = summarizeValidations([v('pair', true), v('pair', true), v('expert', true)]);
    expect(s.badge).toBe('endosse-expert');
    expect(s.expertEndorsed).toBe(true);
  });
});
