import { describe, it, expect } from 'vitest';
import { onboardingErrors, requiresGuardian } from './onboarding-rules';

describe('règles d’inscription', () => {
  it('un mineur exige l’email du responsable', () => {
    expect(requiresGuardian(true)).toBe(true);
    expect(onboardingErrors({ email: 'a@b.co', isMinor: true })).toHaveLength(1);
    expect(onboardingErrors({ email: 'a@b.co', isMinor: true, guardianEmail: 'p@b.co' })).toEqual([]);
  });

  it('un majeur n’a pas besoin de responsable', () => {
    expect(requiresGuardian(false)).toBe(false);
    expect(onboardingErrors({ email: 'a@b.co', isMinor: false })).toEqual([]);
  });
});
