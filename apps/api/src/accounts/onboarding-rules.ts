/**
 * Règles d'inscription (PURES). Le statut « mineur » n'est plus une case à
 * cocher : il se **déduit de la date de naissance**. Un mineur n'est pas bridé,
 * mais l'email du responsable légal est requis en dessous du seuil de
 * consentement numérique (France : 15 ans, cf. CNIL).
 */

/** Seuil légal du « mineur » (droit commun). */
export const MINOR_AGE = 18;
/** Seuil de consentement numérique en France : en dessous, accord parental requis. */
export const PARENTAL_CONSENT_AGE = 15;
/** Palier « enfant » : en dessous, régime le plus strict (double validation parentale). */
export const CHILD_MAX_AGE = 12; // enfant si âge <= 12 (donc < 13)

export type AgeTier = 'enfant' | 'mineur' | 'majeur';

/** Palier d'âge : enfant (<13) / mineur (13-17) / majeur (18+). Âge inconnu → majeur (défaut). */
export function tierFromBirthDate(birthDate: string | null | undefined, nowIso: string): AgeTier {
  const age = ageInYears(birthDate, nowIso);
  if (age === null) return 'majeur';
  if (age <= CHILD_MAX_AGE) return 'enfant';
  if (age < MINOR_AGE) return 'mineur';
  return 'majeur';
}

/** L'email d'un parent/responsable est-il OBLIGATOIRE ? (tout mineur < 18 ans). */
export function guardianEmailRequired(birthDate: string | null | undefined, nowIso: string): boolean {
  const age = ageInYears(birthDate, nowIso);
  return age !== null && age < MINOR_AGE;
}

export interface OnboardingInput {
  isMinor: boolean;
  guardianEmail?: string | null;
  birthDate?: string | null;
}

/** Âge en années révolues à la date `nowIso`, ou null si date invalide/absente. */
export function ageInYears(birthDate: string | null | undefined, nowIso: string): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  const now = new Date(nowIso);
  if (Number.isNaN(born.getTime()) || Number.isNaN(now.getTime())) return null;
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const m = now.getUTCMonth() - born.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

/** Mineur au sens du droit commun (< 18 ans). */
export function isMinorFromBirthDate(birthDate: string | null | undefined, nowIso: string): boolean {
  const age = ageInYears(birthDate, nowIso);
  return age !== null && age < MINOR_AGE;
}

/** Le consentement parental (email du responsable) est-il requis ? (< 15 ans FR). */
export function requiresGuardian(birthDate: string | null | undefined, nowIso: string): boolean {
  const age = ageInYears(birthDate, nowIso);
  return age !== null && age < PARENTAL_CONSENT_AGE;
}

/** Renvoie la liste des problèmes (vide = valide). */
export function onboardingErrors(input: OnboardingInput, nowIso: string): string[] {
  const errors: string[] = [];
  if (guardianEmailRequired(input.birthDate, nowIso) && !input.guardianEmail) {
    errors.push('email d’un parent/responsable requis pour un compte de moins de 18 ans');
  }
  return errors;
}
