import { z } from 'zod';
import { uuidSchema, slugSchema } from './common';

/**
 * Le Cursus : l'itinéraire prescrit à travers l'Atlas.
 * Organisé non par matières mais par **1 finalité + 3 fils + 1 moteur**
 * (cf. docs/03-ARCHITECTURE/07-cursus-et-specialisation.md).
 */

/** Les trois fils du tronc commun. */
export const filSchema = z.enum(['fondations', 'aptitudes-durables', 'concepts-cles']);
export type Fil = z.infer<typeof filSchema>;

/** Les piliers de l'Épanouissement (la finalité, qui remplace la note). */
export const flourishingPillarSchema = z.enum([
  'epanouissement-present',
  'maitrise-de-transfert',
  'caractere-socio-emotionnel',
]);
export type FlourishingPillar = z.infer<typeof flourishingPillarSchema>;

/** Le gabarit d'une Expédition (le moteur du Cursus). */
export const expeditionPhaseSchema = z.enum(['etincelle', 'question', 'defi', 'acte', 'trace']);
export type ExpeditionPhase = z.infer<typeof expeditionPhaseSchema>;

export const expeditionStatusSchema = z.enum(['proposee', 'en-cours', 'terminee', 'archivee']);
export type ExpeditionStatus = z.infer<typeof expeditionStatusSchema>;

/** Une Expédition : l'unité d'apprentissage (2-6 semaines) qui remplace le « cours ». */
export const expeditionSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  title: z.string().min(1).max(200),
  grandeQuestion: z.string().min(1).max(500),
  fils: z.array(filSchema).min(1),
  /** Compétences visées par l'expédition. */
  skillIds: z.array(uuidSchema).default([]),
  durationWeeks: z.number().int().min(2).max(6),
  phase: expeditionPhaseSchema.default('etincelle'),
  status: expeditionStatusSchema.default('proposee'),
});
export type Expedition = z.infer<typeof expeditionSchema>;

/** Un Module-éclair : compétence périssable apprise juste-à-temps, jetable. */
export const moduleEclairSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  title: z.string().min(1).max(200),
  tool: z.string().max(200).default(''),
  /** Indication de péremption (texte libre, ex. « lié à la v18 de l'outil »). */
  perishabilityHint: z.string().max(500).default(''),
});
export type ModuleEclair = z.infer<typeof moduleEclairSchema>;

/** Phase du parcours : tronc commun (prescrit) puis spécialisation (choisie). */
export const cursusPhaseSchema = z.enum(['tronc-commun', 'specialisation']);
export type CursusPhase = z.infer<typeof cursusPhaseSchema>;
