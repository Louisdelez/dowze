import { z } from 'zod';

/**
 * Primitives communes réutilisées par tous les schémas du domaine.
 * Un seul endroit pour les formats d'identifiants, dates, langues, etc.
 */

/** Identifiant unique (UUID v4). */
export const uuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof uuidSchema>;

/** Slug en kebab-case (ex. `dechiffrer-lire`). Stable, lisible, sans accents. */
export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug attendu en kebab-case minuscule');
export type Slug = z.infer<typeof slugSchema>;

/** Date-heure ISO 8601 (ex. `2026-06-08T10:00:00.000Z`). */
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** Étiquette de langue BCP-47 simplifiée (`fr`, `fr-CH`, `en`). */
export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'locale attendue au format BCP-47 (ex. fr, fr-CH)');
export type Locale = z.infer<typeof localeSchema>;

/** Fuseau horaire IANA (ex. `Europe/Zurich`). */
export const timezoneSchema = z.string().min(1).max(64);
export type Timezone = z.infer<typeof timezoneSchema>;

/** Probabilité dans [0, 1]. */
export const probabilitySchema = z.number().min(0).max(1);
export type Probability = z.infer<typeof probabilitySchema>;

/**
 * Statut épistémique d'un savoir (cf. Atlas) : tout savoir n'a pas la même
 * stabilité. Sert à signaler ce qui est révisable.
 */
export const epistemicStatusSchema = z.enum(['etabli', 'en-debat', 'emergent', 'obsolescent']);
export type EpistemicStatus = z.infer<typeof epistemicStatusSchema>;
