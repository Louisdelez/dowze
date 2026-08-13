import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * Test de PLACEMENT adaptatif piloté par l'IA (test d'évaluation d'entrée).
 * Estimation CONTINUE du niveau (staircase type Elo, sans banque d'items calibrée :
 * Pelánek 2016), difficulté ciblée par l'IA à chaque question, montée AU-DESSUS du
 * référentiel pour détecter le haut potentiel (talent searches / above-level testing),
 * 15-30 questions avec arrêt sur stabilité, et minuteur par question NON-PUNITIF dont
 * le temps est un signal SÉPARÉ (jamais fondu dans le score — Wechsler PSI, van der
 * Linden). (cf. docs/10-APP-WEB/19-onboarding-profil-placement.md §5)
 */

/** Sortie IA : une question ouverte AUTONOME, à la difficulté ciblée. */
export const placementQuestionSchema = z
  .object({
    question: z
      .string()
      .describe(
        'Une question OUVERTE, courte et AUTONOME (tout texte/support référencé inclus en entier).',
      ),
    attendu: z
      .string()
      .describe("Ce qu'une bonne réponse doit contenir (pour corriger, non montré à l'élève)."),
  })
  .strict();
export type PlacementQuestion = z.infer<typeof placementQuestionSchema>;

/** Niveau de réussite d'une réponse (3 paliers → score 1 / 0,5 / 0). */
export const placementNiveauSchema = z.enum(['juste', 'partiel', 'faux']);
export type PlacementNiveau = z.infer<typeof placementNiveauSchema>;

/** Sortie IA : correction nuancée (3 paliers) de la réponse de l'élève. */
export const placementGradeSchema = z
  .object({
    niveau: placementNiveauSchema.describe(
      'juste = maîtrisé ; partiel = en partie / avec hésitation ; faux = non maîtrisé.',
    ),
    explication: z.string().describe('Courte explication bienveillante, en une phrase.'),
  })
  .strict();
export type PlacementGrade = z.infer<typeof placementGradeSchema>;

/** Requête : démarrer un placement. */
export const placementStartRequestSchema = z.object({ profileId: uuidSchema }).strict();
export type PlacementStartRequest = z.infer<typeof placementStartRequestSchema>;

/** Requête : répondre à la question courante (avec temps de réponse, signal séparé). */
export const placementAnswerRequestSchema = z
  .object({
    sessionId: uuidSchema,
    answer: z.string().max(4000),
    /** Temps de réflexion+réponse en ms (signal de rythme, n'altère pas le niveau). */
    responseTimeMs: z.number().int().nonnegative().max(3_600_000).optional(),
    /** Vrai si le minuteur (généreux) a expiré sans réponse — non punitif. */
    timedOut: z.boolean().optional(),
  })
  .strict();
export type PlacementAnswerRequest = z.infer<typeof placementAnswerRequestSchema>;

/** Réponse renvoyée à l'élève à chaque étape. */
export const placementStepSchema = z.object({
  sessionId: uuidSchema,
  done: z.boolean(),
  question: z.string().nullable(),
  skillTitle: z.string().nullable(),
  askedCount: z.number().int(),
  /** Nombre maximal de questions (pour la barre de progression). */
  maxQuestions: z.number().int().default(30),
  /** Durée conseillée pour CETTE question, en secondes (minuteur généreux, non punitif). */
  timeLimitSec: z.number().int().nullable().default(null),
  /** Vrai quand la question dépasse le référentiel d'âge (sonde de haut potentiel). */
  aboveLevel: z.boolean().default(false),
  feedback: z.string().nullable(),
  entrySkill: z
    .object({ id: uuidSchema, slug: z.string(), title: z.string() })
    .nullable()
    .default(null),
  masteredCount: z.number().int().default(0),
  /** Bilan de rythme (signal SÉPARÉ, informatif) — ex. « rythme posé », « répond vite ». */
  paceNote: z.string().nullable().default(null),
  /** Note de potentiel si l'élève a dépassé le référentiel de son âge. */
  potentialNote: z.string().nullable().default(null),
});
export type PlacementStep = z.infer<typeof placementStepSchema>;
