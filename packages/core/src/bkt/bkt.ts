import type { BktParams, MasteryState } from '@dowze/schemas';
import { clamp01 } from '../util/math';

/**
 * Bayesian Knowledge Tracing (BKT).
 * Met à jour la probabilité de maîtrise p(L) à partir d'observations
 * (réussite/échec), de façon déterministe et sans IA.
 */

/** État initial : p(L0) = pInit. */
export function initialMastery(skillId: string, params: BktParams): MasteryState {
  return { skillId, pMastery: params.pInit, attempts: 0, correct: 0, lastUpdatedIso: null };
}

/**
 * Probabilité a posteriori que la compétence soit maîtrisée, **sachant**
 * l'observation, avant d'intégrer l'apprentissage de ce tour.
 */
export function posteriorGivenObservation(
  pMastery: number,
  params: BktParams,
  correct: boolean,
): number {
  const { pSlip, pGuess } = params;
  if (correct) {
    const num = pMastery * (1 - pSlip);
    const den = num + (1 - pMastery) * pGuess;
    return den === 0 ? pMastery : num / den;
  }
  const num = pMastery * pSlip;
  const den = num + (1 - pMastery) * (1 - pGuess);
  return den === 0 ? pMastery : num / den;
}

/** Met à jour l'état de maîtrise après une observation. */
export function updateMastery(
  state: MasteryState,
  params: BktParams,
  correct: boolean,
  atIso: string,
): MasteryState {
  const posterior = posteriorGivenObservation(state.pMastery, params, correct);
  // Intègre la chance d'avoir appris pendant ce tour : p(L') = post + (1-post)·p(T).
  const next = posterior + (1 - posterior) * params.pTransit;
  return {
    skillId: state.skillId,
    pMastery: clamp01(next),
    attempts: state.attempts + 1,
    correct: state.correct + (correct ? 1 : 0),
    lastUpdatedIso: atIso,
  };
}

/** Maîtrisé lorsque p(L) atteint le seuil de la compétence. */
export function isMastered(state: MasteryState, threshold: number): boolean {
  return state.pMastery >= threshold;
}
