import { describe, it, expect } from 'vitest';
import type { Skill } from '@dowze/schemas';
import { learnableSkills, nextPrescribedSkill } from './frontier';

const id = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

function skill(n: number, prereqs: number[], depth: number, isRoot = false): Skill {
  return {
    id: id(n),
    slug: `competence-${n}`,
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

// 1 (racine) → 2 → 3 ; 4 (racine)
const graph: Skill[] = [
  skill(1, [], 0, true),
  skill(2, [1], 1),
  skill(3, [2], 2),
  skill(4, [], 0, true),
];

describe('frontière d’apprentissage', () => {
  it('sans rien de maîtrisé : seules les racines sont apprenables', () => {
    const learnable = learnableSkills(graph, new Set());
    expect(learnable.map((s) => s.slug).sort()).toEqual(['competence-1', 'competence-4']);
  });

  it('débloque la suivante quand le prérequis est maîtrisé', () => {
    const learnable = learnableSkills(graph, new Set([id(1)]));
    expect(learnable.map((s) => s.slug)).toContain('competence-2');
    expect(learnable.map((s) => s.slug)).not.toContain('competence-3');
  });

  it('prochaine compétence prescrite = profondeur minimale, déterministe', () => {
    // À vide, les deux racines (profondeur 0) sont candidates → ordre de slug.
    expect(nextPrescribedSkill(graph, new Set())?.slug).toBe('competence-1');
    // Les deux racines maîtrisées → la suivante débloquée est competence-2.
    expect(nextPrescribedSkill(graph, new Set([id(1), id(4)]))?.slug).toBe('competence-2');
  });

  it('renvoie null quand tout est maîtrisé', () => {
    expect(nextPrescribedSkill(graph, new Set([id(1), id(2), id(3), id(4)]))).toBeNull();
  });
});
