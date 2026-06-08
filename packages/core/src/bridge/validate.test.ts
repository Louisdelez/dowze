import { describe, it, expect } from 'vitest';
import { validateBridgeResponseText } from './validate';

const REQ = '33333333-3333-4333-8333-333333333333';
const id = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

function skill(n: number, prereqs: number[], depth: number, isRoot = false) {
  return {
    id: id(n),
    slug: `competence-${n}`,
    title: `Compétence ${n}`,
    kind: 'savoir',
    depth,
    prerequisites: prereqs.map(id),
    isRoot,
  };
}

function envelope(payload: unknown, operation = 'generer-competence'): string {
  return JSON.stringify({ bridgeVersion: '1', requestId: REQ, operation, payload });
}

const opts = { expectedRequestId: REQ, expectedOperation: 'generer-competence' as const };

const validPayload = {
  skill: skill(3, [2], 2),
  closure: [skill(1, [], 0, true), skill(2, [1], 1)],
};

describe('pont .json — validation du retour', () => {
  it('accepte un retour valide et clos', () => {
    const r = validateBridgeResponseText(envelope(validPayload), opts);
    expect(r.ok).toBe(true);
  });

  it('rejette un JSON invalide', () => {
    const r = validateBridgeResponseText('{pas du json', opts);
    expect(r.ok).toBe(false);
  });

  it('rejette un champ inconnu dans l’enveloppe (strict)', () => {
    const bad = JSON.stringify({
      bridgeVersion: '1',
      requestId: REQ,
      operation: 'generer-competence',
      payload: validPayload,
      intrus: true,
    });
    const r = validateBridgeResponseText(bad, opts);
    expect(r.ok).toBe(false);
  });

  it('rejette un requestId inattendu', () => {
    const r = validateBridgeResponseText(envelope(validPayload), {
      ...opts,
      expectedRequestId: id(9),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.path).toBe('requestId');
  });

  it('rejette une opération inattendue', () => {
    const r = validateBridgeResponseText(envelope(validPayload, 'generer-plan'), opts);
    expect(r.ok).toBe(false);
  });

  it('rejette la prototype pollution', () => {
    const poison = '{"bridgeVersion":"1","requestId":"' + REQ + '","operation":"generer-competence","payload":{"__proto__":{"x":1},"skill":{},"closure":[]}}';
    const r = validateBridgeResponseText(poison, opts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.message).toMatch(/interdite/);
  });

  it('rejette un payload incohérent avec l’opération', () => {
    const r = validateBridgeResponseText(envelope({ skill: { id: 'pas-un-uuid' } }), opts);
    expect(r.ok).toBe(false);
  });

  it('rejette un graphe avec cycle (ossature)', () => {
    const cyclic = { skills: [skill(1, [2], 1), skill(2, [1], 1)] };
    const r = validateBridgeResponseText(envelope(cyclic, 'generer-ossature'), {
      expectedRequestId: REQ,
      expectedOperation: 'generer-ossature',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /cycle/.test(e.message))).toBe(true);
  });

  it('rejette un JSON trop volumineux', () => {
    const r = validateBridgeResponseText(envelope(validPayload), { ...opts, maxBytes: 10 });
    expect(r.ok).toBe(false);
  });
});
