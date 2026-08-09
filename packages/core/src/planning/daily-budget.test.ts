import { describe, it, expect } from 'vitest';
import { dailyBudget } from './daily-budget';

describe('dailyBudget', () => {
  it('donne des minutes croissantes avec l’âge pour la langue', () => {
    expect(dailyBudget(9).blocks.find((b) => b.key === 'language')!.minutes).toBe(15);
    expect(dailyBudget(14).blocks.find((b) => b.key === 'language')!.minutes).toBe(20);
    expect(dailyBudget(30).blocks.find((b) => b.key === 'language')!.minutes).toBe(28);
  });

  it('marque la langue comme protégée et la passion comme plafonnée', () => {
    const b = dailyBudget(14);
    expect(b.blocks.find((x) => x.key === 'language')!.protectedBlock).toBe(true);
    expect(b.blocks.find((x) => x.key === 'secondary')!.capped).toBe(true);
  });

  it('retire le bloc passion si non choisi', () => {
    const b = dailyBudget(14, false);
    expect(b.blocks.some((x) => x.key === 'secondary')).toBe(false);
  });

  it('le cœur académique (cours + expéditions) reste ≈ 60-70 %', () => {
    const b = dailyBudget(14);
    const core = b.blocks.filter((x) => x.key === 'courses' || x.key === 'expeditions').reduce((s, x) => s + x.pct, 0);
    expect(core).toBeGreaterThanOrEqual(58);
    expect(core).toBeLessThanOrEqual(72);
  });

  it('les pourcentages somment à ~100', () => {
    const total = dailyBudget(9).blocks.reduce((s, x) => s + x.pct, 0);
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(2);
  });
});
