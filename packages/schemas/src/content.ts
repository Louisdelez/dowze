import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * Contenu pédagogique généré par l'IA (jamais stocké comme « vérité figée » :
 * régénérable à la demande via le pont `.json`). Structure conforme aux principes
 * (objectifs explicites, exemples résolus — Rosenshine/Sweller).
 */

export const lessonSectionSchema = z.object({
  heading: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});
export type LessonSection = z.infer<typeof lessonSectionSchema>;

export const lessonSchema = z.object({
  skillId: uuidSchema,
  title: z.string().min(1).max(200),
  /** Objectifs d'apprentissage explicites (backward design). */
  objectives: z.array(z.string().min(1)).default([]),
  sections: z.array(lessonSectionSchema).min(1),
  /** Exemples résolus, pas à pas (réduisent la charge cognitive). */
  workedExamples: z.array(z.string().min(1)).default([]),
});
export type Lesson = z.infer<typeof lessonSchema>;
