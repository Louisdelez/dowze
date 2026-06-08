import { z } from 'zod';
import { uuidSchema, localeSchema, timezoneSchema, isoDateTimeSchema } from './common';
import { cursusPhaseSchema } from './cursus';

/**
 * Le profil de l'apprenant et la « graine » de génération.
 * Le profil ne contient PAS d'identifiants de connexion (cf. account.ts) :
 * c'est la persona pédagogique.
 */

export const profileSchema = z.object({
  id: uuidSchema,
  displayName: z.string().min(1).max(80),
  /** Langue maternelle (L1) — le Mentor pense et explique en L1 par défaut. */
  locale: localeSchema,
  timezone: timezoneSchema,
  birthDate: z.string().date().nullable().default(null),
  createdAtIso: isoDateTimeSchema,
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * La graine : profil + contexte + date « ensemencent » la génération.
 * Même graine → même contenu (reproductible, équitable, auditable).
 */
export const seedSchema = z.object({
  profileId: uuidSchema,
  locale: localeSchema,
  /** Étiquettes de contexte (centres d'intérêt, projet en cours…). */
  contextTags: z.array(z.string().min(1)).default([]),
  dateIso: isoDateTimeSchema,
});
export type Seed = z.infer<typeof seedSchema>;

/**
 * Le placement : résultat du diagnostic. Où se situe l'élève dans le Cursus,
 * et quelles compétences sont déjà maîtrisées (point d'entrée prescrit).
 */
export const placementSchema = z.object({
  profileId: uuidSchema,
  phase: cursusPhaseSchema.default('tronc-commun'),
  masteredSkillIds: z.array(uuidSchema).default([]),
  /** Compétence d'entrée recommandée par le diagnostic. */
  entrySkillId: uuidSchema.nullable().default(null),
  createdAtIso: isoDateTimeSchema,
});
export type Placement = z.infer<typeof placementSchema>;
