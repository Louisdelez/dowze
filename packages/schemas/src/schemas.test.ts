import { describe, it, expect } from 'vitest';
import {
  SCHEMAS_VERSION,
  skillSchema,
  bridgeRequestSchema,
  bridgeResponseSchema,
  bridgePayloadSchemaByOperation,
  rubricSchema,
  planningEntrySchema,
} from './index';

const ISO = '2026-06-08T10:00:00.000Z';
const UUID = '11111111-1111-4111-8111-111111111111';
const UUID2 = '22222222-2222-4222-8222-222222222222';

describe('@dowze/schemas', () => {
  it('expose une version', () => {
    expect(SCHEMAS_VERSION).toBe('2.19.0');
  });

  it('parse une compétence valide et applique les valeurs par défaut', () => {
    const skill = skillSchema.parse({
      id: UUID,
      slug: 'dechiffrer-lire',
      title: 'Déchiffrer et lire',
      kind: 'savoir-faire',
      depth: 0,
      isRoot: true,
    });
    expect(skill.prerequisites).toEqual([]);
    expect(skill.masteryThreshold).toBe(0.95);
    expect(skill.epistemicStatus).toBe('etabli');
  });

  it('rejette un slug non kebab-case', () => {
    const r = skillSchema.safeParse({
      id: UUID,
      slug: 'Déchiffrer Lire',
      title: 'x',
      kind: 'savoir',
      depth: 0,
    });
    expect(r.success).toBe(false);
  });

  it('le wrapper du pont est strict (rejette les champs inconnus)', () => {
    const base = {
      bridgeVersion: '1' as const,
      requestId: UUID,
      operation: 'generer-competence' as const,
      prompt: 'Génère la compétence…',
      responseSchema: { type: 'object' },
      example: {},
      seed: 'seed-123',
      createdAtIso: ISO,
    };
    expect(bridgeRequestSchema.safeParse(base).success).toBe(true);
    expect(bridgeRequestSchema.safeParse({ ...base, champInconnu: 1 }).success).toBe(false);
  });

  it('le registre couvre toutes les opérations et valide un payload', () => {
    const ops = Object.keys(bridgePayloadSchemaByOperation);
    expect(ops).toContain('generer-grille');
    const payload = bridgePayloadSchemaByOperation['generer-grille'].parse({
      rubric: rubricSchema.parse({
        skillId: UUID,
        criteria: [{ id: 'critere-1', label: 'Sait lire un texte simple' }],
      }),
    });
    expect(payload).toBeTruthy();
  });

  it('valide une enveloppe retour du pont', () => {
    const res = bridgeResponseSchema.parse({
      bridgeVersion: '1',
      requestId: UUID,
      operation: 'generer-plan',
      payload: { entries: [] },
    });
    expect(res.operation).toBe('generer-plan');
  });

  it('parse une entrée de planning avec statut neutre par défaut', () => {
    const entry = planningEntrySchema.parse({
      id: UUID,
      profileId: UUID2,
      dateIso: ISO,
      kind: 'apprentissage',
      durationMin: 25,
    });
    expect(entry.status).toBe('prevu');
    expect(entry.skillId).toBeNull();
  });
});
