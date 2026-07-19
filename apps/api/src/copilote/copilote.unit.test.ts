import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.util';
import { creditsForUsage, estimateCredits } from './credits.service';
import type { AiModel } from '@dowze/schemas';

const KEY = randomBytes(32).toString('base64');

const MODEL: AiModel = {
  id: 'gpt-4o-mini',
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  label: 'GPT-4o mini',
  priceIn: 0.15,
  priceOut: 0.6,
  strict: true,
  euHosted: false,
  note: '',
};

describe('crypto BYOK', () => {
  it('chiffre puis déchiffre à l’identique', () => {
    const secret = 'sk-test-abc123';
    const enc = encryptSecret(secret, KEY);
    expect(enc).not.toContain(secret); // jamais en clair
    expect(decryptSecret(enc, KEY)).toBe(secret);
  });

  it('rejette une clé de mauvaise taille', () => {
    expect(() => encryptSecret('x', 'trop-court')).toThrow();
  });

  it('échoue au déchiffrement si altéré', () => {
    const enc = encryptSecret('sk-live', KEY);
    const tampered = `${enc.slice(0, -4)}AAAA`;
    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });
});

describe('tarification en crédits', () => {
  it('coûte au moins 1 crédit', () => {
    expect(creditsForUsage(MODEL, 0, 0)).toBe(1);
  });

  it('l’estimation prudente couvre une séance typique', () => {
    const est = estimateCredits(MODEL);
    const real = creditsForUsage(MODEL, 6000, 1200);
    expect(est).toBeGreaterThanOrEqual(real); // pré-débit ≥ coût réel → remboursement
  });
});
