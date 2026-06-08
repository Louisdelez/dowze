import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema, probabilitySchema } from './common';

/**
 * Suivi de maîtrise par Bayesian Knowledge Tracing (BKT).
 * L'intra calcule la probabilité qu'une compétence soit maîtrisée à partir des
 * observations (réussite/échec), sans IA.
 */

/** Les quatre paramètres BKT d'une compétence. */
export const bktParamsSchema = z.object({
  /** p(L0) — connaissance a priori avant toute pratique. */
  pInit: probabilitySchema.default(0.1),
  /** p(T) — probabilité d'apprendre à chaque opportunité. */
  pTransit: probabilitySchema.default(0.3),
  /** p(S) — « slip » : se tromper alors qu'on sait. */
  pSlip: probabilitySchema.default(0.1),
  /** p(G) — « guess » : réussir par chance sans savoir. */
  pGuess: probabilitySchema.default(0.2),
});
export type BktParams = z.infer<typeof bktParamsSchema>;

/** L'état de maîtrise courant d'une compétence pour un apprenant. */
export const masteryStateSchema = z.object({
  skillId: uuidSchema,
  /** p(L) courant — probabilité que la compétence soit maîtrisée. */
  pMastery: probabilitySchema,
  attempts: z.number().int().nonnegative().default(0),
  correct: z.number().int().nonnegative().default(0),
  lastUpdatedIso: isoDateTimeSchema.nullable().default(null),
});
export type MasteryState = z.infer<typeof masteryStateSchema>;

/** Une observation : l'apprenant a-t-il réussi cette occasion de pratique ? */
export const masteryObservationSchema = z.object({
  skillId: uuidSchema,
  correct: z.boolean(),
  atIso: isoDateTimeSchema,
});
export type MasteryObservation = z.infer<typeof masteryObservationSchema>;
