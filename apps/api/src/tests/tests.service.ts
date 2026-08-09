import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { ExerciseItem, GenerateExercisesRequest, TestKind } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { learnerRank, masteryStates, skills, tests, testAttempts } from '../db/schema';
import { ExercisesService } from '../exercises/exercises.service';
import { FsrsService, outcomeToRating } from '../fsrs/fsrs.service';
import { XpService } from '../xp/xp.service';

type ExType = GenerateExercisesRequest['type'];
const TYPE_CYCLE: ExType[] = ['qcm', 'cloze', 'short', 'flashcard'];

@Injectable()
export class TestsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly exercises: ExercisesService,
    private readonly fsrs: FsrsService,
    private readonly xp: XpService,
  ) {}

  /** Compétences à réviser : récemment travaillées + dues (FSRS), avec repli. */
  private async targetSkills(profileId: string, kind: TestKind): Promise<string[]> {
    const cap = kind === 'trimestrial' ? 8 : 5;
    const recent = await this.db
      .select({ skillId: masteryStates.skillId })
      .from(masteryStates)
      .where(and(eq(masteryStates.profileId, profileId), gt(masteryStates.attempts, 0)))
      .orderBy(desc(masteryStates.lastUpdated))
      .limit(cap);
    const due = await this.fsrs.due(profileId, new Date().toISOString());

    const seen = new Set<string>();
    const ordered: string[] = [];
    // Interleaving : on alterne récents et dus plutôt que de les grouper.
    for (let i = 0; i < Math.max(recent.length, due.length); i++) {
      for (const id of [recent[i]?.skillId, due[i]]) {
        if (id && !seen.has(id)) {
          seen.add(id);
          ordered.push(id);
        }
      }
    }
    if (ordered.length > 0) return ordered.slice(0, cap);

    // Repli (élève tout neuf) : quelques compétences du début de cursus.
    const fallback = await this.db
      .select({ id: skills.id })
      .from(skills)
      .orderBy(skills.curriculumOrder)
      .limit(3);
    return fallback.map((s) => s.id);
  }

  /** Génère un test cumulatif interleavé (hebdo ou trimestriel). */
  async generate(
    profileId: string,
    kind: TestKind,
  ): Promise<{ id: string; kind: TestKind; items: ExerciseItem[]; createdAtIso: string }> {
    const targets = await this.targetSkills(profileId, kind);
    const perSkill = kind === 'trimestrial' ? 3 : 2;

    // Génère par compétence (un type par compétence, en rotation).
    const buckets: ExerciseItem[][] = [];
    for (let i = 0; i < targets.length; i++) {
      const skillId = targets[i] as string;
      const type = TYPE_CYCLE[i % TYPE_CYCLE.length] as ExType;
      try {
        const { items } = await this.exercises.generate({ profileId, skillId, type, count: perSkill });
        buckets.push(items);
      } catch {
        // Une compétence qui échoue ne bloque pas le test entier.
      }
    }

    // Interleaving final : round-robin entre compétences (thèmes mélangés).
    const items: ExerciseItem[] = [];
    for (let r = 0; r < perSkill; r++) {
      for (const bucket of buckets) {
        if (bucket[r]) items.push(bucket[r] as ExerciseItem);
      }
    }

    const now = new Date();
    const row = (
      await this.db.insert(tests).values({ profileId, kind, items }).returning()
    )[0];
    if (!row) throw new Error('échec de création du test');

    return { id: row.id, kind, items, createdAtIso: now.toISOString() };
  }

  /** Soumission formative : met à jour la révision espacée (FSRS), jamais la maîtrise. */
  async submit(
    testId: string,
    profileId: string,
    results: { skillId: string; correct: boolean }[],
  ): Promise<{ testId: string; total: number; correct: number }> {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;

    // Agrège par compétence : une seule note FSRS par compétence (le pire l'emporte).
    const bySkill = new Map<string, boolean>();
    for (const r of results) {
      const prev = bySkill.get(r.skillId);
      bySkill.set(r.skillId, prev === undefined ? r.correct : prev && r.correct);
    }
    const nowIso = new Date().toISOString();
    for (const [skillId, ok] of bySkill) {
      await this.fsrs.rate(profileId, skillId, outcomeToRating(ok ? 'progres' : 'bloque'), nowIso);
    }

    await this.db.insert(testAttempts).values({ testId, profileId, total, correct });

    // XP : test réussi (≥ 60 %) = +80 (engagement, plafonné côté serveur).
    if (total > 0 && correct / total >= 0.6) await this.xp.award(profileId, 80);

    // C1 : gain variable de la barre RR (façon Elo, cible 0,6). Bar visible découplée du gate rigoureux.
    if (total > 0) {
      const delta = Math.round(25 * (correct / total - 0.6));
      const row = (await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId)))[0];
      if (row) {
        const next = Math.max(0, (row.rrPoints ?? 0) + delta);
        await this.db
          .update(learnerRank)
          .set({ rrPoints: next, updatedAt: new Date() })
          .where(eq(learnerRank.profileId, profileId));
      }
    }
    return { testId, total, correct };
  }
}
