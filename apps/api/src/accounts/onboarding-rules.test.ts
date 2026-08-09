import { describe, it, expect } from 'vitest';
import {
  onboardingErrors,
  guardianEmailRequired,
  tierFromBirthDate,
  isMinorFromBirthDate,
  ageInYears,
} from './onboarding-rules';

const NOW = '2026-07-19T00:00:00.000Z';

describe('règles d’inscription (déduites de la date de naissance)', () => {
  it('calcule l’âge en années révolues', () => {
    expect(ageInYears('2010-07-19', NOW)).toBe(16);
    expect(ageInYears('2010-07-20', NOW)).toBe(15); // anniversaire pas encore atteint
    expect(ageInYears(null, NOW)).toBeNull();
  });

  it('mineur = moins de 18 ans', () => {
    expect(isMinorFromBirthDate('2015-01-01', NOW)).toBe(true);
    expect(isMinorFromBirthDate('2000-01-01', NOW)).toBe(false);
  });

  it('tout mineur (< 18 ans) exige l’email d’un parent', () => {
    expect(guardianEmailRequired('2015-01-01', NOW)).toBe(true); // 11 ans
    expect(guardianEmailRequired('2009-01-01', NOW)).toBe(true); // 17 ans
    expect(onboardingErrors({ isMinor: true, birthDate: '2009-01-01' }, NOW)).toHaveLength(1);
    expect(
      onboardingErrors({ isMinor: true, birthDate: '2009-01-01', guardianEmail: 'p@b.co' }, NOW),
    ).toEqual([]);
  });

  it('un majeur n’a pas besoin de parent (email optionnel)', () => {
    expect(guardianEmailRequired('2000-01-01', NOW)).toBe(false);
    expect(onboardingErrors({ isMinor: false, birthDate: '2000-01-01' }, NOW)).toEqual([]);
  });

  it('paliers d’âge : enfant < 13 / mineur 13-17 / majeur 18+', () => {
    expect(tierFromBirthDate('2015-01-01', NOW)).toBe('enfant'); // 11 ans
    expect(tierFromBirthDate('2011-01-01', NOW)).toBe('mineur'); // 15 ans
    expect(tierFromBirthDate('2000-01-01', NOW)).toBe('majeur'); // 26 ans
    expect(tierFromBirthDate(null, NOW)).toBe('majeur');
  });
});
