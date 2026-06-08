import { z } from 'zod';
import { uuidSchema, slugSchema, localeSchema, timezoneSchema, isoDateTimeSchema } from './common';

/**
 * La communauté : Classes, communication et binômes
 * (cf. docs/10-APP-WEB/05-systeme-communautaire/05-classes-et-communication.md).
 * Tout fonctionne aussi à n=1 (la communauté est émergente/optionnelle).
 */

/** Type de classe (axe de regroupement « dur »). */
export const classeTypeSchema = z.enum(['tronc-commun', 'specialisation', 'projet']);
export type ClasseType = z.infer<typeof classeTypeSchema>;

/** Cycle de vie d'une classe. */
export const classeCycleSchema = z.enum(['trimestre', 'semestre', 'annee']);
export type ClasseCycle = z.infer<typeof classeCycleSchema>;

export const classeStatusSchema = z.enum(['active', 'en-brassage', 'archivee']);
export type ClasseStatus = z.infer<typeof classeStatusSchema>;

/** Une Classe : unité sociale (~24), formée automatiquement. */
export const classeSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().min(1).max(120),
  locale: localeSchema,
  timezone: timezoneSchema,
  type: classeTypeSchema,
  cycle: classeCycleSchema.default('trimestre'),
  status: classeStatusSchema.default('active'),
  createdAtIso: isoDateTimeSchema,
});
export type Classe = z.infer<typeof classeSchema>;

/** Rôle d'un membre dans la classe (« pont » = lien faible conservé au brassage). */
export const membershipRoleSchema = z.enum(['membre', 'pont']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const membershipSchema = z.object({
  classeId: uuidSchema,
  profileId: uuidSchema,
  role: membershipRoleSchema.default('membre'),
  joinedAtIso: isoDateTimeSchema,
});
export type Membership = z.infer<typeof membershipSchema>;

/** Type de canal de communication. */
export const channelKindSchema = z.enum(['dm', 'groupe', 'classe', 'binome']);
export type ChannelKind = z.infer<typeof channelKindSchema>;

export const channelSchema = z.object({
  id: uuidSchema,
  kind: channelKindSchema,
  classeId: uuidSchema.nullable().default(null),
  memberIds: z.array(uuidSchema).default([]),
  createdAtIso: isoDateTimeSchema,
});
export type Channel = z.infer<typeof channelSchema>;

export const messageSchema = z.object({
  id: uuidSchema,
  channelId: uuidSchema,
  authorId: uuidSchema,
  body: z.string().min(1).max(8000),
  createdAtIso: isoDateTimeSchema,
});
export type Message = z.infer<typeof messageSchema>;

/** Un binôme/trinôme de travail (rotation hebdomadaire). */
export const binomeSchema = z.object({
  id: uuidSchema,
  classeId: uuidSchema,
  weekIso: isoDateTimeSchema,
  memberIds: z.array(uuidSchema).min(2).max(3),
});
export type Binome = z.infer<typeof binomeSchema>;
