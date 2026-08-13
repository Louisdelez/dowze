import { z } from 'zod';
import { milestoneSchema, badgeSchema } from './specialization';

/**
 * Cours secondaire « Ma passion » — électif optionnel, 100 % libre. Recherche 2026 : SDT/Patall
 * (choix = persistance), Hidi & Renninger (intérêt), Iyengar & Lepper (5 options), effet de
 * surjustification (séparer plaisir/pro), Kahneman DRM (journal dans le vif), engagement DOUX +
 * délai de réflexion 1 mois (verrou dur déconseillé pour l'ado).
 */

/** Une discipline testée en mode découverte (champ libre). */
export const discoveryDisciplineSchema = z.object({
  label: z.string(),
  disciplineHint: z.string().default(''),
});
export type DiscoveryDiscipline = z.infer<typeof discoveryDisciplineSchema>;

/** L'électif courant (la passion active). */
export const electiveSchema = z.object({
  id: z.string(),
  label: z.string(),
  disciplineHint: z.string(),
  mode: z.enum(['plaisir', 'pro']),
  status: z.enum(['active', 'change_pending']),
  chosenIso: z.string(),
  /** Fin d'engagement AFFICHÉE (~6 mois) — moral, jamais bloquant (rampe de sortie toujours dispo). */
  commitUntilIso: z.string().nullable(),
  changeTarget: z.string().nullable(),
  /** Date à partir de laquelle on peut CONFIRMER le changement (proposé + 1 mois de réflexion). */
  changeConfirmIso: z.string().nullable(),
});
export type Elective = z.infer<typeof electiveSchema>;

/** État du mode découverte (5 × 1 semaine + journal). */
export const electiveDiscoverySchema = z.object({
  id: z.string(),
  round: z.number().int(),
  disciplines: z.array(discoveryDisciplineSchema),
  currentIndex: z.number().int(),
  currentDiscipline: discoveryDisciplineSchema.nullable(),
  weekStartedIso: z.string(),
  /** Jour dans la semaine de découverte courante (1..7). */
  dayInWeek: z.number().int(),
  journalToday: z.boolean(),
  status: z.enum(['active', 'done']),
});
export type ElectiveDiscovery = z.infer<typeof electiveDiscoverySchema>;

/** Une proposition de discipline, formulée comme HYPOTHÈSE (jamais un verdict). */
export const electiveProposalSchema = z.object({
  label: z.string(),
  disciplineHint: z.string(),
  reason: z.string(), // « Sur tes journaux, il se peut que… — à toi de confirmer. »
});
export type ElectiveProposal = z.infer<typeof electiveProposalSchema>;

/** Un débouché adjacent (Plan A / Plan B). */
export const electivePathSchema = z.object({ title: z.string(), note: z.string() });

/** Le plan de la passion (jalons/projets/badges) + cadrage Plan A/B + taux de base honnête. */
export const electivePlanSchema = z.object({
  label: z.string(),
  distalGoal: z.string(),
  paths: z.array(electivePathSchema),
  baseRate: z.string(),
  milestones: z.array(milestoneSchema),
});
export type ElectivePlan = z.infer<typeof electivePlanSchema>;

/** Vue de la page « Ma passion ». */
export const electiveViewSchema = z.object({
  elective: electiveSchema.nullable(),
  discovery: electiveDiscoverySchema.nullable(),
  /** Propositions IA (2e tour de découverte, ou aide au choix) — hypothèses, jamais verdict. */
  proposals: z.array(electiveProposalSchema),
  plan: electivePlanSchema.nullable(),
  badges: z.array(badgeSchema),
  /** Plafond de temps conseillé (~20 %), en minutes/jour selon l'âge. */
  capMinutes: z.number().int(),
  /** Le mois de réflexion est-il en cours (changement proposé, pas encore confirmable) ? */
  inReflection: z.boolean(),
});
export type ElectiveView = z.infer<typeof electiveViewSchema>;
