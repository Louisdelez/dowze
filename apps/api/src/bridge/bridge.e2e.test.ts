import { describe, it, expect } from 'vitest';
import { buildBridgeRequest, validateBridgeResponseText } from '@dowze/core';
import { competencePayloadSchema } from '@dowze/schemas';
import { promptFor, responseSchemaFor, exampleFor } from './prompts';
import retourCompetence from './__fixtures__/retour-competence.json';

/**
 * Test bout-en-bout du pont .json (sans API/IA réelles) :
 *   1. l'intra fabrique le .json ALLER ;
 *   2. on simule un .json RETOUR réel (fixture) ;
 *   3. l'intra le valide STRICTEMENT (taille, parse, anti-pollution, schéma, clôture).
 */

const REQ = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('pont .json — bout-en-bout (generer-competence)', () => {
  it('1. l’aller est bien formé', () => {
    const aller = buildBridgeRequest({
      requestId: REQ,
      operation: 'generer-competence',
      prompt: promptFor('generer-competence', { seed: 'graine-lecture' }),
      responseSchema: responseSchemaFor('generer-competence'),
      example: exampleFor('generer-competence'),
      seed: 'graine-lecture',
      nowIso: '2026-06-08T10:00:00.000Z',
    });
    expect(aller.operation).toBe('generer-competence');
    expect(aller.prompt).toContain('clôture');
  });

  it('2-3. le retour réel passe la validation stricte et la loi de clôture', () => {
    const raw = JSON.stringify(retourCompetence);
    const result = validateBridgeResponseText(raw, {
      expectedRequestId: REQ,
      expectedOperation: 'generer-competence',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const payload = competencePayloadSchema.parse(result.payload);
      expect(payload.skill.slug).toBe('lire-comprendre-texte');
      // La clôture fournit les deux racines prérequises (zéro trou).
      expect(payload.closure.map((s) => s.slug).sort()).toEqual([
        'comprendre-oral-l1',
        'dechiffrer-lire',
      ]);
    }
  });

  it('rejette un retour dont la clôture est incomplète (trou)', () => {
    const troue = {
      ...retourCompetence,
      payload: { skill: retourCompetence.payload.skill, closure: [] }, // prérequis manquants
    };
    const result = validateBridgeResponseText(JSON.stringify(troue), {
      expectedRequestId: REQ,
      expectedOperation: 'generer-competence',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /dangling-prerequisite/.test(e.message))).toBe(true);
    }
  });
});
