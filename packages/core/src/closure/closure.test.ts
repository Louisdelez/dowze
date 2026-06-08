import { describe, it, expect } from 'vitest';
import type { Skill } from '@dowze/schemas';
import { computeClosure, detectCycle, topologicalOrder, buildSkillMap } from './graph';
import { validateGraph, isPublishable, missingPrerequisites } from './closure';

const id = (n: number): string => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

function skill(n: number, prereqs: number[], depth: number, isRoot = false): Skill {
  return {
    id: id(n),
    slug: `competence-${n}`,
    title: `Compétence ${n}`,
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

// Graphe valide : 1 (racine) → 2 → 3
const valid: Skill[] = [skill(1, [], 0, true), skill(2, [1], 1), skill(3, [2], 2)];

describe('graphe — clôture transitive', () => {
  it('calcule tous les prérequis transitifs', () => {
    const r = computeClosure(id(3), buildSkillMap(valid));
    expect(new Set(r.prerequisites)).toEqual(new Set([id(1), id(2)]));
    expect(r.missing).toEqual([]);
  });

  it('signale les prérequis manquants (trous)', () => {
    const broken: Skill[] = [skill(3, [2], 2)]; // 2 et 1 absents
    const r = computeClosure(id(3), buildSkillMap(broken));
    expect(r.missing).toContain(id(2));
  });
});

describe('détection de cycle', () => {
  it('ne trouve pas de cycle dans un DAG', () => {
    expect(detectCycle(valid)).toBeNull();
  });

  it('trouve un cycle', () => {
    const cyclic: Skill[] = [skill(1, [2], 1), skill(2, [1], 1)];
    const c = detectCycle(cyclic);
    expect(c).not.toBeNull();
    expect(c?.length).toBeGreaterThanOrEqual(2);
  });

  it('tri topologique : un prérequis vient avant son dépendant', () => {
    const order = topologicalOrder(valid);
    expect(order).not.toBeNull();
    const o = order as string[];
    expect(o.indexOf(id(1))).toBeLessThan(o.indexOf(id(2)));
    expect(o.indexOf(id(2))).toBeLessThan(o.indexOf(id(3)));
  });
});

describe('loi de clôture — validateGraph', () => {
  it('accepte un graphe valide', () => {
    const r = validateGraph(valid);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it('rejette un prérequis pendant', () => {
    const r = validateGraph([skill(2, [1], 1)]); // 1 absent + non-racine sans prereq existant
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.code === 'dangling-prerequisite')).toBe(true);
  });

  it('rejette une racine avec prérequis', () => {
    const r = validateGraph([skill(1, [2], 0, true), skill(2, [], 0, true)]);
    expect(r.violations.some((v) => v.code === 'root-with-prerequisite')).toBe(true);
  });

  it('rejette une profondeur non décroissante', () => {
    const r = validateGraph([skill(1, [], 0, true), skill(2, [1], 0)]);
    expect(r.violations.some((v) => v.code === 'depth-not-decreasing')).toBe(true);
  });

  it('rejette un cycle', () => {
    const r = validateGraph([skill(1, [2], 1), skill(2, [1], 1)]);
    expect(r.violations.some((v) => v.code === 'cycle')).toBe(true);
  });
});

describe('publiabilité (zéro trou)', () => {
  it('publiable quand la chaîne est complète', () => {
    expect(isPublishable(id(3), valid)).toBe(true);
    expect(missingPrerequisites(id(3), valid)).toEqual([]);
  });

  it('non publiable quand un prérequis manque', () => {
    const broken: Skill[] = [skill(3, [2], 2)];
    expect(isPublishable(id(3), broken)).toBe(false);
    expect(missingPrerequisites(id(3), broken)).toContain(id(2));
  });
});
