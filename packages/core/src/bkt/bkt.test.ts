import { describe, it, expect } from 'vitest';
import type { BktParams } from '@dowze/schemas';
import { initialMastery, updateMastery, isMastered, posteriorGivenObservation } from './bkt';

const params: BktParams = { pInit: 0.1, pTransit: 0.3, pSlip: 0.1, pGuess: 0.2 };
const SKILL = '11111111-1111-4111-8111-111111111111';
const ISO = '2026-06-08T10:00:00.000Z';

describe('BKT', () => {
  it('démarre à pInit', () => {
    expect(initialMastery(SKILL, params).pMastery).toBe(0.1);
  });

  it('une réussite augmente la maîtrise', () => {
    const s0 = initialMastery(SKILL, params);
    const s1 = updateMastery(s0, params, true, ISO);
    expect(s1.pMastery).toBeGreaterThan(s0.pMastery);
    expect(s1.attempts).toBe(1);
    expect(s1.correct).toBe(1);
  });

  it('un échec diminue la maîtrise (vs une réussite)', () => {
    const s0 = { skillId: SKILL, pMastery: 0.6, attempts: 0, correct: 0, lastUpdatedIso: null };
    const win = updateMastery(s0, params, true, ISO);
    const lose = updateMastery(s0, params, false, ISO);
    expect(lose.pMastery).toBeLessThan(win.pMastery);
    expect(lose.correct).toBe(0);
  });

  it('la maîtrise reste dans [0,1] et converge vers le seuil après des réussites', () => {
    let s = initialMastery(SKILL, params);
    for (let i = 0; i < 8; i++) s = updateMastery(s, params, true, ISO);
    expect(s.pMastery).toBeGreaterThan(0);
    expect(s.pMastery).toBeLessThanOrEqual(1);
    expect(isMastered(s, 0.95)).toBe(true);
  });

  it('posterior(correct) > posterior(incorrect) pour une même prior', () => {
    const c = posteriorGivenObservation(0.5, params, true);
    const w = posteriorGivenObservation(0.5, params, false);
    expect(c).toBeGreaterThan(w);
  });
});
