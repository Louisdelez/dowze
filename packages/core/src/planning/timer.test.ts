import { describe, it, expect } from 'vitest';
import { segmentAt, isBoundary } from './timer';

const config = { focusMin: 25, breakMin: 5 }; // période = 1800 s

describe('cycle de minuteur', () => {
  it('commence en focus', () => {
    const s = segmentAt(config, 0);
    expect(s.mode).toBe('focus');
    expect(s.remainingSec).toBe(1500);
  });

  it('passe en pause après la phase de focus', () => {
    const s = segmentAt(config, 25 * 60 + 10);
    expect(s.mode).toBe('break');
    expect(s.remainingSec).toBe(5 * 60 - 10);
  });

  it('repart en focus au cycle suivant', () => {
    const s = segmentAt(config, 30 * 60 + 5);
    expect(s.mode).toBe('focus');
    expect(s.cycle).toBe(1);
  });

  it('détecte les bascules (sonnerie)', () => {
    expect(isBoundary(config, 0)).toBe(false);
    expect(isBoundary(config, 25 * 60)).toBe(true); // focus → pause
    expect(isBoundary(config, 30 * 60)).toBe(true); // pause → focus
    expect(isBoundary(config, 10)).toBe(false);
  });
});
