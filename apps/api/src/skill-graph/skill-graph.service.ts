import { Inject, Injectable } from '@nestjs/common';
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
}
