import { bridgeRequestSchema, type BridgeOperation, type BridgeRequest } from '@dowze/schemas';

/**
 * Construit le `.json` ALLER (intra → IA), validé par le schéma strict.
 * Le `responseSchema` (JSON Schema attendu) est fourni par l'appelant
 * (généré côté API à partir du schéma Zod du payload).
 */
export interface BuildRequestInput {
  requestId: string;
  operation: BridgeOperation;
  prompt: string;
  responseSchema: Record<string, unknown>;
  example: unknown;
  seed: string;
  nowIso: string;
}

export function buildBridgeRequest(input: BuildRequestInput): BridgeRequest {
  return bridgeRequestSchema.parse({
    bridgeVersion: '1',
    requestId: input.requestId,
    operation: input.operation,
    prompt: input.prompt,
    responseSchema: input.responseSchema,
    example: input.example,
    seed: input.seed,
    createdAtIso: input.nowIso,
  });
}
