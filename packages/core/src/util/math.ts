/** Borne une valeur dans [0, 1]. */
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Arrondit à 2 décimales. */
export const round2 = (x: number): number => Math.round(x * 100) / 100;
