import { z } from 'zod';

/**
 * IA/RAG scopée pour plugins (P3) — contrat compose/ingest. Fidèle à la philosophie Dowze : l'IA de Dowze
 * **orchestre** (donne le prompt, le contexte, la structure) ; le prof/coach reste l'IA de l'élève
 * (ChatGPT/Claude). Le plugin ne réimplémente pas l'IA : il passe par ce contrat scopé `ai:infer`, qui
 * réutilise crédits/BYOK. Cf. docs/12-PLUGINS/04 §P3.
 */

// ─── compose : contexte du plugin → prompt lisible (déterministe, sans coût) ───

export const composePluginBodySchema = z.object({
  profileId: z.string().uuid(),
  sourceApp: z.string().min(1),
  title: z.string().min(1), // 'Séance jambes'
  goal: z.string().max(300).optional(), // 'prendre en force'
  level: z.string().max(120).optional(), // 'débutant'
  context: z
    .array(z.object({ label: z.string().min(1).max(80), value: z.string().min(1).max(400) }))
    .max(20)
    .default([]),
  instructions: z.string().max(2000).optional(),
});
export type ComposePluginBody = z.infer<typeof composePluginBodySchema>;

export const composePluginResultSchema = z.object({
  prompt: z.string(),
  closingPrompt: z.string(),
});
export type ComposePluginResult = z.infer<typeof composePluginResultSchema>;

// ─── ingest : résumé (texte) + spec de champs → snapshot structuré (via l'IA, facturé) ───

export const aiFieldTypeSchema = z.enum(['string', 'number', 'integer', 'boolean', 'stringArray']);
export type AiFieldType = z.infer<typeof aiFieldTypeSchema>;

/** Description d'un champ à extraire (le plugin possède l'interprétation de son snapshot). */
export const aiFieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/),
  type: aiFieldTypeSchema,
  description: z.string().max(200).optional(),
  optional: z.boolean().default(false),
});
export type AiField = z.infer<typeof aiFieldSchema>;

export const ingestPluginBodySchema = z.object({
  profileId: z.string().uuid(),
  sourceApp: z.string().min(1),
  summary: z.string().min(1).max(4000),
  fields: z.array(aiFieldSchema).min(1).max(20),
  modelId: z.string().optional(),
});
export type IngestPluginBody = z.infer<typeof ingestPluginBodySchema>;

export const ingestPluginResultSchema = z.object({
  snapshot: z.record(z.unknown()),
  creditsSpent: z.number(),
});
export type IngestPluginResult = z.infer<typeof ingestPluginResultSchema>;
