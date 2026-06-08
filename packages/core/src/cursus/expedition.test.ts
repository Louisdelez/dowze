import { describe, it, expect } from 'vitest';
import { EXPEDITION_PHASES, advancePhase, phaseProgress, isComplete } from './expedition';

describe('cycle d’expédition', () => {
  it('a 5 phases dans l’ordre du gabarit', () => {
    expect(EXPEDITION_PHASES).toEqual(['etincelle', 'question', 'defi', 'acte', 'trace']);
  });

  it('avance phase par phase', () => {
    expect(advancePhase('etincelle')).toBe('question');
    expect(advancePhase('defi')).toBe('acte');
    expect(advancePhase('acte')).toBe('trace');
  });

  it('reste sur trace à la fin', () => {
    expect(advancePhase('trace')).toBe('trace');
    expect(isComplete('trace')).toBe(true);
    expect(isComplete('acte')).toBe(false);
  });

  it('rend l’avancement', () => {
    expect(phaseProgress('etincelle')).toEqual({ index: 0, total: 5 });
    expect(phaseProgress('trace')).toEqual({ index: 4, total: 5 });
  });
});
