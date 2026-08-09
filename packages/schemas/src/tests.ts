import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';
import { exerciseItemSchema } from './exercises';

/**
 * Tests de RÉVISION : hebdomadaire (cumulatif, interleavé) et trimestriel. Ce
 * sont des outils formatifs — feedback immédiat, AUCUNE note de maîtrise, pas de
 * compte à rebours. Ils nourrissent la mémoire (FSRS), jamais un verdict.
 * (cf. docs/10-APP-WEB/18-tests-et-examens.md)
 */

export const testKindSchema = z.enum(['weekly', 'trimestrial']);
export type TestKind = z.infer<typeof testKindSchema>;

/** Un test généré : une liste d'items d'exercices interleavés. */
export const testViewSchema = z.object({
  id: uuidSchema,
  kind: testKindSchema,
  items: z.array(exerciseItemSchema),
  createdAtIso: isoDateTimeSchema,
});
export type TestView = z.infer<typeof testViewSchema>;

/** Requête : générer un test. */
export const generateTestRequestSchema = z
  .object({
    profileId: uuidSchema,
    kind: testKindSchema.default('weekly'),
  })
  .strict();
export type GenerateTestRequest = z.infer<typeof generateTestRequestSchema>;

/** Requête : soumettre les résultats (corrigés côté client, formatif). */
export const submitTestRequestSchema = z
  .object({
    testId: uuidSchema,
    profileId: uuidSchema,
    results: z.array(z.object({ skillId: uuidSchema, correct: z.boolean() }).strict()).min(1),
  })
  .strict();
export type SubmitTestRequest = z.infer<typeof submitTestRequestSchema>;

/** Résultat d'un test : un bilan de progrès, jamais une note qui compte. */
export const testResultSchema = z.object({
  testId: uuidSchema,
  total: z.number().int(),
  correct: z.number().int(),
});
export type TestResult = z.infer<typeof testResultSchema>;
