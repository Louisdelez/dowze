import { describe, it, expect } from 'vitest';
import { decideEscalation } from './moderation-policy';

describe('politique de modération', () => {
  it('incident faible : ni revue humaine ni alerte', () => {
    const d = decideEscalation({ severity: 'faible', authorIsMinor: true, victimIsMinor: false });
    expect(d.humanReview).toBe(false);
    expect(d.alertParent).toBe(false);
  });

  it('incident moyen : revue humaine, pas d’alerte', () => {
    const d = decideEscalation({ severity: 'moyen', authorIsMinor: true, victimIsMinor: false });
    expect(d.humanReview).toBe(true);
    expect(d.alertParent).toBe(false);
  });

  it('incident grave avec mineur victime : revue + alerte parent', () => {
    const d = decideEscalation({ severity: 'grave', authorIsMinor: false, victimIsMinor: true });
    expect(d.humanReview).toBe(true);
    expect(d.alertParent).toBe(true);
  });

  it('incident critique sans mineur : revue, pas d’alerte', () => {
    const d = decideEscalation({ severity: 'critique', authorIsMinor: false, victimIsMinor: false });
    expect(d.humanReview).toBe(true);
    expect(d.alertParent).toBe(false);
  });
});
