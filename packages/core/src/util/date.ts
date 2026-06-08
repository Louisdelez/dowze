/**
 * Utilitaires de date déterministes (UTC). Les fonctions reçoivent toujours
 * « maintenant » explicitement (`nowIso`) → testables et reproductibles.
 */

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/** Vrai si `aIso` est au plus tard `bIso`. */
export function isOnOrBefore(aIso: string, bIso: string): boolean {
  return new Date(aIso).getTime() <= new Date(bIso).getTime();
}

/**
 * Début (lundi 00:00 UTC) de la semaine ISO contenant `iso`.
 * Jour ISO : lundi = 1 … dimanche = 7.
 */
export function startOfIsoWeekUtc(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Construit un instant à partir du début de semaine + jour (0=dim..6=sam) + minute. */
export function atWeekdayMinute(weekStartIso: string, dayOfWeek: number, startMinute: number): string {
  // weekStartIso = lundi 00:00. Décalage depuis lundi : (jour - 1), dimanche → 6.
  const offsetDays = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const base = addDaysIso(weekStartIso, offsetDays);
  return addMinutesIso(base, startMinute);
}
