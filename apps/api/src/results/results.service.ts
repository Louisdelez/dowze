import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { DomainMastery, RankChoice, ResultsView, TestRow } from '@dowze/schemas';
import type { Skill } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { guardians, learnerRank, placementSessions, profiles, tests, testAttempts } from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { ProgressionService } from '../progression/progression.service';

import { PROMOTE_FRAC, TOP_RANK, meta, rankOfSkill } from './ranks';

/** pMastery → niveau ordinal nommé (« Maîtrisé » = cible normale). */
function levelOf(p: number | undefined): 'decouverte' | 'en-cours' | 'consolide' | 'maitrise' {
  if (p === undefined) return 'decouverte';
  if (p >= 0.95) return 'maitrise';
  if (p >= 0.5) return 'consolide';
  if (p > 0.15) return 'en-cours';
  return 'decouverte';
}

@Injectable()
export class ResultsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
    private readonly progression: ProgressionService,
  ) {}

  /** Résout le profil d'un compte (pour la vue parent via code élève). */
  async profileForAccount(accountId: string): Promise<{ id: string; displayName: string } | null> {
    const rows = await this.db.select().from(profiles).where(eq(profiles.accountId, accountId));
    const p = rows[0];
    return p ? { id: p.id, displayName: p.displayName } : null;
  }

  /** Construit la vue « résultats » (mêmes descripteurs pour l'élève et le parent). */
  async build(profileId: string, displayName: string): Promise<ResultsView> {
    const graph = await this.graph.loadGraph();
    const mastery = await this.progression.getMastery(profileId);
    const pById = new Map(mastery.map((m) => [m.skillId, m.pMastery]));

    // Répartition par RANG (1→10) — chaque compétence classée par son niveau réel.
    const mk = () => new Array<number>(TOP_RANK + 1).fill(0);
    const total = mk();
    const mast = mk();
    const cons = mk();
    const enc = mk();
    const dec = mk();
    const at = (a: number[], i: number): number => a[i] ?? 0;
    let masteredCount = 0;
    let inProgressCount = 0;
    const masteredSkills: Skill[] = [];
    for (const s of graph) {
      const r = rankOfSkill(s);
      const lvl = levelOf(pById.get(s.id));
      total[r] = at(total, r) + 1;
      if (lvl === 'maitrise') {
        mast[r] = at(mast, r) + 1;
        masteredCount += 1;
        masteredSkills.push(s);
      } else if (lvl === 'consolide') {
        cons[r] = at(cons, r) + 1;
        inProgressCount += 1;
      } else if (lvl === 'en-cours') {
        enc[r] = at(enc, r) + 1;
        inProgressCount += 1;
      } else {
        dec[r] = at(dec, r) + 1;
      }
    }

    // domains (compat) — un par rang ayant du contenu.
    const domains: DomainMastery[] = [];
    for (let r = 1; r <= TOP_RANK; r++) {
      if (at(total, r) === 0) continue;
      domains.push({
        domain: meta(r).name,
        tier: r,
        equivalent: meta(r).eq,
        infinite: r === TOP_RANK,
        total: at(total, r),
        decouverte: at(dec, r),
        enCours: at(enc, r),
        consolide: at(cons, r),
        maitrise: at(mast, r),
      });
    }

    // Rang COMPUTÉ (maîtrise) — sert UNIQUEMENT à initialiser le rang stocké la première fois.
    let computedRank = TOP_RANK;
    for (let r = 1; r <= TOP_RANK; r++) {
      if (at(total, r) === 0) continue;
      if (at(mast, r) < Math.max(1, Math.ceil(PROMOTE_FRAC * at(total, r)))) {
        computedRank = r;
        break;
      }
    }

    // Rang COURANT = état stocké (ne change qu'à l'ACCEPTATION d'une montée).
    const rankRow = await this.loadOrInitRank(profileId, computedRank);
    const current = rankRow.rank;
    const isTop = current >= TOP_RANK;
    const nextRankName = !isTop ? meta(current + 1).name : null;

    // NIVEAU REQUIS (barre RR) : maîtrise pondérée + couverture des compétences du rang courant.
    let sumP = 0;
    let covCount = 0;
    let rTotal = 0;
    for (const s of graph) {
      if (rankOfSkill(s) !== current) continue;
      const p = pById.get(s.id) ?? 0;
      rTotal += 1;
      sumP += p;
      if (p >= 0.75) covCount += 1;
    }
    const avgMastery = rTotal > 0 ? sumP / rTotal : 0;
    const coverage = rTotal > 0 ? covCount / rTotal : 0;
    const requiredLevelMet = rTotal > 0 && avgMastery >= 0.8 && coverage >= 0.9;
    // C1 : la barre visible = points RR (gain variable par test, façon Elo/LP), découplée du gate rigoureux
    // ci-dessus (requiredLevelMet). Au sommet, barre pleine.
    const rr = isTop ? 100 : Math.min(100, Math.round(rankRow.rrPoints ?? 0));

    // Condition contrôle continu, sur le CYCLE du rang (depuis rank_started_at) :
    // ≥ 60 % des tests hebdo réussis + 3 examens trimestriels validés.
    const cycleAttempts = await this.db
      .select({ kind: tests.kind, total: testAttempts.total, correct: testAttempts.correct })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .where(and(eq(testAttempts.profileId, profileId), gte(testAttempts.submittedAt, rankRow.rankStartedAt)));
    let weeklyPassed = 0;
    let weeklyTotal = 0;
    let examsPassed = 0;
    for (const a of cycleAttempts) {
      const frac = a.total > 0 ? a.correct / a.total : 0;
      if (a.kind === 'trimestrial') {
        if (frac >= 0.7) examsPassed += 1;
      } else {
        weeklyTotal += 1;
        if (frac >= 0.6) weeklyPassed += 1;
      }
    }
    const weeklyRate = weeklyTotal > 0 ? weeklyPassed / weeklyTotal : 0;
    const weeklyOk = weeklyTotal > 0 && weeklyRate >= 0.6;
    const examsRequired = 3;
    const examsOk = examsPassed >= examsRequired;

    // Plancher : ≥ 1 an par rang (consolidation + espacement).
    const monthsAtRank = (Date.now() - rankRow.rankStartedAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const minYearMet = monthsAtRank >= 12;
    const monthsRemaining = Math.max(0, 12 - monthsAtRank);

    const hasParent = await this.hasGuardian(profileId);
    const eligible = !isTop && requiredLevelMet && weeklyOk && examsOk && minYearMet;

    const progression = {
      rank: current,
      rankName: meta(current).name,
      rankEquivalent: meta(current).eq,
      nextRankName,
      isTop,
      rr,
      requiredLevelMet,
      weeklyPassed,
      weeklyTotal,
      weeklyRate: Math.round(weeklyRate * 100) / 100,
      weeklyOk,
      examsPassed,
      examsRequired,
      examsOk,
      monthsAtRank: Math.round(monthsAtRank * 10) / 10,
      monthsRemaining: Math.round(monthsRemaining * 10) / 10,
      minYearMet,
      eligible,
      hasParent,
      studentChoice: (rankRow.studentChoice ?? null) as RankChoice | null,
      parentChoice: (rankRow.parentChoice ?? null) as RankChoice | null,
    };

    // Forces : jusqu'à 3 compétences maîtrisées les plus avancées (asset-based).
    const strengths = masteredSkills
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
      .slice(0, 3)
      .map((s) => s.title);

    // Prochaine étape : la compétence prescrite (une seule, actionnable).
    const next = await this.progression.nextPrescribed(profileId);
    const nextSkill = next ? graph.find((s) => s.id === next.id) : undefined;
    const nextStep = next
      ? { title: next.title, domain: nextSkill ? meta(rankOfSkill(nextSkill)).name : '' }
      : null;

    // Point de départ : dernier placement terminé.
    const placement = (
      await this.db
        .select()
        .from(placementSessions)
        .where(eq(placementSessions.profileId, profileId))
        .orderBy(desc(placementSessions.createdAt))
    ).find((p) => p.status === 'termine');
    let pointDepart: ResultsView['pointDepart'] = null;
    if (placement) {
      const entry = placement.entrySkillId
        ? graph.find((s) => s.id === placement.entrySkillId)
        : undefined;
      pointDepart = {
        entrySkillTitle: entry?.title ?? null,
        masteredCount,
        aboveReferential: placement.entrySkillId == null,
      };
    }

    // Tests d'entraînement (historique de soi, jamais un rang).
    const attemptRows = await this.db
      .select({
        kind: tests.kind,
        total: testAttempts.total,
        correct: testAttempts.correct,
        submittedAt: testAttempts.submittedAt,
      })
      .from(testAttempts)
      .innerJoin(tests, eq(testAttempts.testId, tests.id))
      .where(eq(testAttempts.profileId, profileId))
      .orderBy(desc(testAttempts.submittedAt));
    const testsView: TestRow[] = attemptRows.map((r) => ({
      kind: (r.kind === 'trimestrial' ? 'trimestrial' : 'weekly') as TestRow['kind'],
      total: r.total,
      correct: r.correct,
      dateIso: r.submittedAt.toISOString(),
    }));

    return {
      displayName,
      pointDepart,
      masteredCount,
      inProgressCount,
      domains,
      progression,
      strengths,
      nextStep,
      tests: testsView,
    };
  }

  /** Vue de l'élève (par son profileId). */
  async forProfile(profileId: string): Promise<ResultsView> {
    const rows = await this.db.select().from(profiles).where(eq(profiles.id, profileId));
    const p = rows[0];
    if (!p) throw new NotFoundException('profil introuvable');
    return this.build(profileId, p.displayName);
  }

  /** Vue parent (par le code = accountId de l'enfant). */
  async forChildAccount(accountId: string): Promise<ResultsView> {
    const prof = await this.profileForAccount(accountId);
    if (!prof) throw new NotFoundException('aucun élève pour ce code');
    return this.build(prof.id, prof.displayName);
  }

  /** Charge l'état de rang, ou l'initialise (première fois) au rang calculé par la maîtrise. */
  private async loadOrInitRank(profileId: string, computedRank: number) {
    const rows = await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId));
    if (rows[0]) return rows[0];
    const inserted = await this.db
      .insert(learnerRank)
      .values({ profileId, rank: computedRank })
      .onConflictDoNothing()
      .returning();
    return (
      inserted[0] ?? {
        profileId,
        rank: computedRank,
        rrPoints: 0,
        rankStartedAt: new Date(),
        studentChoice: null as string | null,
        parentChoice: null as string | null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  /** Un responsable est-il rattaché au compte de l'élève ? (co-décision de montée requise). */
  private async hasGuardian(profileId: string): Promise<boolean> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!prof) return false;
    const g = await this.db.select().from(guardians).where(eq(guardians.minorAccountId, prof.accountId));
    return g.length > 0;
  }

  /** Promeut si les votes requis sont réunis (élève + responsable si compte parental). */
  private async maybePromote(profileId: string, hasParent: boolean): Promise<void> {
    const row = (await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId)))[0];
    if (!row) return;
    if (row.studentChoice === 'accept' && (!hasParent || row.parentChoice === 'accept')) {
      const nextR = Math.min((row.rank ?? 1) + 1, TOP_RANK);
      await this.db
        .update(learnerRank)
        .set({ rank: nextR, rankStartedAt: new Date(), rrPoints: 0, studentChoice: null, parentChoice: null, updatedAt: new Date() })
        .where(eq(learnerRank.profileId, profileId));
    }
  }

  /** Repart pour un cycle (consolidation choisie) : nouveau départ de rang, choix effacés. */
  private async consolidate(profileId: string): Promise<void> {
    await this.db
      .update(learnerRank)
      .set({ rankStartedAt: new Date(), rrPoints: 0, studentChoice: null, parentChoice: null, updatedAt: new Date() })
      .where(eq(learnerRank.profileId, profileId));
  }

  /** Vote de l'élève sur une montée proposée. */
  async voteRank(profileId: string, choice: RankChoice): Promise<ResultsView> {
    const view = await this.forProfile(profileId);
    if (!view.progression.eligible) return view; // pas éligible → aucun effet
    if (choice === 'consolidate') {
      await this.consolidate(profileId);
      return this.forProfile(profileId);
    }
    await this.db
      .update(learnerRank)
      .set({ studentChoice: 'accept', updatedAt: new Date() })
      .where(eq(learnerRank.profileId, profileId));
    await this.maybePromote(profileId, view.progression.hasParent);
    return this.forProfile(profileId);
  }

  /** Confirmation du responsable (par le code enfant = accountId). */
  async parentVoteRank(accountId: string, choice: RankChoice): Promise<ResultsView> {
    const prof = await this.profileForAccount(accountId);
    if (!prof) throw new NotFoundException('aucun élève pour ce code');
    const view = await this.build(prof.id, prof.displayName);
    if (!view.progression.eligible) return view;
    if (choice === 'consolidate') {
      await this.consolidate(prof.id);
      return this.forChildAccount(accountId);
    }
    await this.db
      .update(learnerRank)
      .set({ parentChoice: 'accept', updatedAt: new Date() })
      .where(eq(learnerRank.profileId, prof.id));
    await this.maybePromote(prof.id, true);
    return this.forChildAccount(accountId);
  }
}
