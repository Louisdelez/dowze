import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  placementGradeSchema,
  placementQuestionSchema,
  type PlacementGrade,
  type PlacementQuestion,
  type PlacementStep,
} from '@dowze/schemas';
import type { Skill } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { masteryStates, placementSessions, profiles } from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { CopiloteService } from '../copilote/copilote.service';
import {
  PLACEMENT_GRADE_SYSTEM,
  PLACEMENT_QUESTION_SYSTEM,
  placementGradePrompt,
  placementQuestionPrompt,
} from '../copilote/prompts';

/**
 * État interne d'une session de placement (persisté en jsonb). L'estimation du
 * niveau `theta` est CONTINUE (staircase adaptatif type Elo/Robbins-Monro sur
 * l'échelle des compétences ordonnées) et peut DÉPASSER le référentiel (sonde de
 * haut potentiel). Le temps de réponse est un signal SÉPARÉ (ratios), il n'entre
 * pas dans `theta`.
 */
interface PlacementState {
  order: string[]; // ids des compétences triées (facile → difficile)
  theta: number; // niveau estimé (continu ; peut dépasser order.length-1)
  askedCount: number;
  recent: number[]; // dernières valeurs de theta (test de stabilité)
  responseRatios: number[]; // temps de réponse / temps conseillé (signal de rythme)
  current: {
    skillId: string;
    aboveLevel: boolean;
    question: string;
    attendu: string;
    timeLimitSec: number;
  } | null;
}

const MIN_QUESTIONS = 15;
const MAX_QUESTIONS = 30;
const TARGET = 0.6; // taux de réussite visé (mesure informative, moins frustrant que 0,5)
const K0 = 3.0; // pas initial (grands sauts au début → convergence + détection HPI rapides)
const STABLE_RANGE = 0.6; // amplitude de theta sur la fenêtre récente → arrêt
const STABLE_WINDOW = 4;

@Injectable()
export class PlacementService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
    private readonly copilote: CopiloteService,
  ) {}

  /** Compétences triées par progression pédagogique (profondeur → ordre de cursus). */
  private sortSkills(skills: Skill[]): Skill[] {
    const ord = (s: Skill) => s.order ?? Number.MAX_SAFE_INTEGER;
    return [...skills].sort(
      (a, b) => a.depth - b.depth || ord(a) - ord(b) || a.slug.localeCompare(b.slug),
    );
  }

  /**
   * Niveau de départ « intelligent » selon l'âge (continu), exprimé comme un INDICE dans le
   * référentiel trié par profondeur. Le graphe va désormais de la maternelle au doctorat : on ne
   * peut plus mapper l'âge sur une fraction du graphe entier (un enfant démarrerait au doctorat).
   * On mappe l'âge sur une PROFONDEUR cible (≈ palier scolaire), puis on prend l'entrée de cette
   * bande. L'adaptatif fait le reste — il monte pour un profil fort, descend pour un débutant.
   */
  private initialTheta(age: number | null, skills: Skill[]): number {
    const n = skills.length;
    if (n <= 1) return 0;
    // Âge → profondeur cible : ~6 ans → primaire (d0), et ~+1 profondeur/an, plafonné à l'entrée
    // du supérieur (d10 ≈ lycée/début licence) pour un ado/adulte. Âge inconnu → prudence (primaire).
    // Cursus FR : 6 ans → CP (d0), 10 → CM2 (d≈3), 11 → 6e (d≈4), 15 → 2de (d≈8), 18 → Tle (d≈11).
    const a = age ?? 9;
    const targetDepth = Math.max(0, Math.min(a - 7, 11));
    const idx = skills.findIndex((s) => s.depth >= targetDepth);
    return idx < 0 ? n - 1 : idx;
  }

  /** Minuteur GÉNÉREUX par question selon l'âge (non punitif ; sert de repère + signal). */
  private timeLimitSec(age: number | null): number {
    if (age === null) return 100;
    if (age <= 8) return 150;
    if (age <= 11) return 120;
    if (age <= 14) return 100;
    if (age <= 17) return 90;
    return 80;
  }

  private ageOf(birthDate: string | null): number | null {
    if (!birthDate) return null;
    const born = new Date(birthDate);
    if (Number.isNaN(born.getTime())) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - born.getUTCFullYear();
    const m = now.getUTCMonth() - born.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
    return age;
  }

  /** Génère la question au niveau courant (ou au-dessus du référentiel si theta le dépasse). */
  private async genQuestion(
    profileId: string,
    skills: Skill[],
    theta: number,
  ): Promise<{ skill: Skill; aboveLevel: boolean; q: PlacementQuestion }> {
    const n = skills.length;
    const aboveLevel = theta >= n - 0.5;
    const idx = Math.max(0, Math.min(Math.round(theta), n - 1));
    const skill = skills[idx] as Skill;
    const { object } = await this.copilote.generateStructured<PlacementQuestion>(profileId, {
      schema: placementQuestionSchema,
      schemaName: 'PlacementQuestion',
      system: PLACEMENT_QUESTION_SYSTEM,
      prompt: placementQuestionPrompt({
        skillTitle: skill.title,
        skillDescription: skill.description ?? '',
        aboveLevel,
      }),
      temperature: 0.5,
      ref: 'placement-question',
    });
    return { skill, aboveLevel, q: object };
  }

  /** Démarre le placement : renvoie la première question. */
  async start(profileId: string): Promise<PlacementStep> {
    const skills = this.sortSkills(await this.graph.loadGraph());
    if (skills.length === 0) throw new NotFoundException('aucune compétence dans le graphe');

    const prof = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    const age = this.ageOf(prof?.birthDate ?? null);
    const theta = this.initialTheta(age, skills);
    const timeLimitSec = this.timeLimitSec(age);

    const { skill, aboveLevel, q } = await this.genQuestion(profileId, skills, theta);

    const state: PlacementState = {
      order: skills.map((s) => s.id),
      theta,
      askedCount: 1,
      recent: [theta],
      responseRatios: [],
      current: {
        skillId: skill.id,
        aboveLevel,
        question: q.question,
        attendu: q.attendu,
        timeLimitSec,
      },
    };

    const row = (
      await this.db
        .insert(placementSessions)
        .values({ profileId, state, status: 'en-cours' })
        .returning()
    )[0];
    if (!row) throw new Error('échec de création de la session de placement');

    return {
      sessionId: row.id,
      done: false,
      question: q.question,
      skillTitle: skill.title,
      askedCount: 1,
      maxQuestions: MAX_QUESTIONS,
      timeLimitSec,
      aboveLevel,
      feedback: null,
      entrySkill: null,
      masteredCount: 0,
      paceNote: null,
      potentialNote: null,
    };
  }

  /** Corrige la réponse, ajuste l'estimation continue, renvoie la question suivante ou le résultat. */
  async answer(
    sessionId: string,
    answer: string,
    responseTimeMs?: number,
    timedOut?: boolean,
  ): Promise<PlacementStep> {
    const row = (
      await this.db.select().from(placementSessions).where(eq(placementSessions.id, sessionId))
    )[0];
    if (!row) throw new NotFoundException('session de placement introuvable');
    const profileId = row.profileId;
    const state = row.state as PlacementState;
    if (row.status !== 'en-cours' || !state.current) {
      return this.finishedStep(sessionId, state, row.entrySkillId);
    }

    const limitMs = state.current.timeLimitSec * 1000;

    // 1) Correction (3 paliers). Temps écoulé sans réponse → « faux », sans drame.
    let grade: PlacementGrade;
    if (timedOut && !answer.trim()) {
      grade = { niveau: 'faux', explication: 'Pas de souci — on passe à la suite.' };
    } else {
      const res = await this.copilote.generateStructured<PlacementGrade>(profileId, {
        schema: placementGradeSchema,
        schemaName: 'PlacementGrade',
        system: PLACEMENT_GRADE_SYSTEM,
        prompt: placementGradePrompt({
          question: state.current.question,
          attendu: state.current.attendu,
          answer,
        }),
        temperature: 0.1,
        ref: 'placement-grade',
      });
      grade = res.object;
    }
    const score = grade.niveau === 'juste' ? 1 : grade.niveau === 'partiel' ? 0.5 : 0;

    // 2) Signal de RYTHME (séparé) : ratio temps/limite, + repérage réponse trop rapide.
    let fastCorrect = false;
    if (typeof responseTimeMs === 'number' && responseTimeMs >= 0) {
      state.responseRatios.push(Math.min(3, responseTimeMs / Math.max(1, limitMs)));
      // « rapide ET juste » (mais pas un clic éclair) → petit coup de pouce pour trouver le plafond.
      if (score === 1 && responseTimeMs > 4000 && responseTimeMs < 0.4 * limitMs)
        fastCorrect = true;
    }

    // 3) Mise à jour du niveau : staircase à pas décroissant (Robbins-Monro / Elo).
    const k = K0 / (1 + 0.15 * state.askedCount);
    let step = k * (score - TARGET);
    if (fastCorrect) step += k * 0.15; // signal vitesse : léger, uniquement vers le haut
    state.theta += step;
    if (state.theta < 0) state.theta = 0;
    state.recent.push(state.theta);
    if (state.recent.length > STABLE_WINDOW) state.recent.shift();

    // 4) Arrêt : minimum atteint ET niveau stabilisé, ou maximum de questions.
    const stabilized =
      state.askedCount >= MIN_QUESTIONS &&
      state.recent.length >= STABLE_WINDOW &&
      Math.max(...state.recent) - Math.min(...state.recent) < STABLE_RANGE;
    if (stabilized || state.askedCount >= MAX_QUESTIONS) {
      return this.finalize(sessionId, state, grade.explication);
    }

    // 5) Question suivante à la difficulté ré-estimée.
    const skills = this.sortSkills(await this.graph.loadGraph());
    const age = this.ageOf(
      (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0]?.birthDate ??
        null,
    );
    const timeLimitSec = this.timeLimitSec(age);
    const next = await this.genQuestion(profileId, skills, state.theta);
    state.askedCount += 1;
    state.current = {
      skillId: next.skill.id,
      aboveLevel: next.aboveLevel,
      question: next.q.question,
      attendu: next.q.attendu,
      timeLimitSec,
    };

    await this.db
      .update(placementSessions)
      .set({ state })
      .where(eq(placementSessions.id, sessionId));

    return {
      sessionId,
      done: false,
      question: next.q.question,
      skillTitle: next.skill.title,
      askedCount: state.askedCount,
      maxQuestions: MAX_QUESTIONS,
      timeLimitSec,
      aboveLevel: next.aboveLevel,
      feedback: grade.explication,
      entrySkill: null,
      masteredCount: 0,
      paceNote: null,
      potentialNote: null,
    };
  }

  /** Bilan de rythme (signal séparé, informatif — n'affecte pas le placement). */
  private paceNote(ratios: number[]): string | null {
    if (ratios.length < 3) return null;
    const sorted = [...ratios].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    if (median < 0.35) return 'Tu réponds vite — belle aisance.';
    if (median > 0.9) return 'Tu prends ton temps pour bien réfléchir, c’est très bien.';
    return 'Un rythme posé et régulier.';
  }

  /** Clôt le placement : marque les compétences maîtrisées et fixe le point d'entrée. */
  private async finalize(
    sessionId: string,
    state: PlacementState,
    feedback: string,
  ): Promise<PlacementStep> {
    const skills = this.sortSkills(await this.graph.loadGraph());
    const n = skills.length;
    const entryIndex = Math.max(0, Math.min(Math.round(state.theta), n));
    const masteredIds = state.order.slice(0, entryIndex);

    const row = (
      await this.db.select().from(placementSessions).where(eq(placementSessions.id, sessionId))
    )[0];
    const profileId = row?.profileId as string;
    const now = new Date();

    if (masteredIds.length > 0) {
      await this.db
        .insert(masteryStates)
        .values(
          masteredIds.map((skillId) => ({
            profileId,
            skillId,
            pMastery: 1,
            attempts: 1,
            correct: 1,
            lastUpdated: now,
          })),
        )
        .onConflictDoNothing();
    }

    const entry = entryIndex < n ? (skills[entryIndex] as Skill) : null;
    // Dépassement du référentiel d'âge → note de potentiel (à confirmer, jamais un verdict).
    const potentialNote =
      state.theta >= n - 0.5
        ? 'Tu as dépassé tout le parcours actuel — un potentiel à cultiver ! On te proposera des défis plus avancés.'
        : null;

    state.current = null;
    await this.db
      .update(placementSessions)
      .set({ state, status: 'termine', entrySkillId: entry?.id ?? null })
      .where(eq(placementSessions.id, sessionId));

    return {
      sessionId,
      done: true,
      question: null,
      skillTitle: null,
      askedCount: state.askedCount,
      maxQuestions: MAX_QUESTIONS,
      timeLimitSec: null,
      aboveLevel: false,
      feedback,
      entrySkill: entry ? { id: entry.id, slug: entry.slug, title: entry.title } : null,
      masteredCount: masteredIds.length,
      paceNote: this.paceNote(state.responseRatios),
      potentialNote,
    };
  }

  /** Étape « terminée » (idempotent) pour une session déjà close. */
  private async finishedStep(
    sessionId: string,
    state: PlacementState,
    entrySkillId: string | null,
  ): Promise<PlacementStep> {
    let entry: PlacementStep['entrySkill'] = null;
    if (entrySkillId) {
      const skills = await this.graph.loadGraph();
      const s = skills.find((x) => x.id === entrySkillId);
      if (s) entry = { id: s.id, slug: s.slug, title: s.title };
    }
    const entryIndex = entrySkillId ? state.order.indexOf(entrySkillId) : state.order.length;
    return {
      sessionId,
      done: true,
      question: null,
      skillTitle: null,
      askedCount: state.askedCount,
      maxQuestions: MAX_QUESTIONS,
      timeLimitSec: null,
      aboveLevel: false,
      feedback: null,
      entrySkill: entry,
      masteredCount: entryIndex < 0 ? 0 : entryIndex,
      paceNote: this.paceNote(state.responseRatios),
      potentialNote: null,
    };
  }
}
