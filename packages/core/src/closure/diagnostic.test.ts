import { describe, it, expect } from 'vitest';
import type { Skill } from '@dowze/schemas';
import { computePlacement } from './diagnostic';

const id = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);
function skill(n: number, prereqs: number[], depth: number, isRoot = false): Skill {
  return {
    id: id(n),
    slug: `c-${n}`,
    title: `C${n}`,
    description: '',
    kind: 'savoir',
    depth,
    prerequisites: prereqs.map(id),
    isRoot,
    epistemicStatus: 'etabli',
    halfLifeYears: null,
    masteryThreshold: 0.95,
    sources: [],
  };
}

// 1 → 2 → 3 ; 4 (racine)
const graph: Skill[] = [skill(1, [], 0, true), skill(2, [1], 1), skill(3, [2], 2), skill(4, [], 0, true)];

describe('diagnostic / placement', () => {
  it('démontrer une compétence maîtrise toute sa chaîne de prérequis', () => {
    const p = computePlacement(graph, [id(3)]);
    expect(new Set(p.masteredSkillIds)).toEqual(new Set([id(1), id(2), id(3)]));
  });

  it('propose la première compétence prescrite restante', () => {
    const p = computePlacement(graph, [id(3)]);
    expect(p.entrySkillId).toBe(id(4)); // 4 est la seule racine non maîtrisée
  });

  it('sans rien de démontré : entrée = une racine', () => {
    const p = computePlacement(graph, []);
    expect(p.masteredSkillIds).toEqual([]);
    expect([id(1), id(4)]).toContain(p.entrySkillId);
  });
});
