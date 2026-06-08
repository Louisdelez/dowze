import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

/**
 * Répétition espacée (algorithme SM-2). L'intra calcule les dates de révision
 * dues par pure arithmétique (cf. docs/10-APP-WEB/14-backend.md §5).
 */

/** Qualité du rappel, de 0 (oubli total) à 5 (parfait). */
export const sm2GradeSchema = z.number().int().min(0).max(5);
export type Sm2Grade = z.infer<typeof sm2GradeSchema>;

/** L'état d'une carte de révision pour une compétence. */
export const sm2CardSchema = z.object({
  skillId: uuidSchema,
  /** Nombre de révisions réussies consécutives. */
  repetitions: z.number().int().nonnegative().default(0),
  /** Facteur de facilité (≥ 1.3). Démarre à 2.5. */
  easeFactor: z.number().min(1.3).default(2.5),
  /** Intervalle courant en jours avant la prochaine révision. */
  intervalDays: z.number().int().nonnegative().default(0),
  dueDateIso: isoDateTimeSchema.nullable().default(null),
  lastReviewedIso: isoDateTimeSchema.nullable().default(null),
});
export type Sm2Card = z.infer<typeof sm2CardSchema>;
