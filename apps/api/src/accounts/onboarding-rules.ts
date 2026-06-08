/**
 * Règles d'inscription (PURES). Un mineur n'est PAS bridé, mais l'email du
 * responsable légal est requis (consentement « email plus », façon Pronote).
 */
export interface OnboardingInput {
  email: string;
  isMinor: boolean;
  guardianEmail?: string | null;
}

export function requiresGuardian(isMinor: boolean): boolean {
  return isMinor;
}

/** Renvoie la liste des problèmes (vide = valide). */
export function onboardingErrors(input: OnboardingInput): string[] {
  const errors: string[] = [];
  if (input.isMinor && !input.guardianEmail) {
    errors.push('email du responsable légal requis pour un compte mineur');
  }
  return errors;
}
