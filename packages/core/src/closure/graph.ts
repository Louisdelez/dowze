import type { Skill } from '@dowze/schemas';

/**
 * Primitives de graphe sur les compétences (liste d'adjacence par prérequis).
 * Pur, sans I/O.
 */

export type SkillMap = ReadonlyMap<string, Skill>;

/** Indexe les compétences par id. */
export function buildSkillMap(skills: readonly Skill[]): SkillMap {
  const m = new Map<string, Skill>();
  for (const s of skills) m.set(s.id, s);
  return m;
}

export interface ClosureResult {
  /** Tous les prérequis transitifs (hors la compétence elle-même). */
  prerequisites: string[];
  /** Prérequis référencés mais absents du graphe (= trous potentiels). */
  missing: string[];
}

/**
 * Clôture transitive : tous les prérequis dont dépend `skillId`, jusqu'aux racines.
 * Si un prérequis référencé n'existe pas dans le graphe, il est listé dans `missing`.
 */
export function computeClosure(skillId: string, map: SkillMap): ClosureResult {
  const prerequisites = new Set<string>();
  const missing = new Set<string>();
  const seen = new Set<string>([skillId]);
  const stack: string[] = [skillId];

  while (stack.length > 0) {
    const id = stack.pop() as string;
    const skill = map.get(id);
    if (!skill) continue;
    for (const p of skill.prerequisites) {
      if (!map.has(p)) {
        missing.add(p);
        continue;
      }
      if (p !== skillId) prerequisites.add(p);
      if (!seen.has(p)) {
        seen.add(p);
        stack.push(p);
      }
    }
  }

  return { prerequisites: [...prerequisites], missing: [...missing] };
}

/**
 * Détecte un cycle dans le graphe (DFS coloré).
 * Renvoie la liste des ids formant le cycle (best-effort) ou `null` si DAG.
 */
export function detectCycle(skills: readonly Skill[]): string[] | null {
  const map = buildSkillMap(skills);
  const state = new Map<string, 0 | 1 | 2>(); // 0 vierge, 1 dans la pile, 2 terminé
  const path: string[] = [];
  let found: string[] | null = null;

  const dfs = (id: string): void => {
    if (found) return;
    state.set(id, 1);
    path.push(id);
    const skill = map.get(id);
    if (skill) {
      for (const p of skill.prerequisites) {
        if (found) return;
        if (!map.has(p)) continue;
        const st = state.get(p) ?? 0;
        if (st === 1) {
          const idx = path.indexOf(p);
          found = [...path.slice(idx), p];
          return;
        }
        if (st === 0) dfs(p);
      }
    }
    state.set(id, 2);
    path.pop();
  };

  for (const s of skills) {
    if ((state.get(s.id) ?? 0) === 0) dfs(s.id);
    if (found) break;
  }
  return found;
}

/**
 * Tri topologique (racines d'abord). Renvoie `null` si le graphe a un cycle.
 */
export function topologicalOrder(skills: readonly Skill[]): string[] | null {
  if (detectCycle(skills)) return null;
  const map = buildSkillMap(skills);
  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const skill = map.get(id);
    if (skill) for (const p of skill.prerequisites) if (map.has(p)) visit(p);
    order.push(id);
  };

  for (const s of skills) visit(s.id);
  return order;
}
