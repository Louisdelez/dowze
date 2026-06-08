import { z } from 'zod';
import { uuidSchema, slugSchema, isoDateTimeSchema } from './common';

/**
 * Validation par paliers, modèle École 42 (cf. docs/10-APP-WEB/09-validation.md).
 * PAS de QCM. Le seul artefact par compétence est une **grille** (rubrique binaire).
 */

/** Un critère de la grille : binaire (acquis / non-acquis). */
export const rubricCriterionSchema = z.object({
  id: slugSchema,
  label: z.string().min(1).max(300),
  description: z.string().max(1000).default(''),
  /** Critère bloquant (doit être acquis pour valider) ou indicatif. */
  required: z.boolean().default(true),
});
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

/** La grille d'une compétence : ce qui doit être démontré. */
export const rubricSchema = z.object({
  skillId: uuidSchema,
  criteria: z.array(rubricCriterionSchema).min(1),
});
export type Rubric = z.infer<typeof rubricSchema>;

/** Les paliers de validation, du plus faible (débloque) au plus fort. */
export const validationTierSchema = z.enum(['auto', 'ia-precorrection', 'pair', 'expert']);
export type ValidationTier = z.infer<typeof validationTierSchema>;

/** Les 3 niveaux de confiance (façon Open Badges). */
export const badgeLevelSchema = z.enum([
  'auto-declare',
  'valide-par-pair',
  'endosse-expert',
]);
export type BadgeLevel = z.infer<typeof badgeLevelSchema>;

/** Verdict sur un critère lors d'une revue. */
export const criterionVerdictSchema = z.object({
  criterionId: slugSchema,
  met: z.boolean(),
  comment: z.string().max(2000).default(''),
});
export type CriterionVerdict = z.infer<typeof criterionVerdictSchema>;

/** Une validation (auto, par un pair, ou par un expert) d'une compétence. */
export const validationSchema = z.object({
  id: uuidSchema,
  skillId: uuidSchema,
  learnerId: uuidSchema,
  tier: validationTierSchema,
  /** Auteur de la revue. `null` pour l'auto-validation. */
  reviewerId: uuidSchema.nullable().default(null),
  verdicts: z.array(criterionVerdictSchema).default([]),
  passed: z.boolean(),
  /** Lien vers la preuve produite (la « trace » de l'expédition). */
  evidenceUrl: z.string().url().nullable().default(null),
  createdAtIso: isoDateTimeSchema,
});
export type Validation = z.infer<typeof validationSchema>;
