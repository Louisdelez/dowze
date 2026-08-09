import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type {
  Badge,
  DisciplineProgress,
  Milestone,
  SpecializationPlan,
  SpecializationProposal,
  SpecializationView,
} from '@dowze/schemas';
import type { Skill } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { learnerBadges, learnerRank, specializationPlans, specializations } from '../db/schema';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { ProgressionService } from '../progression/progression.service';
import { CopiloteService } from '../copilote/copilote.service';
import { DISCIPLINES, disciplineOf, meta, rankOfSkill } from '../results/ranks';

const UNLOCK_RANK = 3; // Argent (≈ collège) : on ne spécialise pas avant un socle large.

// Ce que le guide-IA doit renvoyer (le plan sans les ids/flags, ajoutés côté serveur).
const planGenSchema = z.object({
  distalGoal: z.string().min(1),
  milestones: z
    .array(
      z.object({
        competency: z.string().min(1),
        successCriteria: z.array(z.string().min(1)).min(1),
        subgoals: z.array(z.string()),
        projectBrief: z.string().min(1),
        badgeName: z.string().min(1),
      }),
    )
    .min(4)
    .max(8),
});

const PLAN_SYSTEM =
  "Tu es le guide pédagogique de Dowze, l'école du futur. Tu conçois un PLAN DE SPÉCIALISATION par backward " +
  'design pour une discipline choisie. Règles : 5 à 8 jalons ordonnés par prérequis ; chaque jalon = UNE ' +
  'compétence vérifiable (démontrable en 1 à 3 semaines) ; des critères de réussite SPÉCIFIQUES ET MESURABLES ' +
  '(pas « comprendre X » mais « atteindre tel résultat sur telle tâche ») ; 2 à 4 sous-buts rapprochés ; un ' +
  'PROJET authentique à produit public par jalon ; un nom de badge court. Difficulté croissante mais toujours ' +
  "atteignable (zone proximale). Ton chaleureux et exigeant. Réponds en français, adapté à l'âge et au niveau.";

@Injectable()
export class SpecializationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly graph: SkillGraphService,
    private readonly progression: ProgressionService,
    private readonly copilote: CopiloteService,
  ) {}

  private async currentRank(profileId: string): Promise<number> {
    const row = (await this.db.select().from(learnerRank).where(eq(learnerRank.profileId, profileId)))[0];
    return row?.rank ?? 1;
  }

  async view(profileId: string): Promise<SpecializationView> {
    const rank = await this.currentRank(profileId);
    const unlocked = rank >= UNLOCK_RANK;

    const graph = await this.graph.loadGraph();
    const mastery = await this.progression.getMastery(profileId);
    const pById = new Map(mastery.map((m) => [m.skillId, m.pMastery]));
    const chosen = new Set(
      (await this.db.select().from(specializations).where(eq(specializations.profileId, profileId))).map(
        (s) => s.discipline,
      ),
    );

    // Compétences par discipline, triées (pour la « prochaine étape »).
    const byDisc = new Map<string, Skill[]>();
    for (const d of DISCIPLINES) byDisc.set(d, []);
    for (const s of graph) {
      const d = disciplineOf(s.slug);
      if (byDisc.has(d)) byDisc.get(d)!.push(s);
    }

    const progressOf = (discipline: string): DisciplineProgress => {
      const skills = (byDisc.get(discipline) ?? []).slice().sort((a, b) => a.depth - b.depth || (a.order ?? 0) - (b.order ?? 0));
      let sumP = 0;
      let mastered = 0;
      let topRank = 0;
      let nextSkillTitle: string | null = null;
      for (const s of skills) {
        const p = pById.get(s.id) ?? 0;
        sumP += p;
        if (p >= 0.95) {
          mastered += 1;
          topRank = Math.max(topRank, rankOfSkill(s));
        } else if (nextSkillTitle === null) {
          nextSkillTitle = s.title;
        }
      }
      const total = skills.length;
      return {
        discipline,
        mastered,
        total,
        avgMastery: total > 0 ? Math.round((sumP / total) * 100) / 100 : 0,
        topRankName: meta(topRank || (skills[0] ? rankOfSkill(skills[0]) : 1)).name,
        nextSkillTitle,
        chosen: chosen.has(discipline),
      };
    };

    const disciplines = DISCIPLINES.map((d) => progressOf(d));
    const active = disciplines.filter((d) => d.chosen);

    // Propositions guidées : score d'APPÉTENCE composite (progression + qualité de maîtrise), avec
    // garde-fou de PERSISTANCE (≥ 2 compétences maîtrisées — on ne propose pas sur un pic isolé, cf.
    // recherche : un signal unique est sur-déterminé). Formulé comme piste, jamais un verdict.
    const appetence = (d: DisciplineProgress) => d.mastered + d.avgMastery * 3;
    const proposals: SpecializationProposal[] = disciplines
      .filter((d) => !d.chosen && d.mastered >= 2)
      .sort((a, b) => appetence(b) - appetence(a))
      .slice(0, 3)
      .map((d, i) => ({
        discipline: d.discipline,
        reason:
          i === 0
            ? `Ton signal le plus fort : ${d.mastered} compétences maîtrisées et une progression régulière ici.`
            : `Tu accroches aussi ici (${d.mastered} maîtrisées). À explorer si ça te parle.`,
      }));

    const badges: Badge[] = (
      await this.db
        .select()
        .from(learnerBadges)
        .where(eq(learnerBadges.profileId, profileId))
        .orderBy(desc(learnerBadges.createdAt))
    ).map((b) => ({
      id: b.id,
      name: b.name,
      discipline: b.discipline,
      criteria: b.criteria,
      dateIso: b.createdAt.toISOString(),
    }));

    return {
      unlocked,
      unlockRankName: meta(UNLOCK_RANK).name,
      currentRankName: meta(rank).name,
      active,
      proposals,
      disciplines,
      badges,
    };
  }

  /** Plan de spécialisation d'une discipline (null si pas encore généré). */
  async getPlan(profileId: string, discipline: string): Promise<SpecializationPlan | null> {
    const row = (
      await this.db
        .select()
        .from(specializationPlans)
        .where(and(eq(specializationPlans.profileId, profileId), eq(specializationPlans.discipline, discipline)))
    )[0];
    if (!row) return null;
    return { discipline: row.discipline, distalGoal: row.distalGoal, milestones: row.milestones as Milestone[] };
  }

  /** Le guide-IA génère (ou régénère) un plan de spécialisation pour la discipline. */
  async generatePlan(profileId: string, discipline: string): Promise<SpecializationPlan> {
    if (!DISCIPLINES.includes(discipline as (typeof DISCIPLINES)[number]))
      throw new BadRequestException('discipline inconnue');
    const graph = await this.graph.loadGraph();
    const titles = graph
      .filter((s) => disciplineOf(s.slug) === discipline)
      .sort((a, b) => a.depth - b.depth || (a.order ?? 0) - (b.order ?? 0))
      .map((s) => s.title)
      .slice(0, 14);
    const rank = await this.currentRank(profileId);
    const prompt =
      `Discipline : ${discipline}. Niveau actuel de l'élève : ${meta(rank).name}.\n` +
      `Compétences repères de la discipline (du plus simple au plus avancé) : ${titles.join(' ; ')}.\n` +
      `Conçois le plan de spécialisation (objectif distal + 5 à 8 jalons avec projets et badges).`;
    const { object } = await this.copilote.generateStructured<z.infer<typeof planGenSchema>>(profileId, {
      schema: planGenSchema,
      schemaName: 'SpecializationPlan',
      system: PLAN_SYSTEM,
      prompt,
      temperature: 0.4,
      ref: 'specialization-plan',
    });
    const milestones: Milestone[] = object.milestones.map((m, i) => ({
      id: `m${i + 1}`,
      competency: m.competency,
      successCriteria: m.successCriteria,
      subgoals: m.subgoals,
      projectBrief: m.projectBrief,
      badgeName: m.badgeName,
      done: false,
    }));
    await this.db
      .insert(specializationPlans)
      .values({ profileId, discipline, distalGoal: object.distalGoal, milestones })
      .onConflictDoUpdate({
        target: [specializationPlans.profileId, specializationPlans.discipline],
        set: { distalGoal: object.distalGoal, milestones, createdAt: new Date() },
      });
    return { discipline, distalGoal: object.distalGoal, milestones };
  }

  /** Valide un jalon : le marque fait et débloque le badge associé. */
  async completeMilestone(profileId: string, discipline: string, milestoneId: string): Promise<SpecializationPlan> {
    const row = (
      await this.db
        .select()
        .from(specializationPlans)
        .where(and(eq(specializationPlans.profileId, profileId), eq(specializationPlans.discipline, discipline)))
    )[0];
    if (!row) throw new NotFoundException('aucun plan pour cette discipline');
    const milestones = row.milestones as Milestone[];
    const m = milestones.find((x) => x.id === milestoneId);
    if (!m) throw new NotFoundException('jalon introuvable');
    if (!m.done) {
      m.done = true;
      await this.db
        .update(specializationPlans)
        .set({ milestones })
        .where(and(eq(specializationPlans.profileId, profileId), eq(specializationPlans.discipline, discipline)));
      await this.db.insert(learnerBadges).values({
        profileId,
        name: m.badgeName,
        discipline,
        criteria: m.successCriteria.join(' · '),
        milestoneId,
      });
    }
    return { discipline: row.discipline, distalGoal: row.distalGoal, milestones };
  }

  async choose(profileId: string, discipline: string): Promise<SpecializationView> {
    if (!DISCIPLINES.includes(discipline as (typeof DISCIPLINES)[number]))
      throw new BadRequestException('discipline inconnue');
    const rank = await this.currentRank(profileId);
    if (rank < UNLOCK_RANK) throw new BadRequestException('spécialisation pas encore débloquée');
    await this.db.insert(specializations).values({ profileId, discipline }).onConflictDoNothing();
    return this.view(profileId);
  }

  async drop(profileId: string, discipline: string): Promise<SpecializationView> {
    await this.db
      .delete(specializations)
      .where(and(eq(specializations.profileId, profileId), eq(specializations.discipline, discipline)));
    return this.view(profileId);
  }
}
