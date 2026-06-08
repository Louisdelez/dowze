import { ZodError } from 'zod';
import {
  bridgeResponseSchema,
  bridgePayloadSchemaByOperation,
  type BridgeOperation,
  type Skill,
} from '@dowze/schemas';
import { validateGraph } from '../closure/closure';
import { hasForbiddenKeys } from './prototype-guard';

/**
 * Pipeline de validation du `.json` RETOUR (entrée contrôlée par l'utilisateur).
 * (cf. docs/10-APP-WEB/14-backend.md §3)
 *
 *   1. taille bornée (anti-DoS)
 *   2. parse JSON
 *   3. garde-fou prototype pollution
 *   4. enveloppe stricte (Zod `.strict()`)
 *   5. cohérence requestId / opération
 *   6. payload validé selon l'opération
 *   7. cohérence du graphe (clôture) pour les payloads porteurs de compétences
 */

export interface BridgeError {
  path: string;
  message: string;
}

export type BridgeValidationResult<T = unknown> =
  | { ok: true; operation: BridgeOperation; payload: T }
  | { ok: false; errors: BridgeError[] };

export interface ValidateOptions {
  expectedRequestId: string;
  expectedOperation: BridgeOperation;
  /** Taille max du texte JSON (défaut 512 Ko). */
  maxBytes?: number;
}

function zodErrors(err: ZodError, prefix = ''): BridgeError[] {
  return err.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter((s) => s.length > 0).join('.') || '$',
    message: issue.message,
  }));
}

function extractSkills(op: BridgeOperation, payload: Record<string, unknown>): Skill[] | null {
  if (op === 'generer-competence') {
    const skill = payload.skill as Skill;
    const closure = (payload.closure as Skill[] | undefined) ?? [];
    return [skill, ...closure];
  }
  if (op === 'generer-ossature') {
    return payload.skills as Skill[];
  }
  return null;
}

/** Valide un `.json` retour fourni sous forme de texte. */
export function validateBridgeResponseText(
  rawText: string,
  opts: ValidateOptions,
): BridgeValidationResult {
  const maxBytes = opts.maxBytes ?? 512 * 1024;

  // 1. taille
  const bytes = Buffer.byteLength(rawText, 'utf8');
  if (bytes > maxBytes) {
    return { ok: false, errors: [{ path: '$', message: `JSON trop volumineux (${bytes} octets)` }] };
  }

  // 2. parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    return { ok: false, errors: [{ path: '$', message: `JSON invalide: ${(e as Error).message}` }] };
  }

  // 3. prototype pollution
  if (hasForbiddenKeys(parsed)) {
    return {
      ok: false,
      errors: [{ path: '$', message: 'clé interdite détectée (__proto__/constructor/prototype)' }],
    };
  }

  // 4. enveloppe stricte
  const env = bridgeResponseSchema.safeParse(parsed);
  if (!env.success) return { ok: false, errors: zodErrors(env.error) };

  // 5. cohérence requestId / opération
  const mismatch: BridgeError[] = [];
  if (env.data.requestId !== opts.expectedRequestId) {
    mismatch.push({ path: 'requestId', message: 'requestId inattendu' });
  }
  if (env.data.operation !== opts.expectedOperation) {
    mismatch.push({
      path: 'operation',
      message: `opération attendue: ${opts.expectedOperation}`,
    });
  }
  if (mismatch.length > 0) return { ok: false, errors: mismatch };

  // 6. payload selon opération
  const payloadSchema = bridgePayloadSchemaByOperation[env.data.operation];
  const pr = payloadSchema.safeParse(env.data.payload);
  if (!pr.success) return { ok: false, errors: zodErrors(pr.error, 'payload') };

  // 7. cohérence du graphe (clôture) si le payload porte des compétences
  const skills = extractSkills(env.data.operation, pr.data as Record<string, unknown>);
  if (skills) {
    const graph = validateGraph(skills);
    if (!graph.ok) {
      return {
        ok: false,
        errors: graph.violations.map((v) => ({
          path: `payload (${v.skillId})`,
          message: `${v.code}: ${v.detail}`,
        })),
      };
    }
  }

  return { ok: true, operation: env.data.operation, payload: pr.data };
}
