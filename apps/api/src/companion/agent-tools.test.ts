import { describe, expect, it } from 'vitest';
import type { CopiloteService } from '../copilote/copilote.service';
import { buildAgentTools, evalExpression } from './agent-tools';

describe('evalExpression (calculatrice sûre)', () => {
  it('opérations de base + priorités', () => {
    expect(evalExpression('1+2*3')).toBe(7);
    expect(evalExpression('(1+2)*3')).toBe(9);
    expect(evalExpression('10 - 4 - 3')).toBe(3); // associativité gauche
    expect(evalExpression('2 + 3 * 4 - 6 / 2')).toBe(11);
  });

  it('puissance associative à droite + unaire', () => {
    expect(evalExpression('2^3^2')).toBe(512); // 2^(3^2)
    expect(evalExpression('-2^2')).toBe(-4); // -(2^2)
    expect(evalExpression('2^-1')).toBe(0.5);
  });

  it('fonctions et constantes', () => {
    expect(evalExpression('sqrt(2)^2')).toBeCloseTo(2, 6);
    expect(evalExpression('round(pi*100)')).toBe(314);
    expect(evalExpression('abs(-5) + floor(2.9)')).toBe(7);
    expect(evalExpression('log(1000)')).toBeCloseTo(3, 6);
  });

  it('virgule décimale française + symboles', () => {
    expect(evalExpression('1,5 + 2,5')).toBe(4);
    expect(evalExpression('6 × 7')).toBe(42);
    expect(evalExpression('10 ÷ 4')).toBe(2.5);
  });

  it('corrige les erreurs de flottant', () => {
    expect(evalExpression('0.1 + 0.2')).toBe(0.3);
  });

  it('rejette les entrées invalides / dangereuses', () => {
    expect(() => evalExpression('')).toThrow();
    expect(() => evalExpression('1/0')).toThrow(/zéro/);
    expect(() => evalExpression('2 +')).toThrow();
    expect(() => evalExpression('(1+2')).toThrow(/Parenthèse/);
    expect(() => evalExpression('foo(2)')).toThrow(/inconnue/);
    expect(() => evalExpression('process')).toThrow(/inconnu/);
    expect(() => evalExpression('1;2')).toThrow();
    expect(() => evalExpression('a'.repeat(201))).toThrow(/trop longue/);
  });
});

describe('outils de continuité', () => {
  it('n’expose la Bibliothèque universelle que lorsqu’elle est profil-scopée', () => {
    const copilote = {} as CopiloteService;
    expect(Object.keys(buildAgentTools({ copilote, profileId: 'profil' }))).not.toContain(
      'chercher_memoire_ruche',
    );
    expect(
      Object.keys(
        buildAgentTools({
          copilote,
          profileId: 'profil',
          memorySearch: async () => [],
        }),
      ),
    ).toContain('chercher_memoire_ruche');
  });
});
