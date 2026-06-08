import { z } from 'zod';
import { uuidSchema, isoDateTimeSchema } from './common';
import { skillSchema } from './skill';
import { expeditionSchema } from './cursus';
import { rubricSchema } from './validation';
import { planningEntrySchema } from './planning';
import { lessonSchema } from './content';

/**
 * Le pont `.json` (PAS d'API) entre l'intra et l'IA externe.
 * (cf. docs/10-APP-WEB/10-pont-json.md)
 *
 * - L'intra produit un `.json` ALLER : `prompt` + `responseSchema` (le format
 *   attendu) + `example`.
 * - L'utilisateur le colle dans son IA ; l'IA renvoie un `.json` RETOUR.
 * - L'intra valide STRICTEMENT le retour (ici + pipeline @dowze/core).
 *
 * Les wrappers aller/retour sont `.strict()` : tout champ inconnu est rejeté.
 */

/** Les opérations supportées par le pont. */
export const bridgeOperationSchema = z.enum([
  'generer-competence',
  'generer-ossature',
  'generer-expedition',
  'generer-grille',
  'generer-cours',
  'generer-plan',
]);
export type BridgeOperation = z.infer<typeof bridgeOperationSchema>;

/** Le `.json` ALLER (intra → IA). */
export const bridgeRequestSchema = z
  .object({
    bridgeVersion: z.literal('1'),
    requestId: uuidSchema,
    operation: bridgeOperationSchema,
    prompt: z.string().min(1).max(20000),
    /** Le JSON Schema du retour attendu (transmis tel quel à l'IA). */
    responseSchema: z.record(z.unknown()),
    /** Un exemple de retour valide (few-shot). */
    example: z.unknown(),
    /** Graine de génération (reproductibilité). */
    seed: z.string().min(1),
    createdAtIso: isoDateTimeSchema,
  })
  .strict();
export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

/** Le `.json` RETOUR (IA → intra). Le `payload` est validé selon l'opération. */
export const bridgeResponseSchema = z
  .object({
    bridgeVersion: z.literal('1'),
    requestId: uuidSchema,
    operation: bridgeOperationSchema,
    payload: z.unknown(),
  })
  .strict();
export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;

// ── Payloads spécifiques par opération ──────────────────────────────────────

/** `generer-competence` : la compétence + TOUTE sa chaîne de prérequis (clôture). */
export const competencePayloadSchema = z.object({
  skill: skillSchema,
  /** La clôture : toutes les compétences dont `skill` dépend, jusqu'aux racines. */
  closure: z.array(skillSchema).default([]),
});
export type CompetencePayload = z.infer<typeof competencePayloadSchema>;

/** `generer-ossature` : un fragment de graphe (génération paresseuse du voisinage). */
export const ossaturePayloadSchema = z.object({
  skills: z.array(skillSchema).min(1),
});
export type OssaturePayload = z.infer<typeof ossaturePayloadSchema>;

/** `generer-expedition` : une expédition. */
export const expeditionPayloadSchema = z.object({ expedition: expeditionSchema });
export type ExpeditionPayload = z.infer<typeof expeditionPayloadSchema>;

/** `generer-grille` : la rubrique d'évaluation d'une compétence. */
export const grillePayloadSchema = z.object({ rubric: rubricSchema });
export type GrillePayload = z.infer<typeof grillePayloadSchema>;

/** `generer-cours` : une leçon. */
export const coursPayloadSchema = z.object({ lesson: lessonSchema });
export type CoursPayload = z.infer<typeof coursPayloadSchema>;

/** `generer-plan` : des entrées de planning proposées. */
export const planPayloadSchema = z.object({ entries: z.array(planningEntrySchema).default([]) });
export type PlanPayload = z.infer<typeof planPayloadSchema>;

/**
 * Registre : opération → schéma du payload attendu.
 * @dowze/core l'utilise pour valider `payload` après le wrapper.
 */
export const bridgePayloadSchemaByOperation = {
  'generer-competence': competencePayloadSchema,
  'generer-ossature': ossaturePayloadSchema,
  'generer-expedition': expeditionPayloadSchema,
  'generer-grille': grillePayloadSchema,
  'generer-cours': coursPayloadSchema,
  'generer-plan': planPayloadSchema,
} as const satisfies Record<BridgeOperation, z.ZodTypeAny>;
