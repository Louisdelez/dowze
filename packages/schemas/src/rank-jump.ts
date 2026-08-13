import { z } from 'zod';
import { isoDateTimeSchema } from './common';

/**
 * « Saut de Rang » — mois intensif (type piscine) pour franchir un rang plus vite.
 * Volontairement exigeant (80 % requis), avec filtre d'éligibilité (façon Iowa Acceleration Scale)
 * et garde-fous (repos, échec sans pénalité). Cf. recherche 2026 (A Nation Empowered, 42/Epitech).
 */

export const rankJumpDayTypeSchema = z.enum(['learn', 'weekly', 'expedition', 'rest', 'exam']);
export type RankJumpDayType = z.infer<typeof rankJumpDayTypeSchema>;

/** Un jour du programme des 28 jours. */
export const rankJumpDaySchema = z.object({
  day: z.number().int(),
  type: rankJumpDayTypeSchema,
  label: z.string(),
  weight: z.number(),
  done: z.boolean(),
  /** Score du jour ∈ [0,1], null tant que non fait. */
  score: z.number().nullable(),
});
export type RankJumpDay = z.infer<typeof rankJumpDaySchema>;

/** Éligibilité au saut (jauge /100, façon Iowa Acceleration Scale). */
export const rankJumpEligibilitySchema = z.object({
  /** Jauge globale sur 100. */
  score: z.number().int(),
  /** Peut lancer un saut (jauge ≥ 60 et aucun verrou). */
  canStart: z.boolean(),
  /** Maîtrise du rang actuel (0→1) — il faut l'avoir presque bouclé avant de sauter. */
  mastery: z.number(),
  /** Régularité récente (0→1). */
  regularity: z.number(),
  /** Le rang courant n'est pas le sommet (on ne saute pas au-delà de Dowzer Suprême). */
  atTop: z.boolean(),
  /** Accord du responsable requis (compte mineur). */
  parentConsentNeeded: z.boolean(),
  /** Un pré-test « above-level » est requis pour compléter la jauge. */
  pretestNeeded: z.boolean(),
  /** Score du pré-test (0→1), null si pas encore passé. */
  pretestScore: z.number().nullable(),
  /** Raisons de blocage (verrous éliminatoires), lisibles. */
  blockers: z.array(z.string()),
});
export type RankJumpEligibility = z.infer<typeof rankJumpEligibilitySchema>;

/** État d'un saut en cours ou terminé. */
export const rankJumpStateSchema = z.object({
  id: z.string().uuid(),
  fromRank: z.number().int(),
  fromRankName: z.string(),
  targetRank: z.number().int(),
  targetRankName: z.string(),
  status: z.enum(['pending-consent', 'in-progress', 'passed', 'failed', 'abandoned']),
  currentDay: z.number().int(),
  totalDays: z.number().int(),
  plan: z.array(rankJumpDaySchema),
  /** Aujourd'hui (le jour courant). */
  today: rankJumpDaySchema.nullable(),
  /** La tâche du jour est disponible (cadence : 1 tâche par jour réel). */
  canDoToday: z.boolean(),
  /** Prochaine tâche disponible à cette date (si on a déjà fait celle du jour). */
  nextTaskAt: isoDateTimeSchema.nullable(),
  /** Compte parental : la confirmation du responsable est requise pour démarrer. */
  hasParent: z.boolean(),
  /** Score provisoire acquis / total possible sur tout le programme (0→1). */
  provisionalScore: z.number(),
  /** Score final (0→1) — pertinent une fois le programme terminé. */
  finalScore: z.number(),
  passThreshold: z.number(),
  examsPassed: z.number().int(),
  examsRequired: z.number().int(),
  startedAt: isoDateTimeSchema,
});
export type RankJumpState = z.infer<typeof rankJumpStateSchema>;

/** Un re-test de rétention dû (après un saut réussi). */
export const retentionDueSchema = z.object({
  id: z.string().uuid(),
  rankName: z.string(),
  scheduledAt: isoDateTimeSchema,
});
export type RetentionDue = z.infer<typeof retentionDueSchema>;

/** Note de bien-être (soutien, jamais un diagnostic) + si le WHO-5 hebdo est dû. */
export const wellbeingSchema = z.object({
  note: z.string().nullable(),
  who5Due: z.boolean(),
});
export type Wellbeing = z.infer<typeof wellbeingSchema>;

/** Vue complète de la page « Saut de Rang ». */
export const rankJumpViewSchema = z.object({
  eligibility: rankJumpEligibilitySchema,
  active: rankJumpStateSchema.nullable(),
  /** Re-tests de rétention dus (ancrage post-saut). */
  retention: z.array(retentionDueSchema),
  /** Bien-être pendant le mois intensif. */
  wellbeing: wellbeingSchema,
});
export type RankJumpView = z.infer<typeof rankJumpViewSchema>;
