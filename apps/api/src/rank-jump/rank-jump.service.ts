import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { RankJumpDay, RankJumpState, RankJumpView } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import type { ExerciseItem } from '@dowze/schemas';
import {
  guardians,
  learnerRank,
  profiles,
  rankJumpPretests,
  rankJumps,
  retentionCheckpoints,
  testAttempts,
  wellbeingCheckins,
} from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { ProgressionService } from '../progression/progression.service';
import { ExercisesService } from '../exercises/exercises.service';
import { TOP_RANK, meta, rankOfSkill } from '../results/ranks';

const TOTAL_DAYS = 28;
const PASS_THRESHOLD = 0.8; // 80 % du total de points (seuil de maîtrise, Bloom / CBE).
const EXAMS_REQUIRED = 4; // réussir ≥ 4 des 5 examens finaux (pas de compensation totale).
const EXAM_PASS = 0.6; // un examen final est « réussi » à ≥ 60 %.

/** Poids par type de jour (l'examen final pèse le plus ; le repos ne compte pas). */
const WEIGHT: Record<RankJumpDay['type'], number> = { learn: 1, weekly: 3, expedition: 3, exam: 10, rest: 0 };

/** Programme des 28 jours (4 semaines) — avec un jour de repos/semaine (garde-fou anti-burnout). */
function buildPlan(): RankJumpDay[] {
  const days: RankJumpDay[] = [];
  const push = (type: RankJumpDay['type'], label: string) =>
    days.push({ day: days.length + 1, type, label, weight: WEIGHT[type], done: false, score: null });
  // Semaines 1 à 3 : cours + test quotidien, repos le mercredi, gros test le samedi, expédition-éclair le dimanche.
  for (let w = 1; w <= 3; w++) {
    push('learn', 'Cours accéléré + test du jour (lundi)');
    push('learn', 'Cours accéléré + test du jour (mardi)');
    push('rest', 'Repos — récupération (le sommeil consolide la mémoire)');
    push('learn', 'Cours accéléré + test du jour (jeudi)');
    push('learn', 'Cours accéléré + test du jour (vendredi)');
    push('weekly', 'Grand test de la semaine (samedi)');
    push('expedition', 'Expédition-éclair — à faire en 1 journée (dimanche)');
  }
  // Semaine 4 : semaine d'examens (un gros examen par jour), week-end de délibération.
  for (let d = 1; d <= 5; d++) push('exam', `Examen ${d}/5 — semaine finale`);
  push('rest', 'Repos — délibération');
  push('rest', 'Repos — délibération');
  return days;
}

@Injectable()
export class RankJumpService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
    private readonly progression: ProgressionService,
    private readonly exercises: ExercisesService,
  ) {}

  /** Rang courant (état stocké) de l'élève ; 1 par défaut. */
  private async currentRank(profileId: string): Promise<number> {
    const row = (await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId)))[0];
    return row?.rank ?? 1;
  }

  /** Maîtrise moyenne (0→1) des compétences du rang donné. */
  private async rankMastery(profileId: string, rank: number): Promise<number> {
    const graph = await this.graph.loadGraph();
    const mastery = await this.progression.getMastery(profileId);
    const pById = new Map(mastery.map((m) => [m.skillId, m.pMastery]));
    let sum = 0;
    let n = 0;
    for (const s of graph) {
      if (rankOfSkill(s) !== rank) continue;
      n += 1;
      sum += pById.get(s.id) ?? 0;
    }
    return n > 0 ? sum / n : 0;
  }

  /** Régularité récente (0→1) : activité de tests sur les 30 derniers jours. */
  private async regularity(profileId: string): Promise<number> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.db
      .select({ id: testAttempts.id })
      .from(testAttempts)
      .where(and(eq(testAttempts.profileId, profileId), gte(testAttempts.submittedAt, since)));
    return Math.min(1, rows.length / 4); // ~4 tests/mois = pleinement régulier
  }

  /** Compte-t-il un responsable ? (accord parental pour un mineur). */
  private async hasGuardian(profileId: string): Promise<boolean> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!prof) return false;
    const g = await this.db.select().from(guardians).where(eq(guardians.minorAccountId, prof.accountId));
    return g.length > 0;
  }

  /** Vue complète : éligibilité + saut actif éventuel. */
  async view(profileId: string): Promise<RankJumpView> {
    const rank = await this.currentRank(profileId);
    const atTop = rank >= TOP_RANK;
    const mastery = await this.rankMastery(profileId, rank);
    const regularity = await this.regularity(profileId);
    const parentConsentNeeded = await this.hasGuardian(profileId);
    const target = Math.min(rank + 1, TOP_RANK);
    const pretestRow = (
      await this.db
        .select()
        .from(rankJumpPretests)
        .where(and(eq(rankJumpPretests.profileId, profileId), eq(rankJumpPretests.targetRank, target)))
    )[0];
    const pretestScore = pretestRow ? pretestRow.score : null;
    const pretestNeeded = !atTop && pretestScore === null;

    // Jauge /100 (Iowa Acceleration Scale) : maîtrise du rang actuel (35) + PRÉ-TEST above-level (35)
    // + régularité (15) + motivation (15).
    const masteryPts = Math.round(mastery * 35);
    const pretestPts = Math.round((pretestScore ?? 0) * 35);
    const regularityPts = Math.round(regularity * 15);
    const motivationPts = 15;
    const score = Math.min(100, masteryPts + pretestPts + regularityPts + motivationPts);

    const blockers: string[] = [];
    if (atTop) blockers.push('Tu es déjà au rang le plus haut — il n’y a rien au-dessus à sauter.');
    if (mastery < 0.7)
      blockers.push('Il faut d’abord presque boucler ton rang actuel : sauter avec des lacunes serait risqué.');
    if (pretestScore !== null && pretestScore < 0.4)
      blockers.push('Le pré-test montre un écart trop grand avec le rang visé — un mois ne suffirait pas. Continue ton rang, puis retente.');

    const canStart =
      !atTop && mastery >= 0.7 && pretestScore !== null && pretestScore >= 0.4 && score >= 60;
    const active = await this.activeState(profileId);
    const retention = await this.dueRetention(profileId);
    const wellbeing = await this.wellbeing(profileId, active?.status === 'in-progress');

    return {
      eligibility: {
        score,
        canStart,
        mastery,
        regularity,
        atTop,
        parentConsentNeeded,
        pretestNeeded,
        pretestScore,
        blockers,
      },
      active,
      retention,
      wellbeing,
    };
  }

  /** A3 — bien-être : note de soutien (jamais un diagnostic) + WHO-5 dû pendant le mois intensif. */
  private async wellbeing(profileId: string, jumpActive: boolean): Promise<{ note: string | null; who5Due: boolean }> {
    if (!jumpActive) return { note: null, who5Due: false };
    const recent = await this.db
      .select()
      .from(wellbeingCheckins)
      .where(eq(wellbeingCheckins.profileId, profileId))
      .orderBy(desc(wellbeingCheckins.createdAt));
    const day = 24 * 60 * 60 * 1000;
    const moods = recent.filter((r) => r.kind === 'mood' && Date.now() - r.createdAt.getTime() < 2 * day);
    const lastWho5 = recent.find((r) => r.kind === 'who5');
    const who5Due = !lastWho5 || Date.now() - lastWho5.createdAt.getTime() > 7 * day;
    const avgMood = moods.length ? moods.reduce((a, r) => a + r.score, 0) / moods.length : null;
    const lowWho5 = lastWho5 && Date.now() - lastWho5.createdAt.getTime() < 7 * day && lastWho5.score <= 50;
    let note: string | null = null;
    if ((avgMood !== null && avgMood <= 2) || lowWho5) {
      note =
        'Tu tiens un rythme intense. Ton bien-être passe avant le calendrier : dors bien, fais des pauses, ' +
        'et si le rythme te pèse, parle-en à ton responsable. Un jalon “à 85 %” compris vaut mieux qu’un burnout.';
    }
    return { note, who5Due };
  }

  /** A1 — génère le pré-test « above-level » (exercices sur le contenu du rang VISÉ, pas encore appris). */
  async generatePretest(profileId: string): Promise<{ items: ExerciseItem[] }> {
    const rank = await this.currentRank(profileId);
    const target = Math.min(rank + 1, TOP_RANK);
    const graph = await this.graph.loadGraph();
    const targetSkills = graph
      .filter((s) => rankOfSkill(s) === target)
      .sort((a, b) => a.depth - b.depth || (a.order ?? 0) - (b.order ?? 0))
      .slice(0, 2);
    const items: ExerciseItem[] = [];
    for (const s of targetSkills) {
      try {
        const res = await this.exercises.generate({ profileId, skillId: s.id, type: 'qcm', count: 2 });
        items.push(...res.items);
      } catch {
        // on ignore une compétence dont la génération échoue
      }
    }
    return { items };
  }

  /** A1 — enregistre le score du pré-test (0→1) et met à jour la jauge. */
  async submitPretest(profileId: string, score: number): Promise<RankJumpView> {
    const rank = await this.currentRank(profileId);
    const target = Math.min(rank + 1, TOP_RANK);
    const s = Math.max(0, Math.min(1, score));
    await this.db
      .insert(rankJumpPretests)
      .values({ profileId, targetRank: target, score: s })
      .onConflictDoUpdate({
        target: [rankJumpPretests.profileId, rankJumpPretests.targetRank],
        set: { score: s, createdAt: new Date() },
      });
    return this.view(profileId);
  }

  /** A3 — check-in humeur quotidien (1-5). */
  async checkinMood(profileId: string, mood: number): Promise<RankJumpView> {
    await this.db.insert(wellbeingCheckins).values({ profileId, kind: 'mood', score: Math.max(1, Math.min(5, mood)) });
    return this.view(profileId);
  }

  /** A3 — WHO-5 hebdo (score 0-100). */
  async submitWho5(profileId: string, score: number): Promise<RankJumpView> {
    await this.db.insert(wellbeingCheckins).values({ profileId, kind: 'who5', score: Math.max(0, Math.min(100, score)) });
    return this.view(profileId);
  }

  /** État du saut actif (ou du dernier terminé). */
  private async activeState(profileId: string): Promise<RankJumpState | null> {
    const rows = await this.db
      .select()
      .from(rankJumps)
      .where(eq(rankJumps.profileId, profileId))
      .orderBy(desc(rankJumps.startedAt));
    const row = rows[0];
    if (!row) return null;
    return this.toState(row, await this.hasGuardian(profileId));
  }

  private toState(row: typeof rankJumps.$inferSelect, hasParent: boolean): RankJumpState {
    const plan = row.plan as RankJumpDay[];
    const totalWeight = plan.reduce((a, d) => a + d.weight, 0) || 1;
    const earned = plan.reduce((a, d) => a + (d.done && d.score != null ? d.score * d.weight : 0), 0);
    const provisionalScore = earned / totalWeight;
    const finalScore = provisionalScore; // même formule : les jours non faits comptent 0.
    const examsPassed = plan.filter((d) => d.type === 'exam' && d.done && (d.score ?? 0) >= EXAM_PASS).length;
    const today = plan.find((d) => d.day === row.currentDay) ?? null;
    // Cadence : une tâche par jour réel (≥ 20 h entre deux tâches).
    const sinceLast = row.lastDayAt ? Date.now() - row.lastDayAt.getTime() : Infinity;
    const cooldownMs = 20 * 60 * 60 * 1000;
    const canDoToday = row.status === 'in-progress' && sinceLast >= cooldownMs;
    const nextTaskAt =
      row.status === 'in-progress' && row.lastDayAt && sinceLast < cooldownMs
        ? new Date(row.lastDayAt.getTime() + cooldownMs).toISOString()
        : null;
    return {
      id: row.id,
      fromRank: row.fromRank,
      fromRankName: meta(row.fromRank).name,
      targetRank: row.targetRank,
      targetRankName: meta(row.targetRank).name,
      status: row.status as RankJumpState['status'],
      currentDay: row.currentDay,
      totalDays: TOTAL_DAYS,
      plan,
      today,
      canDoToday,
      nextTaskAt,
      hasParent,
      provisionalScore: Math.round(provisionalScore * 1000) / 1000,
      finalScore: Math.round(finalScore * 1000) / 1000,
      passThreshold: PASS_THRESHOLD,
      examsPassed,
      examsRequired: EXAMS_REQUIRED,
      startedAt: row.startedAt.toISOString(),
    };
  }

  /** Démarre un saut (si éligible). Si compte mineur : en attente de la confirmation du responsable. */
  async start(profileId: string): Promise<RankJumpView> {
    const existing = (
      await this.db.select().from(rankJumps).where(eq(rankJumps.profileId, profileId)).orderBy(desc(rankJumps.startedAt))
    )[0];
    if (existing && (existing.status === 'in-progress' || existing.status === 'pending-consent'))
      return this.view(profileId); // déjà un saut actif / en attente

    const v = await this.view(profileId);
    if (!v.eligibility.canStart) throw new BadRequestException('non éligible au saut de rang pour l’instant');

    const from = await this.currentRank(profileId);
    const target = Math.min(from + 1, TOP_RANK);
    const hasParent = await this.hasGuardian(profileId);
    await this.db.insert(rankJumps).values({
      profileId,
      fromRank: from,
      targetRank: target,
      status: hasParent ? 'pending-consent' : 'in-progress',
      eligibilityScore: v.eligibility.score,
      currentDay: 1,
      plan: buildPlan(),
    });
    return this.view(profileId);
  }

  /** Vue du saut d'un enfant (pour le responsable), par le code = accountId. */
  async viewForAccount(accountId: string): Promise<RankJumpView> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.accountId, accountId)))[0];
    if (!prof) throw new NotFoundException('aucun élève pour ce code');
    return this.view(prof.id);
  }

  /** Confirmation du responsable : lance réellement le mois intensif (départ du compte à rebours). */
  async parentConsent(accountId: string): Promise<RankJumpView> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.accountId, accountId)))[0];
    if (!prof) throw new NotFoundException('aucun élève pour ce code');
    await this.db
      .update(rankJumps)
      .set({ status: 'in-progress', startedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(rankJumps.profileId, prof.id), eq(rankJumps.status, 'pending-consent')));
    return this.view(prof.id);
  }

  /** Enregistre le résultat du jour et avance (score ∈ [0,1]). Finalise à J28. */
  async submitDay(profileId: string, score: number): Promise<RankJumpView> {
    const row = (
      await this.db
        .select()
        .from(rankJumps)
        .where(and(eq(rankJumps.profileId, profileId), eq(rankJumps.status, 'in-progress')))
    )[0];
    if (!row) throw new NotFoundException('aucun saut en cours');
    // Cadence : une seule tâche par jour réel (≥ 20 h depuis la dernière).
    if (row.lastDayAt && Date.now() - row.lastDayAt.getTime() < 20 * 60 * 60 * 1000)
      return this.view(profileId);
    const plan = row.plan as RankJumpDay[];
    let day = row.currentDay;
    const cur = plan.find((d) => d.day === day);
    if (cur && cur.type !== 'rest') {
      cur.done = true;
      cur.score = Math.max(0, Math.min(1, score));
    }
    // Avance en marquant les jours de repos comme faits automatiquement.
    day += 1;
    while (day <= TOTAL_DAYS) {
      const d = plan.find((x) => x.day === day);
      if (d && d.type === 'rest') {
        d.done = true;
        day += 1;
      } else break;
    }

    if (day > TOTAL_DAYS) {
      // Finalisation : marquer tout jour restant comme non fait (0), décider.
      const state = this.toState({ ...row, plan, currentDay: TOTAL_DAYS }, false);
      const passed = state.finalScore >= PASS_THRESHOLD && state.examsPassed >= EXAMS_REQUIRED;
      await this.db
        .update(rankJumps)
        .set({
          plan,
          currentDay: TOTAL_DAYS,
          lastDayAt: new Date(),
          status: passed ? 'passed' : 'failed',
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rankJumps.id, row.id));
      if (passed) await this.promote(profileId, row.targetRank);
      return this.view(profileId);
    }

    await this.db
      .update(rankJumps)
      .set({ plan, currentDay: day, lastDayAt: new Date(), updatedAt: new Date() })
      .where(eq(rankJumps.id, row.id));
    return this.view(profileId);
  }

  /** Abandonne le saut en cours (retour au rang, aucune pénalité). */
  async abandon(profileId: string): Promise<RankJumpView> {
    await this.db
      .update(rankJumps)
      .set({ status: 'abandoned', decidedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(rankJumps.profileId, profileId), eq(rankJumps.status, 'in-progress')));
    return this.view(profileId);
  }

  /** Montée de rang accélérée réussie : applique le nouveau rang, cycle remis à zéro. */
  private async promote(profileId: string, target: number): Promise<void> {
    const existing = (await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId)))[0];
    if (existing) {
      await this.db
        .update(learnerRank)
        .set({ rank: target, rankStartedAt: new Date(), studentChoice: null, parentChoice: null, updatedAt: new Date() })
        .where(eq(learnerRank.profileId, profileId));
    } else {
      await this.db.insert(learnerRank).values({ profileId, rank: target }).onConflictDoNothing();
    }
    // A4 : re-tests espacés (J+7 / J+30 / J+90) pour ancrer durablement (anti-bachotage, Cepeda).
    const day = 24 * 60 * 60 * 1000;
    await this.db.insert(retentionCheckpoints).values(
      [7, 30, 90].map((d) => ({ profileId, rank: target, scheduledAt: new Date(Date.now() + d * day) })),
    );
  }

  /** Checkpoints de rétention dus (à réviser maintenant). */
  async dueRetention(profileId: string): Promise<{ id: string; rankName: string; scheduledAt: string }[]> {
    const rows = await this.db
      .select()
      .from(retentionCheckpoints)
      .where(and(eq(retentionCheckpoints.profileId, profileId), eq(retentionCheckpoints.status, 'due')))
      .orderBy(retentionCheckpoints.scheduledAt);
    return rows
      .filter((r) => r.scheduledAt.getTime() <= Date.now())
      .map((r) => ({ id: r.id, rankName: meta(r.rank).name, scheduledAt: r.scheduledAt.toISOString() }));
  }

  /** Valide un re-test de rétention (réussi → espacer ; échoué → remédiation ciblée à J+3). */
  async doRetention(profileId: string, id: string, score: number): Promise<void> {
    const passed = score >= 0.85;
    if (passed) {
      await this.db.update(retentionCheckpoints).set({ status: 'passed' }).where(eq(retentionCheckpoints.id, id));
    } else {
      // Oubli : on marque à remédier et on replanifie un mini-checkpoint à J+3 (raccourcir l'intervalle).
      const row = (await this.db.select().from(retentionCheckpoints).where(eq(retentionCheckpoints.id, id)))[0];
      await this.db.update(retentionCheckpoints).set({ status: 'remediate' }).where(eq(retentionCheckpoints.id, id));
      if (row)
        await this.db
          .insert(retentionCheckpoints)
          .values({ profileId, rank: row.rank, scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) });
    }
  }
}
