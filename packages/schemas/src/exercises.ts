import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * Modules d'exercices RÉUTILISABLES (Priorité 1 construite : flashcard, QCM 3
 * options, réponse courte, cloze). Ce sont des instruments de RÉCUPÉRATION
 * (formatifs, privés) — ils ne valident jamais une compétence.
 * (cf. docs/10-APP-WEB/18-tests-et-examens.md)
 */

/** Types d'items. P1 = les 4 premiers (construits). P2/P3 = réservés. */
export const exerciseTypeSchema = z.enum([
  'flashcard',
  'qcm',
  'short',
  'cloze',
  // P2/P3 (réservés) :
  'vrai-faux',
  'appariement',
  'sequence',
  'ouverte',
]);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

/** Niveau cognitif (taxonomie de Bloom, simplifiée). */
export const bloomLevelSchema = z.enum([
  'se-souvenir',
  'comprendre',
  'appliquer',
  'analyser',
  'evaluer',
  'creer',
]);
export type BloomLevel = z.infer<typeof bloomLevelSchema>;

// --- Sorties IA par type (STRICTES, portables multi-modèles) — champs pédagogiques seuls. ---

export const flashcardGenSchema = z
  .object({
    recto: z.string().describe('La question / le terme (une seule idée par carte).'),
    verso: z.string().describe('La réponse concise.'),
  })
  .strict();

export const qcmGenSchema = z
  .object({
    stem: z.string().describe('L’énoncé, un problème complet et compréhensible seul.'),
    options: z
      .array(z.string())
      .length(3)
      .describe('EXACTEMENT 3 options : 1 correcte + 2 distracteurs plausibles.'),
    correctIndex: z.number().int().min(0).max(2).describe('Index (0-2) de la bonne option.'),
    distractorRationales: z
      .array(z.string())
      .length(2)
      .describe('Pourquoi chaque distracteur est faux (erreur réelle qu’il capture).'),
    feedback: z.string().describe('Explication brève à montrer après la réponse.'),
  })
  .strict();

export const shortGenSchema = z
  .object({
    prompt: z.string().describe('La question à réponse courte (un point unique).'),
    acceptedAnswers: z
      .array(z.string())
      .min(1)
      .describe('Réponses acceptées, synonymes/variantes inclus.'),
    feedback: z.string().describe('Explication brève.'),
  })
  .strict();

const clozeGapSchema = z
  .object({
    acceptedAnswers: z.array(z.string()).min(1).describe('Mots acceptés pour ce trou (synonymes ok).'),
  })
  .strict();

export const clozeGenSchema = z
  .object({
    textWithGaps: z
      .string()
      .describe('Le texte avec chaque trou noté « ___ » (trois tirets bas), dans l’ordre.'),
    gaps: z.array(clozeGapSchema).min(1).describe('Les trous, dans l’ordre d’apparition.'),
    feedback: z.string().describe('Explication brève.'),
  })
  .strict();

/** Lot généré (n items d'un même type). Le générique renvoie `{ items }`. */
export function genBatchSchema<S extends z.ZodTypeAny>(item: S) {
  return z.object({ items: z.array(item).min(1) }).strict();
}

// --- Items COMPLETS (rendus / stockés) : champs pédagogiques + méta. ---

const meta = {
  competenceId: uuidSchema,
  bloomLevel: bloomLevelSchema.default('comprendre'),
  sourceRef: z.string().default(''),
};

export const flashcardItemSchema = flashcardGenSchema.extend({ type: z.literal('flashcard'), ...meta });
export const qcmItemSchema = qcmGenSchema.extend({ type: z.literal('qcm'), ...meta });
export const shortItemSchema = shortGenSchema.extend({ type: z.literal('short'), ...meta });
export const clozeItemSchema = clozeGenSchema.extend({ type: z.literal('cloze'), ...meta });

export const exerciseItemSchema = z.discriminatedUnion('type', [
  flashcardItemSchema,
  qcmItemSchema,
  shortItemSchema,
  clozeItemSchema,
]);
export type ExerciseItem = z.infer<typeof exerciseItemSchema>;

/** Requête : générer des items pour une compétence. */
export const generateExercisesRequestSchema = z
  .object({
    profileId: uuidSchema,
    skillId: uuidSchema,
    type: z.enum(['flashcard', 'qcm', 'short', 'cloze']),
    count: z.number().int().min(1).max(10).default(4),
  })
  .strict();
export type GenerateExercisesRequest = z.infer<typeof generateExercisesRequestSchema>;
