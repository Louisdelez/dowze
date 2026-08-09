import { z } from 'zod';

/**
 * Système ÉCHANGER — Phase C : traduction temps réel (doc 26 §4).
 * Cache communautaire (Redis), modèle LowCost, coût estimé.
 */

export const translateInputSchema = z.object({
  text: z.string().min(1).max(4000),
  targetLang: z.string().min(2).max(8),
});
export type TranslateInput = z.infer<typeof translateInputSchema>;

export const translationResultSchema = z.object({
  text: z.string(),
  cached: z.boolean(), // vrai = servi par le cache communautaire (aucun coût)
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(), // estimation (tokens = fait, prix = estimation)
});
export type TranslationResult = z.infer<typeof translationResultSchema>;
