import type { Skill } from '@dowze/schemas';
import { buildSkillMap, computeClosure, detectCycle } from './graph';

/**
 * La LOI DE CLÔTURE (R1-R8) — garantit « zéro trou » par construction
 * (cf. docs/03-ARCHITECTURE/10-noyau-de-regles.md).
 *
 * Un graphe est *clos* si toutes ces règles tiennent. Le trou (prérequis
 * manquant) et le cycle deviennent **impossibles** dans un graphe validé.
 */

export type ViolationCode =
  | 'duplicate-id'
  | 'dangling-prerequisite'
  | 'root-with-prerequisite'
  | 'orphan-non-root'
  | 'root-depth-nonzero'
  | 'depth-not-decreasing'
  | 'cycle';

export interface GraphViolation {
  code: ViolationCode;
  skillId: string;
  detail: string;
}

export interface GraphValidationResult {
  ok: boolean;
  violations: GraphViolation[];
}

/** Valide un graphe complet contre la loi de clôture. */
export function validateGraph(skills: readonly Skill[]): GraphValidationResult {
  const violations: GraphViolation[] = [];
  const map = buildSkillMap(skills);

  // R1 — unicité des identifiants.
  const seenIds = new Set<string>();
  for (const s of skills) {
    if (seenIds.has(s.id)) {
      violations.push({ code: 'duplicate-id', skillId: s.id, detail: `id en double: ${s.id}` });
    }
    seenIds.add(s.id);
  }

  for (const s of skills) {
    // R2 — intégrité référentielle : aucun prérequis pendant.
    for (const p of s.prerequisites) {
      if (!map.has(p)) {
        violations.push({
          code: 'dangling-prerequisite',
          skillId: s.id,
          detail: `prérequis introuvable: ${p}`,
        });
      }
    }

    // R3 — racine ⇔ aucun prérequis.
    if (s.isRoot && s.prerequisites.length > 0) {
      violations.push({
        code: 'root-with-prerequisite',
        skillId: s.id,
        detail: 'une racine ne peut pas avoir de prérequis',
      });
    }
    if (!s.isRoot && s.prerequisites.length === 0) {
      violations.push({
        code: 'orphan-non-root',
        skillId: s.id,
        detail: 'compétence sans prérequis non marquée racine',
      });
    }

    // R4 — profondeur des racines = 0.
    if (s.isRoot && s.depth !== 0) {
      violations.push({
        code: 'root-depth-nonzero',
        skillId: s.id,
        detail: `racine de profondeur ${s.depth} (attendu 0)`,
      });
    }

    // R5 — profondeur strictement décroissante vers les prérequis (terminaison).
    for (const p of s.prerequisites) {
      const pre = map.get(p);
      if (pre && pre.depth >= s.depth) {
        violations.push({
          code: 'depth-not-decreasing',
          skillId: s.id,
          detail: `prérequis ${p} de profondeur ${pre.depth} ≥ ${s.depth}`,
        });
      }
    }
  }

  // R6 — absence de cycle (DAG).
  const cycle = detectCycle(skills);
  if (cycle) {
    violations.push({
      code: 'cycle',
      skillId: cycle[0] ?? '',
      detail: `cycle détecté: ${cycle.join(' → ')}`,
    });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Une compétence est *publiable* si toute sa chaîne de prérequis existe
 * (aucun trou). C'est l'application directe de la loi de clôture à un nœud.
 */
export function isPublishable(skillId: string, skills: readonly Skill[]): boolean {
  const map = buildSkillMap(skills);
  if (!map.has(skillId)) return false;
  return computeClosure(skillId, map).missing.length === 0;
}

/**
 * Les prérequis manquants pour publier une compétence — ce que la boucle
 * « validate → repair » doit faire générer à l'IA (prompt + `.json`).
 */
export function missingPrerequisites(skillId: string, skills: readonly Skill[]): string[] {
  return computeClosure(skillId, buildSkillMap(skills)).missing;
}
