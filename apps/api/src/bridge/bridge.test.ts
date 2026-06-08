import { describe, it, expect } from 'vitest';
import { bridgeRequestSchema } from '@dowze/schemas';
import { buildBridgeRequest, validateBridgeResponseText } from '@dowze/core';
import { responseSchemaFor, promptFor, exampleFor } from './prompts';

// NB : on teste la composition PURE (prompts + @dowze/core). On n'importe pas
// les services NestJS ici pour éviter de charger le runtime Nest sous vitest.

const REQ = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-06-08T10:00:00.000Z';

describe('bridge — prompts', () => {
  it('génère un JSON Schema non vide pour chaque opération', () => {
    for (const op of ['generer-competence', 'generer-grille', 'generer-plan'] as const) {
      const schema = responseSchemaFor(op);
      expect(schema).toBeTypeOf('object');
      expect(Object.keys(schema).length).toBeGreaterThan(0);
    }
  });

  it('le prompt contient la graine', () => {
    expect(promptFor('generer-grille', { seed: 'graine-xyz' })).toContain('graine-xyz');
  });

  it('fournit un exemple pour chaque opération', () => {
    for (const op of [
      'generer-competence',
      'generer-ossature',
      'generer-grille',
      'generer-cours',
      'generer-plan',
      'generer-expedition',
    ] as const) {
      expect(exampleFor(op)).toBeTruthy();
    }
  });
});

describe('bridge — construction du .json aller', () => {
  it('produit un aller conforme au schéma strict', () => {
    const req = buildBridgeRequest({
      requestId: REQ,
      operation: 'generer-grille',
      prompt: promptFor('generer-grille', { seed: 'g' }),
      responseSchema: responseSchemaFor('generer-grille'),
      example: exampleFor('generer-grille'),
      seed: 'g',
      nowIso: NOW,
    });
    expect(bridgeRequestSchema.parse(req)).toBeTruthy();
    expect(req.operation).toBe('generer-grille');
  });

  it('l’exemple d’une grille est lui-même un retour valide', () => {
    const envelope = JSON.stringify({
      bridgeVersion: '1',
      requestId: REQ,
      operation: 'generer-grille',
      payload: exampleFor('generer-grille'),
    });
    const result = validateBridgeResponseText(envelope, {
      expectedRequestId: REQ,
      expectedOperation: 'generer-grille',
    });
    expect(result.ok).toBe(true);
  });
});
