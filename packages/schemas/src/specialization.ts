import { z } from 'zod';

/**
 * Spécialisation (le « pic » du profil en T). Socle large d'abord, puis on creuse des directions —
 * 2-3 propositions guidées + une voie 100 % libre, réversibles (« respec »). Cf. recherche 2026
 * (spécialisation tardive/progressive, SDT, choice architecture, skill trees).
 */

/** Progression d'une discipline (pour choisir et suivre une voie). */
export const disciplineProgressSchema = z.object({
  discipline: z.string(),
  mastered: z.number().int(),
  total: z.number().int(),
  avgMastery: z.number(),
  topRankName: z.string(),
  /** Prochaine compétence à travailler dans cette discipline (null si tout est vu). */
  nextSkillTitle: z.string().nullable(),
  /** L'élève a choisi cette discipline comme voie. */
  chosen: z.boolean(),
});
export type DisciplineProgress = z.infer<typeof disciplineProgressSchema>;

/** Une proposition guidée (avec la raison, formulée comme piste, jamais un verdict). */
export const specializationProposalSchema = z.object({
  discipline: z.string(),
  reason: z.string(),
});
export type SpecializationProposal = z.infer<typeof specializationProposalSchema>;

/** Un jalon du plan de spécialisation (compétence vérifiable + projet + badge). */
export const milestoneSchema = z.object({
  id: z.string(),
  competency: z.string(),
  successCriteria: z.array(z.string()),
  subgoals: z.array(z.string()),
  projectBrief: z.string(),
  badgeName: z.string(),
  done: z.boolean(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

/** Plan de spécialisation généré par le guide-IA (backward design, 5-8 jalons). */
export const specializationPlanSchema = z.object({
  discipline: z.string(),
  distalGoal: z.string(),
  milestones: z.array(milestoneSchema),
});
export type SpecializationPlan = z.infer<typeof specializationPlanSchema>;

/** Un badge obtenu (micro-crédentiel). */
export const badgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  discipline: z.string(),
  criteria: z.string(),
  dateIso: z.string(),
});
export type Badge = z.infer<typeof badgeSchema>;

/** Vue complète de la page « Spécialisation ». */
export const specializationViewSchema = z.object({
  /** Débloqué seulement après un socle large (rang ≥ seuil). */
  unlocked: z.boolean(),
  unlockRankName: z.string(),
  currentRankName: z.string(),
  /** Voies choisies (actives), avec progression. */
  active: z.array(disciplineProgressSchema),
  /** 2-3 propositions guidées (par appétence). */
  proposals: z.array(specializationProposalSchema),
  /** Toutes les disciplines (pour choisir librement), avec progression. */
  disciplines: z.array(disciplineProgressSchema),
  /** Badges obtenus (micro-crédentiels). */
  badges: z.array(badgeSchema),
});
export type SpecializationView = z.infer<typeof specializationViewSchema>;
