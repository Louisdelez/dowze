import type { ExpeditionPhase } from '@dowze/schemas';

/**
 * Cycle de vie d'une Expédition (PUR) : le gabarit
 * **Étincelle → Question → Défi → Acte → Trace** (cf. le Cursus).
 */
export const EXPEDITION_PHASES: readonly ExpeditionPhase[] = [
  'etincelle',
  'question',
  'defi',
  'acte',
  'trace',
] as const;

/** Phase suivante (reste sur `trace` si déjà à la fin). */
export function advancePhase(phase: ExpeditionPhase): ExpeditionPhase {
  const i = EXPEDITION_PHASES.indexOf(phase);
  if (i < 0 || i >= EXPEDITION_PHASES.length - 1) return 'trace';
  return EXPEDITION_PHASES[i + 1] as ExpeditionPhase;
}

/** Avancement : index courant (0-based) et total. */
export function phaseProgress(phase: ExpeditionPhase): { index: number; total: number } {
  const i = EXPEDITION_PHASES.indexOf(phase);
  return { index: i < 0 ? 0 : i, total: EXPEDITION_PHASES.length };
}

/** L'expédition est terminée quand elle atteint la Trace. */
export function isComplete(phase: ExpeditionPhase): boolean {
  return phase === 'trace';
}
