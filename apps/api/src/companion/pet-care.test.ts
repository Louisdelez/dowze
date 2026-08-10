import { describe, expect, it } from 'vitest';
import { contextualMood } from './pet-care.service';

const healthy = { satiety: 60, happiness: 60, energy: 55, hygiene: 60, health: 80 };

describe('humeur contextuelle', () => {
  it('laisse les besoins critiques prioritaires sur le contexte', () => {
    expect(
      contextualMood({ ...healthy, satiety: 10 }, new Date('2026-08-07T12:00:00Z'), 'sunny'),
    ).toBe('affame');
  });

  it('rend le vendredi et le soleil positifs sans modifier les jauges', () => {
    expect(contextualMood(healthy, new Date('2026-08-07T12:00:00Z'))).toBe('heureux');
    expect(contextualMood(healthy, new Date('2026-08-06T12:00:00Z'), 'sunny')).toBe('heureux');
  });

  it('peut refléter pluie et fin de dimanche lorsque le moral est moyen', () => {
    const average = { ...healthy, happiness: 50, energy: 65 };
    expect(contextualMood(average, new Date('2026-08-06T12:00:00Z'), 'rain')).toBe('triste');
    expect(contextualMood(average, new Date('2026-08-09T18:30:00Z'))).toBe('triste');
  });
});
