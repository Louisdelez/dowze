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
export const badgeLevelSchema = z.enum(['auto-declare', 'valide-par-pair', 'endosse-expert']);
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

// ─── Refonte 2026 : VALIDATION PAR EXPOSÉ ORAL évalué par les pairs (remplace la grille/auto-validation) ───

/** Un sujet à valider, créé par l'élève (titre + description) — pas de menu de compétences. */
export const validationSubjectSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(''),
  evidenceUrl: z.string().url().nullable().default(null),
  format: z.enum(['visio', 'video']),
  status: z.enum(['open', 'validated']),
  reviewCount: z.number().int(),
  avgStars: z.number(),
  mine: z.boolean(),
  /** L'évaluateur courant a déjà évalué ce sujet. */
  reviewedByMe: z.boolean(),
  /** Auteur (pour la page communautaire : filtrer/trier par niveau). */
  authorName: z.string().default(''),
  authorLevel: z.number().int().default(0),
  createdAtIso: isoDateTimeSchema,
});
export type ValidationSubject = z.infer<typeof validationSubjectSchema>;

/** L'évaluation d'un pair : validé + étoiles + commentaire (obligatoire). */
export const peerReviewInputSchema = z.object({
  validated: z.boolean(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000),
});
export type PeerReviewInput = z.infer<typeof peerReviewInputSchema>;

/** Vue complète de la page « Validation ». */
export const peerValidationViewSchema = z.object({
  /** Mes sujets (créés par moi). */
  mySubjects: z.array(validationSubjectSchema),
  /** Sujets d'autres élèves que je peux évaluer (si éligible). */
  toReview: z.array(validationSubjectSchema),
  /** Suis-je éligible pour évaluer autrui (niveau + ancienneté) ? */
  canReview: z.boolean(),
  /** Suis-je un prof agréé (validation en une fois) ? */
  isTeacher: z.boolean(),
  /** Combien il me faut de niveau / jours (message d'éligibilité). */
  reviewGateMessage: z.string().nullable(),
  /** Badges obtenus (sujets validés). */
  badges: z.array(
    z.object({ id: z.string(), name: z.string(), criteria: z.string(), dateIso: z.string() }),
  ),
  /** Seuil de validation (nb d'évaluateurs, moyenne d'étoiles). */
  requiredReviews: z.number().int(),
  requiredAvgStars: z.number(),
});
export type PeerValidationView = z.infer<typeof peerValidationViewSchema>;
