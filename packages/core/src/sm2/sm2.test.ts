import { describe, it, expect } from 'vitest';
import { initialCard, review, isDue } from './sm2';

const SKILL = '11111111-1111-4111-8111-111111111111';
const ISO = '2026-06-08T10:00:00.000Z';

describe('SM-2', () => {
  it('carte neuve : due immédiatement', () => {
    expect(isDue(initialCard(SKILL), ISO)).toBe(true);
  });

  it('progression des intervalles 1 → 6 → ×EF pour de bonnes réponses', () => {
    const r1 = review(initialCard(SKILL), 5, ISO);
    expect(r1.intervalDays).toBe(1);
    expect(r1.repetitions).toBe(1);

    const r2 = review(r1, 5, r1.dueDateIso as string);
    expect(r2.intervalDays).toBe(6);
    expect(r2.repetitions).toBe(2);

    const r3 = review(r2, 5, r2.dueDateIso as string);
    expect(r3.intervalDays).toBeGreaterThan(6);
    expect(r3.repetitions).toBe(3);
  });

  it('un échec (q<3) réinitialise les répétitions et programme J+1', () => {
    const good = review(review(initialCard(SKILL), 5, ISO), 4, ISO);
    const fail = review(good, 1, ISO);
    expect(fail.repetitions).toBe(0);
    expect(fail.intervalDays).toBe(1);
  });

  it('le facteur de facilité ne descend jamais sous 1.3', () => {
    let card = initialCard(SKILL);
    for (let i = 0; i < 10; i++) card = review(card, 0, ISO);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('after review, due date is in the future', () => {
    const r = review(initialCard(SKILL), 5, ISO);
    expect(isDue(r, ISO)).toBe(false);
    expect(new Date(r.dueDateIso as string).getTime()).toBeGreaterThan(new Date(ISO).getTime());
  });
});
