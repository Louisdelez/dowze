import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  initialMastery,
  updateMastery,
  nextPrescribedSkill,
  learnableSkills,
  buildSkillMap,
} from '@dowze/core';
import { bktParamsSchema, type BktParams, type MasteryState, type Skill } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { masteryStates, specializations } from '../db/schema';
import { disciplineOf } from '../results/ranks';
import { SkillGraphService } from '../skill-graph/skill-graph.service';

const DEFAULT_BKT: BktParams = bktParamsSchema.parse({});
const DEFAULT_THRESHOLD = 0.95;

type Row = typeof masteryStates.$inferSelect;

function toState(row: Row): MasteryState {
  return {
    skillId: row.skillId,
    pMastery: row.pMastery,
    attempts: row.attempts,
    correct: row.correct,
    lastUpdatedIso: row.lastUpdated ? row.lastUpdated.toISOString() : null,
  };
}

@Injectable()
export class ProgressionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
  ) {}

  /** Les disciplines de spécialisation choisies par l'élève (le « pic » de son profil en T). */
  async chosenDisciplines(profileId: string): Promise<Set<string>> {
    const rows = await this.db
      .select()
      .from(specializations)
      .where(eq(specializations.profileId, profileId));
    return new Set(rows.map((s) => s.discipline));
  }

  /** Tous les états de maîtrise d'un profil. */
  async getMastery(profileId: string): Promise<MasteryState[]> {
    const rows = await this.db
      .select()
      .from(masteryStates)
      .where(eq(masteryStates.profileId, profileId));
    return rows.map(toState);
  }

  /**
   * La prochaine compétence prescrite (frontière d'apprentissage) : la plus basse
   * dont tous les prérequis sont maîtrisés (p(L) ≥ seuil de la compétence).
   * `null` si tout est maîtrisé ou si le graphe est vide.
   */
  async nextPrescribed(
    profileId: string,
  ): Promise<{ id: string; slug: string; title: string; depth: number } | null> {
    const [skills, mastery] = await Promise.all([
      this.graph.loadGraph(),
      this.getMastery(profileId),
    ]);
    const map = buildSkillMap(skills);
    const masteredIds = new Set(
      mastery
        .filter((m) => m.pMastery >= (map.get(m.skillId)?.masteryThreshold ?? DEFAULT_THRESHOLD))
        .map((m) => m.skillId),
    );

    // Biais de spécialisation : si l'élève a choisi des voies, on prescrit en priorité une compétence
    // apprenable de l'une de ces disciplines (la spé oriente le contenu). Sinon, prescription par défaut.
    const chosen = await this.chosenDisciplines(profileId);
    let next: Skill | null = null;
    if (chosen.size > 0) {
      const ord = (s: Skill) => s.order ?? Number.MAX_SAFE_INTEGER;
      const preferred = learnableSkills(skills, masteredIds)
        .filter((s) => chosen.has(disciplineOf(s.slug)))
        .sort((a, b) => a.depth - b.depth || ord(a) - ord(b) || a.slug.localeCompare(b.slug));
      next = preferred[0] ?? null;
    }
    if (!next) next = nextPrescribedSkill(skills, masteredIds);
    return next ? { id: next.id, slug: next.slug, title: next.title, depth: next.depth } : null;
  }

  /** Enregistre une observation (réussite/échec) et met à jour la maîtrise (BKT). */
  async observe(
    profileId: string,
    skillId: string,
    correct: boolean,
    nowIso: string,
  ): Promise<MasteryState> {
    // TRANSACTION + verrou de ligne : le calcul BKT est un read-modify-write côté Node — deux observations
    // concurrentes (double clôture, ingest + pont IA…) se perdaient l'une l'autre (audit 08-2026).
    return this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(masteryStates)
        .where(and(eq(masteryStates.profileId, profileId), eq(masteryStates.skillId, skillId)))
        .for('update');

      const current = existing[0] ? toState(existing[0]) : initialMastery(skillId, DEFAULT_BKT);
      const next = updateMastery(current, DEFAULT_BKT, correct, nowIso);

      await tx
        .insert(masteryStates)
        .values({
          profileId,
          skillId,
          pMastery: next.pMastery,
          attempts: next.attempts,
          correct: next.correct,
          lastUpdated: new Date(nowIso),
        })
        .onConflictDoUpdate({
          target: [masteryStates.profileId, masteryStates.skillId],
          set: {
            pMastery: next.pMastery,
            attempts: next.attempts,
            correct: next.correct,
            lastUpdated: new Date(nowIso),
          },
        });

      return next;
    });
  }

  /**
   * Marque une compétence comme maîtrisée (p(L) = 1). Utilisé quand une
   * **validation** (auto ou pair) réussit : la preuve fait foi et fait avancer
   * la frontière, indépendamment du BKT.
   */
  async markMastered(profileId: string, skillId: string, nowIso: string): Promise<void> {
    await this.db
      .insert(masteryStates)
      .values({
        profileId,
        skillId,
        pMastery: 1,
        attempts: 1,
        correct: 1,
        lastUpdated: new Date(nowIso),
      })
      .onConflictDoUpdate({
        target: [masteryStates.profileId, masteryStates.skillId],
        set: { pMastery: 1, lastUpdated: new Date(nowIso) },
      });
  }
}
