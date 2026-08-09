/**
 * Date du jour CÔTÉ ÉLÈVE (YYYY-MM-DD), au fuseau suisse par défaut — PAS l'UTC.
 * L'audit 08-2026 a montré que les dates ISO-UTC faussaient streaks et idempotence autour de minuit
 * (ex. séance à 00h30 locale comptée sur le jour précédent). `fr-CA` produit le format YYYY-MM-DD.
 */
export function localDateStr(tz = 'Europe/Zurich', d: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: tz }).format(d);
}
