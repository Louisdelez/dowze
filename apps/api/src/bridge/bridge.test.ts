import { describe, it, expect } from 'vitest';
import { bridgeRequestSchema } from '@dowze/schemas';
import { validateBridgeResponseText } from '@dowze/core';
import { responseSchemaFor, promptFor, exampleFor } from './prompts';
import { GenerationService } from './generation.service';

const REQ = '33333333-3333-4333-8333-333333333333';

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

describe('bridge — GenerationService', () => {
  it('produit un .json aller conforme au schéma strict', () => {
    const service = new GenerationService();
    const req = service.buildRequest('generer-grille', {
      requestId: REQ,
      seed: 'graine-1',
      nowIso: '2026-06-08T10:00:00.000Z',
    });
    // Doit passer la validation stricte de l'enveloppe aller.
    expect(bridgeRequestSchema.parse(req)).toBeTruthy();
    expect(req.operation).toBe('generer-grille');
  });

  it('l’exemple d’une grille est lui-même un retour valide', () => {
    const service = new GenerationService();
    const req = service.buildRequest('generer-grille', {
      requestId: REQ,
      seed: 'g',
      nowIso: '2026-06-08T10:00:00.000Z',
    });
    const envelope = JSON.stringify({
      bridgeVersion: '1',
      requestId: REQ,
      operation: 'generer-grille',
      payload: req.example,
    });
    const result = validateBridgeResponseText(envelope, {
      expectedRequestId: REQ,
      expectedOperation: 'generer-grille',
    });
    expect(result.ok).toBe(true);
  });
});
