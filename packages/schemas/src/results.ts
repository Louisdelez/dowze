import { z } from 'zod';
import { isoDateTimeSchema } from './common';

/**
 * « Mes résultats » : un bulletin SANS note ni classement — maîtrise par domaine,
 * point de départ, tests d'entraînement, prochaine étape. Fondé sur la recherche
 * (Butler 1988, SDT, Hattie & Timperley, socle/standards-based) : on montre la
 * MAÎTRISE et la CROISSANCE, jamais une moyenne, un rang ou un jugement « au soi ».
 * (cf. docs/10-APP-WEB/22-resultats-bulletin.md)
 */

/** Échelle ordinale nommée à 4 niveaux (« Maîtrisé » = cible normale, comme le socle). */
export const masteryLevelSchema = z.enum(['decouverte', 'en-cours', 'consolide', 'maitrise']);
export type MasteryLevel = z.infer<typeof masteryLevelSchema>;

/** Maîtrise agrégée d'un palier (répartition des compétences par niveau). */
export const domainMasterySchema = z.object({
  /** Nom UNIVERSEL du palier (échelle type jeu vidéo : Fer, Bronze, …, Diamant). */
  domain: z.string(),
  /** Rang du palier (1 = plus basique → 6 = plus avancé) — pour l'ordre et la couleur. */
  tier: z.number().int().optional(),
  /** Repère discret « ≈ niveau scolaire » (facultatif ; ex. « ≈ collège »). */
  equivalent: z.string().optional(),
  /** Rang SANS FIN (le sommet « Dowzer Suprême ») : pas de dénominateur, on ne l'achève jamais. */
  infinite: z.boolean().optional(),
  total: z.number().int(),
  decouverte: z.number().int(),
  enCours: z.number().int(),
  consolide: z.number().int(),
  maitrise: z.number().int(),
});
export type DomainMastery = z.infer<typeof domainMasterySchema>;

/** Un cran de l'échelle de rangs (pour la mini-frise horizontale). */
export const rankLadderStepSchema = z.object({
  rank: z.number().int(),
  name: z.string(),
  equivalent: z.string(),
  state: z.enum(['passed', 'current', 'locked', 'infinite']),
  mastered: z.number().int(),
  total: z.number().int(),
});
export type RankLadderStep = z.infer<typeof rankLadderStepSchema>;

/** Une direction que l'apprenant creuse (spécialisation = le « pic » du profil en T). */
export const specializationSchema = z.object({
  discipline: z.string(),
  mastered: z.number().int(),
  topRankName: z.string(),
});
export type Specialization = z.infer<typeof specializationSchema>;

/**
 * Progression « une seule barre, façon jeu vidéo compétitif » (LP/RR). Le rang courant est un ÉTAT
 * (il ne change que quand l'élève ACCEPTE la montée). La barre RR mesure le NIVEAU REQUIS du rang.
 * Le passage se débloque sous 3 conditions (recherche 2026 : mastery learning, CBE, psychométrie) :
 * niveau requis atteint + 3 examens trimestriels validés + ≥ 60 % des tests hebdo + plancher d'1 an.
 * La montée n'est jamais automatique : vote de l'élève + confirmation du responsable si compte parental.
 */
export const rankChoiceSchema = z.enum(['accept', 'consolidate']);
export type RankChoice = z.infer<typeof rankChoiceSchema>;

export const progressionSchema = z.object({
  rank: z.number().int(),
  rankName: z.string(),
  rankEquivalent: z.string(),
  nextRankName: z.string().nullable(),
  /** Rang sommet (Dowzer Suprême) : sans fin. */
  isTop: z.boolean(),
  /** Barre visible 0→100 (niveau requis du rang). */
  rr: z.number().int(),
  requiredLevelMet: z.boolean(),
  // Condition 1 — tests hebdomadaires (≥ 60 % réussis sur le cycle du rang).
  weeklyPassed: z.number().int(),
  weeklyTotal: z.number().int(),
  weeklyRate: z.number(),
  weeklyOk: z.boolean(),
  // Condition 2 — 3 examens trimestriels validés.
  examsPassed: z.number().int(),
  examsRequired: z.number().int(),
  examsOk: z.boolean(),
  // Condition 3 — plancher de durée (≥ 1 an par rang).
  monthsAtRank: z.number(),
  monthsRemaining: z.number(),
  minYearMet: z.boolean(),
  /** Les 3 conditions + plancher réunies : la montée est proposée. */
  eligible: z.boolean(),
  /** Compte parental présent → confirmation du responsable requise. */
  hasParent: z.boolean(),
  studentChoice: rankChoiceSchema.nullable(),
  parentChoice: rankChoiceSchema.nullable(),
});
export type Progression = z.infer<typeof progressionSchema>;

/** Un test d'entraînement passé (jamais présenté comme une note/un rang). */
export const testRowSchema = z.object({
  kind: z.enum(['weekly', 'trimestrial']),
  total: z.number().int(),
  correct: z.number().int(),
  dateIso: isoDateTimeSchema,
});
export type TestRow = z.infer<typeof testRowSchema>;

/** La vue « résultats » complète (élève ou parent — mêmes descripteurs). */
export const resultsViewSchema = z.object({
  displayName: z.string(),
  /** Le point de départ (placement) — cadré « d'où tu es parti », jamais « ton niveau ». */
  pointDepart: z
    .object({
      entrySkillTitle: z.string().nullable(),
      masteredCount: z.number().int(),
      aboveReferential: z.boolean(),
    })
    .nullable(),
  masteredCount: z.number().int(),
  inProgressCount: z.number().int(),
  domains: z.array(domainMasterySchema),
  /** Progression « une seule barre » : rang courant + socle requis pour le suivant + spécialisation. */
  progression: progressionSchema,
  /** Forces (compétences maîtrisées, formulation asset-based). */
  strengths: z.array(z.string()),
  /** UNE seule prochaine étape actionnable. */
  nextStep: z.object({ title: z.string(), domain: z.string() }).nullable(),
  /** Historique des tests d'entraînement (progression de soi, pas de classement). */
  tests: z.array(testRowSchema),
});
export type ResultsView = z.infer<typeof resultsViewSchema>;
