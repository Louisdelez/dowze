import { z } from 'zod';
import { uuidSchema } from './common';
import { lessonSectionSchema } from './content';
import {
  bloomLevelSchema,
  qcmGenSchema,
  flashcardGenSchema,
  shortGenSchema,
  clozeGenSchema,
} from './exercises';

/**
 * Le COURS NATIF Dowze : une « feuille A4 » = une liste ordonnée de MODULES pédagogiques réutilisables
 * (templates) que l'IA de Dowze remplit selon la compétence prescrite, le niveau (Bloom), les misconceptions
 * et le dossier de l'élève. Rendu EN APP (pas un prompt à copier). Fondé sur Rosenshine (petits pas, exemples
 * résolus, pratique guidée puis indépendante), la libération graduelle (« je fais / nous faisons / tu fais »)
 * et les 6 stratégies (récupération, espacement, élaboration, double codage…).
 * Régénérable à la demande, jamais une vérité figée. Cf. docs/10-APP-WEB/30-cours-natif-feuille-modules.md.
 */

// --- Items d'exercice GÉNÉRÉS (sans méta uuid), typés pour le rendu par ExerciseCard. ---
export const courseQcmSchema = qcmGenSchema.extend({ type: z.literal('qcm') });
export const courseFlashcardSchema = flashcardGenSchema.extend({ type: z.literal('flashcard') });
export const courseShortSchema = shortGenSchema.extend({ type: z.literal('short') });
export const courseClozeSchema = clozeGenSchema.extend({ type: z.literal('cloze') });

/** Un item d'exercice auto-corrigé (union discriminée sur `type`). */
export const courseExerciseSchema = z.discriminatedUnion('type', [
  courseQcmSchema,
  courseFlashcardSchema,
  courseShortSchema,
  courseClozeSchema,
]);
export type CourseExercise = z.infer<typeof courseExerciseSchema>;

// --- Les MODULES (chaque `kind` = un geste pédagogique = un template). ---

/** Objectifs de la séance (backward design). */
export const objectifModuleSchema = z.object({
  kind: z.literal('objectif'),
  objectives: z.array(z.string().min(1)).min(1).max(6),
});

/** Rappel quotidien / récupération : réactive le prérequis (Rosenshine #1). */
export const rappelModuleSchema = z.object({
  kind: z.literal('rappel'),
  intro: z.string().default(''),
  items: z.array(courseExerciseSchema).min(1).max(3),
});

/** Fiche de cours : la notion en petits pas + exemples concrets (double codage via `schema`). */
export const ficheModuleSchema = z.object({
  kind: z.literal('fiche'),
  sections: z.array(lessonSectionSchema).min(1).max(5),
});

/** « Je fais » : un exemple résolu pas-à-pas ; les étapes `reveal` sont masquées puis révélées (fading). */
export const exempleStepSchema = z.object({
  text: z.string().min(1),
  reveal: z.boolean().default(false),
});
export const exempleModuleSchema = z.object({
  kind: z.literal('exemple'),
  title: z.string().min(1),
  steps: z.array(exempleStepSchema).min(1).max(8),
});

/** « Nous faisons » : pratique guidée avec indices progressifs, puis réponse + explication. */
export const guideModuleSchema = z.object({
  kind: z.literal('guide'),
  prompt: z.string().min(1),
  hints: z.array(z.string().min(1)).max(4).default([]),
  answer: z.string().min(1),
  explanation: z.string().default(''),
});

/** Vérifier : QCM dont les distracteurs sont des MISCONCEPTIONS (diagnostic formatif). */
export const qcmModuleSchema = z.object({
  kind: z.literal('qcm'),
  items: z.array(courseQcmSchema).min(1).max(5),
});

/** « Tu fais » : pratique indépendante (mélange d'exercices auto-corrigés). */
export const exerciceModuleSchema = z.object({
  kind: z.literal('exercice'),
  items: z.array(courseExerciseSchema).min(1).max(6),
});

/** Élaboration / auto-explication : questions « pourquoi / comment ». */
export const elaborationModuleSchema = z.object({
  kind: z.literal('elaboration'),
  questions: z.array(z.string().min(1)).min(1).max(5),
});

/** Double codage : un schéma (mermaid optionnel) + légende. */
export const schemaModuleSchema = z.object({
  kind: z.literal('schema'),
  caption: z.string().min(1),
  mermaid: z.string().default(''),
});

/** Synthèse : points clés + graines de flashcards (alimentent la révision espacée / FSRS). */
export const syntheseModuleSchema = z.object({
  kind: z.literal('synthese'),
  keyPoints: z.array(z.string().min(1)).min(1).max(8),
  flashcards: z.array(flashcardGenSchema).max(6).default([]),
});

/** Un module de cours (union discriminée sur `kind`). */
export const courseModuleSchema = z.discriminatedUnion('kind', [
  objectifModuleSchema,
  rappelModuleSchema,
  ficheModuleSchema,
  exempleModuleSchema,
  guideModuleSchema,
  qcmModuleSchema,
  exerciceModuleSchema,
  elaborationModuleSchema,
  schemaModuleSchema,
  syntheseModuleSchema,
]);
export type CourseModule = z.infer<typeof courseModuleSchema>;
export type CourseModuleKind = CourseModule['kind'];

/** La FEUILLE A4 : le conteneur ordonné de modules pour UNE compétence. */
export const courseSheetSchema = z.object({
  skillId: uuidSchema,
  title: z.string().min(1).max(200),
  level: bloomLevelSchema.optional(),
  modules: z.array(courseModuleSchema).min(1).max(12),
});
export type CourseSheet = z.infer<typeof courseSheetSchema>;

/** Sortie IA (le modèle ne connaît pas l'uuid de compétence : l'app le rajoute). Dérivé du schéma feuille
 *  pour garantir des types de modules IDENTIQUES. */
export const courseSheetGenSchema = courseSheetSchema.omit({ skillId: true });
export type CourseSheetGen = z.infer<typeof courseSheetGenSchema>;

/** Revue de la feuille par l'« Évaluateur » (contrôle qualité) : dans le sujet ? correcte ? QCM bien corrigés ? */
export const courseReviewSchema = z.object({
  ok: z.boolean().describe('Vrai si la feuille est pédagogiquement correcte ET reste dans le sujet de la compétence.'),
  issues: z
    .array(z.string())
    .default([])
    .describe('Problèmes CONCRETS à corriger : contenu faux/hors-sujet, QCM dont la bonne réponse est fausse, distracteur non plausible, étape d\'exemple erronée. Vide si ok.'),
});
export type CourseReview = z.infer<typeof courseReviewSchema>;

/** Clôture d'un cours natif : l'app a dérivé l'outcome des réponses réelles → BKT + carnet + FSRS. */
export const courseCloseRequestSchema = z
  .object({
    profileId: uuidSchema,
    skillId: uuidSchema,
    outcome: z.enum(['maitrise', 'progres', 'bloque']),
    note: z.string().max(500).default(''),
  })
  .strict();
export type CourseCloseRequest = z.infer<typeof courseCloseRequestSchema>;
