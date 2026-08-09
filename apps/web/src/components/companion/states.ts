/**
 * Le Compagnon Dowze — catalogue d'états + micro-copie française (non-punitive, ≤ 6 mots, tutoiement).
 * Plusieurs variantes par état : on en pioche une différente à chaque fois (anti-effet robot).
 * Cf. docs/13-COMPAGNON.
 */

export type CompanionState =
  | 'idle'
  | 'reading'
  | 'thinking'
  | 'preparing'
  | 'organizing'
  | 'almost'
  | 'done'
  | 'ask'
  | 'retry'
  | 'error'
  | 'offline';

/** Micro-copie par état (variantes tournantes). */
export const MICROCOPY: Record<CompanionState, string[]> = {
  idle: ['Je suis là.', 'Quand tu veux, on continue.'],
  reading: ['Je lis ce que tu as écrit…', 'Je regarde ta réponse…', 'Voyons voir…'],
  thinking: ['Je réfléchis…', 'Hmm, laisse-moi réfléchir…', 'Je cherche la meilleure idée…'],
  preparing: ['Je prépare ça pour toi…', 'Je note ça…', 'J’organise mes idées…'],
  organizing: ['J’organise ton planning…', 'Je range tout ça…'],
  almost: ['Presque fini !', 'Encore une seconde…', 'J’y suis presque…'],
  done: ['Voilà !', 'C’est prêt, regarde !', 'Terminé.'],
  ask: ['Je peux te demander un truc ?', 'J’ai une petite question…'],
  retry: ['Presque ! On réessaie ?', 'Pas grave, on réessaie ensemble.'],
  error: ['Oups, un petit souci de mon côté.', 'Je n’ai pas réussi cette fois. On réessaie ?'],
  offline: ['Je n’arrive pas à me connecter.', 'On dirait qu’il n’y a plus de réseau.'],
};

/**
 * Politesse ARIA + comportement de la bulle par état.
 * - `alert`  → région assertive (vraies erreurs uniquement).
 * - `status` → région polie (le reste).
 * - `talks`  → la bulle s'affiche automatiquement (sinon silencieux, ex. idle).
 */
export const STATE_META: Record<CompanionState, { politeness: 'status' | 'alert'; talks: boolean }> = {
  idle: { politeness: 'status', talks: false },
  reading: { politeness: 'status', talks: true },
  thinking: { politeness: 'status', talks: true },
  preparing: { politeness: 'status', talks: true },
  organizing: { politeness: 'status', talks: true },
  almost: { politeness: 'status', talks: true },
  done: { politeness: 'status', talks: true },
  ask: { politeness: 'status', talks: true },
  retry: { politeness: 'status', talks: true },
  error: { politeness: 'alert', talks: true },
  offline: { politeness: 'alert', talks: true },
};

const counters: Partial<Record<CompanionState, number>> = {};

/** Pioche une variante de micro-copie pour l'état (rotation déterministe, sans Math.random). */
export function pickMessage(state: CompanionState): string {
  const variants = MICROCOPY[state];
  const i = (counters[state] ?? 0) % variants.length;
  counters[state] = (counters[state] ?? 0) + 1;
  return variants[i] as string;
}
