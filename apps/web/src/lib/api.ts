import type { BridgeOperation } from '@dowze/schemas';

/** Client minimal vers le backend Dowze (l'intra-core). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface CreateRequestInput {
  operation: BridgeOperation;
  requestId: string;
  seed: string;
  instruction?: string;
}

export function createBridgeRequest(input: CreateRequestInput): Promise<unknown> {
  return post('/bridge/requests', input);
}

export interface ImportResponseInput {
  raw: string;
  expectedRequestId: string;
  expectedOperation: BridgeOperation;
}

export function importBridgeResponse(input: ImportResponseInput): Promise<unknown> {
  return post('/bridge/responses', input);
}
