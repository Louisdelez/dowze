import { z } from 'zod';
import {
  uuidSchema,
  slugSchema,
  epistemicStatusSchema,
  probabilitySchema,
} from './common';

/**
 * La compétence (nœud d'Atlas) et le graphe de prérequis.
 *
 * Représentation canonique : **liste d'adjacence** (chaque compétence porte ses
 * prérequis directs). La loi de clôture (cf. @dowze/core) garantit qu'aucun
 * prérequis ne pend : tout `prerequisites[i]` doit exister dans le graphe.
 */

/** Nature de la compétence (savoir au sens large). */
export const skillKindSchema = z.enum([
  'savoir',
  'savoir-faire',
  'savoir-etre',
  'capacite-corporelle',
  'civique',
  'esthetique',
]);
export type SkillKind = z.infer<typeof skillKindSchema>;

/** Une compétence : un nœud du graphe des savoirs. */
export const skillSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  kind: skillKindSchema,
  /**
   * Profondeur dans le DAG (les racines valent 0). Les prérequis ont une
   * profondeur strictement inférieure → garantit la terminaison de la clôture.
   */
  depth: z.number().int().nonnegative(),
  /** Prérequis directs (ids de compétences). Vide pour une racine. */
  prerequisites: z.array(uuidSchema).default([]),
  isRoot: z.boolean().default(false),
  epistemicStatus: epistemicStatusSchema.default('etabli'),
  /** Demi-vie du savoir en années (null = stable). Sert à programmer la révision. */
  halfLifeYears: z.number().positive().nullable().default(null),
  /** Seuil de maîtrise (probabilité BKT) à atteindre pour valider. */
  masteryThreshold: probabilitySchema.default(0.95),
  sources: z.array(z.string().min(1)).default([]),
});
export type Skill = z.infer<typeof skillSchema>;

/** Un lien de prérequis (forme « arête », utile côté base de données). */
export const prerequisiteEdgeSchema = z.object({
  skillId: uuidSchema,
  prerequisiteId: uuidSchema,
});
export type PrerequisiteEdge = z.infer<typeof prerequisiteEdgeSchema>;

/** Un graphe de compétences = un ensemble de nœuds (liste d'adjacence). */
export const skillGraphSchema = z.object({
  skills: z.array(skillSchema),
});
export type SkillGraph = z.infer<typeof skillGraphSchema>;
