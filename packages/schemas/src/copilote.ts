import { z } from 'zod';

/**
 * Le Copilote — l'IA interne orchestratrice (par API).
 *
 * Deux tâches utilitaires :
 *  1. COMPOSER un prompt LISIBLE pour l'IA de l'élève (déterministe, côté serveur).
 *  2. INGÉRER le résumé de séance (texte libre) → un `SessionSnapshot` structuré.
 *
 * Règle d'or : le Copilote EXTRAIT des faits, il ne NOTE pas. C'est Dowze qui
 * recalcule la maîtrise (BKT). Voir docs/10-APP-WEB/15-copilote-orchestrateur.md.
 */

/** Résultat d'une séance sur la compétence ciblée. */
export const sessionOutcomeSchema = z.enum(['maitrise', 'progres', 'bloque']);
export type SessionOutcome = z.infer<typeof sessionOutcomeSchema>;

/** État affectif ressenti (lissé côté app en EMA plus tard). */
export const affectSchema = z.enum(['positif', 'neutre', 'frustre']);
export type Affect = z.infer<typeof affectSchema>;

/**
 * Le snapshot extrait du résumé texte. Schéma STRICT imposé au LLM via
 * structured outputs. Tous les champs sont requis (compat OpenAI strict /
 * Gemini responseSchema) ; `uncertainty` est nullable pour ne rien inventer.
 */
export const sessionSnapshotSchema = z
  .object({
    outcome: sessionOutcomeSchema.describe(
      "maitrise = l'élève sait faire seul ; progres = a avancé mais pas encore autonome ; bloque = n'y arrive pas encore",
    ),
    evidence: z
      .string()
      .describe(
        "Un FAIT OBSERVABLE de la séance qui justifie l'outcome. N'invente rien : si le résumé ne le dit pas, écris « non précisé ».",
      ),
    errors: z
      .array(z.string())
      .describe('Erreurs ou confusions repérées (liste courte ; tableau vide si aucune).'),
    affect: affectSchema.describe("État ressenti de l'élève d'après le résumé."),
    covered: z.string().describe('Ce qui a été réellement vu pendant la séance.'),
    blockers: z
      .array(z.string())
      .describe('Ce qui bloque encore (tableau vide si rien ne bloque).'),
    nextStep: z.string().describe("La prochaine étape logique pour l'élève."),
    carnetNote: z
      .string()
      .describe('Une phrase claire et bienveillante à écrire dans le carnet de bord.'),
    uncertainty: z
      .string()
      .nullable()
      .describe('Ce que le résumé ne permet PAS de conclure ; null si tout est clair.'),
  })
  .strict();
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

/** Fournisseurs d'IA supportés par le Copilote (multi-fournisseurs). */
export const aiProviderSchema = z.enum(['openai', 'google', 'mistral', 'deepseek', 'anthropic']);
export type AiProvider = z.infer<typeof aiProviderSchema>;

/** Une entrée du catalogue de modèles (table `ai_model`). */
export const aiModelSchema = z.object({
  id: z.string(), // identifiant public stable (ex. 'gpt-4o-mini')
  provider: aiProviderSchema,
  modelId: z.string(), // identifiant technique côté fournisseur
  label: z.string(),
  priceIn: z.number(), // USD / M tokens (entrée)
  priceOut: z.number(), // USD / M tokens (sortie)
  strict: z.boolean(), // supporte les structured outputs stricts
  euHosted: z.boolean(), // hébergement UE (RGPD)
  note: z.string(),
});
export type AiModel = z.infer<typeof aiModelSchema>;

/** Mode de facturation choisi par l'élève. */
export const billingModeSchema = z.enum(['credits', 'byok']);
export type BillingMode = z.infer<typeof billingModeSchema>;

/** Requête : composer le prompt de séance du jour. */
export const composeRequestSchema = z
  .object({
    profileId: z.string().uuid(),
  })
  .strict();
export type ComposeRequest = z.infer<typeof composeRequestSchema>;

/** Requête : ingérer le résumé de séance (texte libre) et l'appliquer. */
export const ingestRequestSchema = z
  .object({
    profileId: z.string().uuid(),
    skillId: z.string().uuid(),
    summary: z.string().min(1).max(20000),
    modelId: z.string().optional(), // sinon : réglage de l'élève, sinon défaut
  })
  .strict();
export type IngestRequest = z.infer<typeof ingestRequestSchema>;

/** Réglages Copilote lisibles (JAMAIS la clé BYOK en clair). */
export const copiloteSettingsViewSchema = z.object({
  profileId: z.string().uuid(),
  modelId: z.string(),
  billing: billingModeSchema,
  byokProvider: aiProviderSchema.nullable(),
  hasByokKey: z.boolean(),
});
export type CopiloteSettingsView = z.infer<typeof copiloteSettingsViewSchema>;

/** Mise à jour des réglages (byokApiKey : null = effacer, undefined = inchangé). */
export const updateSettingsSchema = z
  .object({
    profileId: z.string().uuid(),
    modelId: z.string().optional(),
    billing: billingModeSchema.optional(),
    byokProvider: aiProviderSchema.nullable().optional(),
    byokApiKey: z.string().max(300).nullable().optional(),
  })
  .strict();
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

/** Solde de crédits Dowze (mode `credits`). */
export const creditBalanceSchema = z.object({
  profileId: z.string().uuid(),
  balance: z.number(), // en crédits Dowze (1 crédit ≈ 0,1 centime)
});
export type CreditBalance = z.infer<typeof creditBalanceSchema>;
