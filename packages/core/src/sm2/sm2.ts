import type { Sm2Card, Sm2Grade } from '@dowze/schemas';
import { addDaysIso, isOnOrBefore } from '../util/date';
import { round2 } from '../util/math';

/**
 * Répétition espacée — algorithme SuperMemo-2 (SM-2).
 * Calcule la prochaine date de révision par pure arithmétique.
 */

export function initialCard(skillId: string): Sm2Card {
  return {
    skillId,
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueDateIso: null,
    lastReviewedIso: null,
  };
}

/**
 * Applique une révision de qualité `grade` (0-5) à `nowIso`.
 * Renvoie la carte mise à jour (intervalle, facteur de facilité, échéance).
 */
export function review(card: Sm2Card, grade: Sm2Grade, nowIso: string): Sm2Card {
  const q = grade;

  // Mise à jour du facteur de facilité (borné à 1.3).
  let ef = card.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  let repetitions: number;
  let intervalDays: number;

  if (q < 3) {
    // Échec : on repart à zéro, révision dès le lendemain.
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = card.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(card.intervalDays * ef));
  }

  return {
    skillId: card.skillId,
    repetitions,
    easeFactor: round2(ef),
    intervalDays,
    dueDateIso: addDaysIso(nowIso, intervalDays),
    lastReviewedIso: nowIso,
  };
}

/** La carte est-elle due à `nowIso` ? (jamais révisée = due). */
export function isDue(card: Sm2Card, nowIso: string): boolean {
  if (card.dueDateIso === null) return true;
  return isOnOrBefore(card.dueDateIso, nowIso);
}
