import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';

/**
 * Modération (façon Discord) + alertes parentales graduées
 * (cf. docs/10-APP-WEB/05-systeme-communautaire/06-systeme-parental-et-moderation.md).
 * Chaîne : AutoMod → ML toxicité bidirectionnel → modérateurs humains.
 * Si un mineur est auteur OU victime d'un incident grave → alerte parent.
 */

export const incidentSourceSchema = z.enum(['automod', 'ml-toxicite', 'signalement-humain']);
export type IncidentSource = z.infer<typeof incidentSourceSchema>;

export const incidentSeveritySchema = z.enum(['faible', 'moyen', 'grave', 'critique']);
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;

export const incidentStatusSchema = z.enum([
  'ouvert',
  'en-revue-humaine',
  'resolu',
  'escalade',
]);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const moderationIncidentSchema = z.object({
  id: uuidSchema,
  source: incidentSourceSchema,
  severity: incidentSeveritySchema,
  /** Référence au contenu concerné (id de message, etc.). */
  contentRef: z.string().min(1).max(200),
  authorId: uuidSchema.nullable().default(null),
  /** Victime éventuelle (la détection est bidirectionnelle). */
  victimId: uuidSchema.nullable().default(null),
  status: incidentStatusSchema.default('ouvert'),
  createdAtIso: isoDateTimeSchema,
});
export type ModerationIncident = z.infer<typeof moderationIncidentSchema>;

/** Action prise par un modérateur humain (qui tranche toujours en dernier). */
export const moderationActionKindSchema = z.enum([
  'aucune',
  'avertissement',
  'masquage',
  'suspension',
  'escalade',
]);
export type ModerationActionKind = z.infer<typeof moderationActionKindSchema>;

export const moderationActionSchema = z.object({
  id: uuidSchema,
  incidentId: uuidSchema,
  actorId: uuidSchema,
  kind: moderationActionKindSchema,
  reason: z.string().max(2000).default(''),
  createdAtIso: isoDateTimeSchema,
});
export type ModerationAction = z.infer<typeof moderationActionSchema>;

/** Alerte parentale graduée — toujours validée par un humain avant envoi. */
export const parentalAlertSchema = z.object({
  id: uuidSchema,
  minorAccountId: uuidSchema,
  guardianEmail: z.string().email(),
  incidentId: uuidSchema.nullable().default(null),
  severity: incidentSeveritySchema,
  reason: z.string().min(1).max(2000),
  humanValidated: z.boolean().default(false),
  sentAtIso: isoDateTimeSchema.nullable().default(null),
});
export type ParentalAlert = z.infer<typeof parentalAlertSchema>;
