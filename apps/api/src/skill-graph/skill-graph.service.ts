import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  validateGraph,
  computeClosure,
  buildSkillMap,
  type ClosureResult,
  type GraphValidationResult,
} from '@dowze/core';
import type { Skill } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { skills as skillsTable, prerequisites as prereqTable } from '../db/schema';

function toRow(s: Skill) {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description,
    kind: s.kind,
    depth: s.depth,
    isRoot: s.isRoot,
    epistemicStatus: s.epistemicStatus,
    halfLifeYears: s.halfLifeYears,
    masteryThreshold: s.masteryThreshold,
    sources: s.sources,
  };
}

type SkillRow = typeof skillsTable.$inferSelect;
type PrereqRow = typeof prereqTable.$inferSelect;

function toSkill(row: SkillRow, edges: readonly PrereqRow[]): Skill {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind: row.kind as Skill['kind'],
    depth: row.depth,
    order: row.curriculumOrder ?? undefined,
    prerequisites: edges.filter((e) => e.skillId === row.id).map((e) => e.prerequisiteId),
    isRoot: row.isRoot,
    epistemicStatus: row.epistemicStatus as Skill['epistemicStatus'],
    halfLifeYears: row.halfLifeYears,
    masteryThreshold: row.masteryThreshold,
    sources: row.sources,
  };
}

@Injectable()
export class SkillGraphService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** Charge tout le graphe (compétences + prérequis) sous forme de domaine. */
  async loadGraph(): Promise<Skill[]> {
    const [rows, edges] = await Promise.all([
      this.db.select().from(skillsTable),
      this.db.select().from(prereqTable),
    ]);
    return rows.map((r) => toSkill(r, edges));
  }

  /** Vérifie la loi de clôture sur l'ensemble du graphe stocké. */
  async validate(): Promise<GraphValidationResult> {
    return validateGraph(await this.loadGraph());
  }

  /** Clôture transitive d'une compétence (sa chaîne de prérequis). */
  async closure(skillId: string): Promise<ClosureResult> {
    const graph = await this.loadGraph();
    return computeClosure(skillId, buildSkillMap(graph));
  }

  /**
   * **École générative** — ingère une ossature générée (via le pont `.json`) et
   * la persiste, en génération paresseuse. On fusionne avec le graphe existant,
   * on **valide par la loi de clôture** (DAG, aucun trou, profondeur décroissante)
   * AVANT d'écrire : une ossature incohérente est rejetée (400), jamais persistée.
   * On ne versionne pas le contenu, on fait croître le graphe chemin par chemin.
   */
  async ingest(incoming: readonly Skill[]): Promise<{ ok: true; added: number }> {
    const existing = await this.loadGraph();
    const byId = new Map(existing.map((s) => [s.id, s]));
    const fresh: Skill[] = [];
    const merged = [...existing];
    for (const s of incoming) {
      if (byId.has(s.id)) continue; // idempotent : on n'écrase pas l'existant
      byId.set(s.id, s);
      fresh.push(s);
      merged.push(s);
    }

    const result = validateGraph(merged);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'ossature incohérente (loi de clôture) — rien n’a été persisté',
        violations: result.violations,
      });
    }

    if (fresh.length === 0) return { ok: true, added: 0 };

    await this.db.insert(skillsTable).values(fresh.map(toRow)).onConflictDoNothing();
    const edges = fresh.flatMap((s) =>
      s.prerequisites.map((p) => ({ skillId: s.id, prerequisiteId: p })),
    );
    if (edges.length > 0) {
      await this.db.insert(prereqTable).values(edges).onConflictDoNothing();
    }
    return { ok: true, added: fresh.length };
  }
}
