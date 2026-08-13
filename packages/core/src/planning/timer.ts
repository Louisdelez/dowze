/**
 * Cycle de minuteur (PUR), synchronisé au planning : alternance focus / pause.
 * Sain par conception (cf. docs/10-APP-WEB/11-planning-regularite.md) : le calcul
 * est déterministe, l'UI décide d'afficher/sonner ou non.
 */
export interface TimerConfig {
  focusMin: number;
  breakMin: number;
}

export type TimerMode = 'focus' | 'break';

export interface TimerSegment {
  mode: TimerMode;
  remainingSec: number;
  cycle: number;
}

/** Segment courant (mode + temps restant) à `elapsedSec` depuis le départ. */
export function segmentAt(config: TimerConfig, elapsedSec: number): TimerSegment {
  const focus = Math.max(1, config.focusMin) * 60;
  const brk = Math.max(0, config.breakMin) * 60;
  const period = focus + brk;
  const cycle = Math.floor(elapsedSec / period);
  const into = elapsedSec - cycle * period;
  if (into < focus) return { mode: 'focus', remainingSec: focus - into, cycle };
  return { mode: 'break', remainingSec: period - into, cycle };
}

/** Vrai à un instant de bascule (début de focus ou début de pause) → sonnerie. */
export function isBoundary(config: TimerConfig, elapsedSec: number): boolean {
  if (elapsedSec <= 0) return false;
  const focus = Math.max(1, config.focusMin) * 60;
  const period = focus + Math.max(0, config.breakMin) * 60;
  const into = elapsedSec % period;
  return into === 0 || into === focus;
}

/**
 * Compte à rebours ONE-SHOT d'une séance (45 min par défaut). Déterministe et
 * basé sur l'heure de départ (persiste au changement d'onglet). `done` passe à
 * true à 0 → l'UI sonne l'alarme puis invite au bilan. (cf. docs/10-APP-WEB/17-seance-et-minuteur.md)
 */
export function countdownAt(
  startedAtMs: number,
  durationMin: number,
  nowMs: number,
): { remainingSec: number; done: boolean } {
  const total = Math.max(1, durationMin) * 60;
  const elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const remainingSec = Math.max(0, total - elapsed);
  return { remainingSec, done: remainingSec === 0 };
}

/** Durée de séance recommandée selon l'âge (base : 45 min). */
export function sessionMinutesForAge(age: number | null): number {
  if (age === null) return 45;
  if (age <= 11) return 20; // enfant : micro-séances
  if (age <= 17) return 45; // ado / lycéen
  return 45; // adulte : 45 par défaut (jusqu'à 90 en deep work)
}
