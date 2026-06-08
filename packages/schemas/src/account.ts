import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

/**
 * Comptes, rôles et système parental (façon Pronote, cf.
 * docs/10-APP-WEB/05-systeme-communautaire/06-systeme-parental-et-moderation.md).
 * Les mineurs ne sont PAS bridés : même expérience pour tous. La sécurité vient
 * du suivi parental + de la modération, pas de la restriction.
 */

export const accountRoleSchema = z.enum([
  'eleve',
  'pair',
  'mentor',
  'moderateur',
  'parent',
  'admin',
]);
export type AccountRole = z.infer<typeof accountRoleSchema>;

export const accountSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  role: accountRoleSchema.default('eleve'),
  /** Profil pédagogique associé (null pour un compte parent sans élève lié). */
  profileId: uuidSchema.nullable().default(null),
  isMinor: z.boolean().default(false),
  createdAtIso: isoDateTimeSchema,
});
export type Account = z.infer<typeof accountSchema>;

/** Statut du consentement parental (« email plus » vérifiable). */
export const consentStatusSchema = z.enum(['en-attente', 'accorde', 'refuse']);
export type ConsentStatus = z.infer<typeof consentStatusSchema>;

/** Le responsable légal d'un compte mineur. */
export const guardianSchema = z.object({
  id: uuidSchema,
  minorAccountId: uuidSchema,
  email: z.string().email(),
  consentStatus: consentStatusSchema.default('en-attente'),
  consentAtIso: isoDateTimeSchema.nullable().default(null),
  /** Le parent a-t-il créé son propre compte de suivi (optionnel) ? */
  hasDashboardAccount: z.boolean().default(false),
});
export type Guardian = z.infer<typeof guardianSchema>;

/**
 * Bilan périodique envoyé au responsable (synthèse — JAMAIS le contenu privé brut).
 */
export const parentalDigestSchema = z.object({
  minorAccountId: uuidSchema,
  periodStartIso: isoDateTimeSchema,
  periodEndIso: isoDateTimeSchema,
  progressionSummary: z.string().max(4000),
  planningSummary: z.string().max(4000),
  presenceSummary: z.string().max(4000),
  /** Synthèse communautaire de haut niveau, sans messages privés. */
  communitySynthesis: z.string().max(4000),
});
export type ParentalDigest = z.infer<typeof parentalDigestSchema>;
