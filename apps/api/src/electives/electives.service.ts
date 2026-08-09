import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, like } from 'drizzle-orm';
import { z } from 'zod';
import type {
  Badge,
  DiscoveryDiscipline,
  Elective,
  ElectiveDiscovery,
  ElectivePlan,
  ElectiveProposal,
  ElectiveView,
  Milestone,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  electiveDiscovery,
  electiveJournal,
  electivePlans,
  electives,
  learnerBadges,
  profiles,
} from '../db/schema';
import { CopiloteService } from '../copilote/copilote.service';
import { PLAN_SYSTEM, PROPOSALS_SYSTEM } from './elective-prompts';

const COMMIT_MONTHS = 6; // engagement AFFICHÉ (doux, non bloquant)
const REFLECTION_MONTHS = 1; // délai de réflexion avant de confirmer un changement

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function ageFromBirth(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
/** Plafond de temps de la passion (~20 %, bloc-tampon), en minutes/jour selon l'âge. */
function capMinutesFor(age: number | null): number {
  const a = age ?? 13;
  if (a <= 11) return 30;
  if (a <= 15) return 40;
  return 50;
}

const disciplinesGen = z.object({
  proposals: z
    .array(z.object({ label: z.string().min(1), disciplineHint: z.string(), reason: z.string().min(1) }))
    .min(1)
    .max(3),
});
const planGen = z.object({
  distalGoal: z.string().min(1),
  baseRate: z.string().min(1),
  paths: z.array(z.object({ title: z.string().min(1), note: z.string().min(1) })).min(2).max(4),
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

@Injectable()
export class ElectivesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly copilote: CopiloteService,
  ) {}

  private async electiveRow(profileId: string) {
    return (await this.db.select().from(electives).where(eq(electives.profileId, profileId)))[0] ?? null;
  }
  private async discoveryRow(profileId: string) {
    return (
      (
        await this.db
          .select()
          .from(electiveDiscovery)
          .where(and(eq(electiveDiscovery.profileId, profileId), eq(electiveDiscovery.status, 'active')))
      )[0] ?? null
    );
  }
  private async age(profileId: string): Promise<number | null> {
    const p = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    return ageFromBirth(p?.birthDate ?? null);
  }

  private toElective(r: typeof electives.$inferSelect): Elective {
    return {
      id: r.id,
      label: r.label,
      disciplineHint: r.disciplineHint,
      mode: r.mode as 'plaisir' | 'pro',
      status: r.status as 'active' | 'change_pending',
      chosenIso: r.chosenAt.toISOString(),
      commitUntilIso: r.commitUntil?.toISOString() ?? null,
      changeTarget: r.changeTarget,
      changeConfirmIso: r.changeConfirmAt?.toISOString() ?? null,
    };
  }

  private toDiscovery(r: typeof electiveDiscovery.$inferSelect, journalToday: boolean): ElectiveDiscovery {
    const list = r.disciplines as DiscoveryDiscipline[];
    const current = list[r.currentIndex] ?? null;
    const dayInWeek = Math.min(
      7,
      Math.max(1, Math.floor((Date.now() - r.weekStartedAt.getTime()) / 86_400_000) + 1),
    );
    return {
      id: r.id,
      round: r.round,
      disciplines: list,
      currentIndex: r.currentIndex,
      currentDiscipline: current,
      weekStartedIso: r.weekStartedAt.toISOString(),
      dayInWeek,
      journalToday,
      status: r.status as 'active' | 'done',
    };
  }

  async view(profileId: string): Promise<ElectiveView> {
    const eRow = await this.electiveRow(profileId);
    const dRow = await this.discoveryRow(profileId);
    const age = await this.age(profileId);

    let discovery: ElectiveDiscovery | null = null;
    if (dRow) {
      const cur = (dRow.disciplines as DiscoveryDiscipline[])[dRow.currentIndex];
      const jToday = cur
        ? (
            await this.db
              .select()
              .from(electiveJournal)
              .where(
                and(
                  eq(electiveJournal.profileId, profileId),
                  eq(electiveJournal.entryDate, todayStr()),
                  eq(electiveJournal.discipline, cur.label),
                ),
              )
          ).length > 0
        : false;
      discovery = this.toDiscovery(dRow, jToday);
    }

    const badges: Badge[] = (
      await this.db
        .select()
        .from(learnerBadges)
        .where(and(eq(learnerBadges.profileId, profileId), like(learnerBadges.discipline, 'Passion%')))
        .orderBy(desc(learnerBadges.createdAt))
    ).map((b) => ({ id: b.id, name: b.name, discipline: b.discipline, criteria: b.criteria, dateIso: b.createdAt.toISOString() }));

    const plan = eRow ? await this.getPlan(profileId, eRow.label) : null;
    const inReflection = !!(eRow && eRow.status === 'change_pending' && eRow.changeConfirmAt && eRow.changeConfirmAt > new Date());

    return {
      elective: eRow ? this.toElective(eRow) : null,
      discovery,
      proposals: [],
      plan,
      badges,
      capMinutes: capMinutesFor(age),
      inReflection,
    };
  }

  // ---------------- Mode découverte ----------------

  async startDiscovery(profileId: string, disciplines: DiscoveryDiscipline[], round = 1): Promise<ElectiveView> {
    if (disciplines.length !== 5) throw new BadRequestException('Choisis exactement 5 disciplines à explorer.');
    // Une seule découverte active : on clôt l'ancienne.
    await this.db
      .update(electiveDiscovery)
      .set({ status: 'done' })
      .where(and(eq(electiveDiscovery.profileId, profileId), eq(electiveDiscovery.status, 'active')));
    await this.db.insert(electiveDiscovery).values({ profileId, round, disciplines, currentIndex: 0 });
    return this.view(profileId);
  }

  /** Passe à la discipline suivante (nouvelle semaine). À la 5e, la découverte se termine. */
  async nextDiscipline(profileId: string): Promise<ElectiveView> {
    const d = await this.discoveryRow(profileId);
    if (!d) throw new NotFoundException('aucune découverte en cours');
    const list = d.disciplines as DiscoveryDiscipline[];
    if (d.currentIndex + 1 >= list.length) {
      await this.db.update(electiveDiscovery).set({ status: 'done' }).where(eq(electiveDiscovery.id, d.id));
    } else {
      await this.db
        .update(electiveDiscovery)
        .set({ currentIndex: d.currentIndex + 1, weekStartedAt: new Date() })
        .where(eq(electiveDiscovery.id, d.id));
    }
    return this.view(profileId);
  }

  async addJournal(
    profileId: string,
    entry: { discipline: string; did: string; liked: string; disliked: string; intensity: number },
  ): Promise<ElectiveView> {
    const d = await this.discoveryRow(profileId);
    await this.db.insert(electiveJournal).values({
      profileId,
      discoveryId: d?.id ?? null,
      discipline: entry.discipline,
      entryDate: todayStr(),
      did: entry.did,
      liked: entry.liked,
      disliked: entry.disliked,
      intensity: Math.max(1, Math.min(5, Math.round(entry.intensity))),
    });
    return this.view(profileId);
  }

  /** L'IA lit les journaux et propose 2-3 pistes (hypothèses, jamais un verdict). */
  async analyze(profileId: string): Promise<ElectiveProposal[]> {
    const entries = await this.db
      .select()
      .from(electiveJournal)
      .where(eq(electiveJournal.profileId, profileId))
      .orderBy(desc(electiveJournal.createdAt))
      .limit(40);
    if (entries.length === 0)
      throw new BadRequestException("Tiens d'abord ton journal de bord quelques jours — l'IA aura de quoi t'aider.");
    const digest = entries
      .map(
        (e) =>
          `[${e.discipline}] fait: ${e.did || '—'} | aimé: ${e.liked || '—'} | pas aimé: ${e.disliked || '—'} | plaisir ${e.intensity}/5`,
      )
      .join('\n');
    const { object } = await this.copilote.generateStructured<z.infer<typeof disciplinesGen>>(profileId, {
      schema: disciplinesGen,
      schemaName: 'ElectiveProposals',
      system: PROPOSALS_SYSTEM,
      prompt: `Journaux de l'élève (récents en premier) :\n${digest}\n\nPropose 2-3 pistes (hypothèses).`,
      temperature: 0.5,
      ref: 'elective-proposals',
    });
    return object.proposals;
  }

  // ---------------- Choix, changement (verrou DOUX), sortie ----------------

  async choose(
    profileId: string,
    input: { label: string; disciplineHint?: string; mode?: 'plaisir' | 'pro' },
  ): Promise<ElectiveView> {
    const label = input.label.trim();
    if (label.length < 2) throw new BadRequestException('Donne un nom à ta passion.');
    const now = new Date();
    await this.db
      .insert(electives)
      .values({
        profileId,
        label,
        disciplineHint: input.disciplineHint ?? '',
        mode: input.mode ?? 'plaisir',
        status: 'active',
        chosenAt: now,
        commitUntil: addMonths(now, COMMIT_MONTHS),
        changeTarget: null,
        changeProposedAt: null,
        changeConfirmAt: null,
      })
      .onConflictDoUpdate({
        target: electives.profileId,
        set: {
          label,
          disciplineHint: input.disciplineHint ?? '',
          mode: input.mode ?? 'plaisir',
          status: 'active',
          chosenAt: now,
          commitUntil: addMonths(now, COMMIT_MONTHS),
          changeTarget: null,
          changeProposedAt: null,
          changeConfirmAt: null,
        },
      });
    // Clôt une éventuelle découverte en cours.
    await this.db
      .update(electiveDiscovery)
      .set({ status: 'done' })
      .where(and(eq(electiveDiscovery.profileId, profileId), eq(electiveDiscovery.status, 'active')));
    return this.view(profileId);
  }

  async setMode(profileId: string, mode: 'plaisir' | 'pro'): Promise<ElectiveView> {
    const r = await this.electiveRow(profileId);
    if (!r) throw new NotFoundException('aucune passion choisie');
    await this.db.update(electives).set({ mode }).where(eq(electives.profileId, profileId));
    return this.view(profileId);
  }

  /** Propose un changement : démarre le délai de réflexion d'1 mois (rien n'est verrouillé). */
  async proposeChange(profileId: string, target: string): Promise<ElectiveView> {
    const r = await this.electiveRow(profileId);
    if (!r) throw new NotFoundException('aucune passion à changer');
    const t = target.trim();
    if (t.length < 2) throw new BadRequestException('Indique la nouvelle passion envisagée.');
    const now = new Date();
    await this.db
      .update(electives)
      .set({ status: 'change_pending', changeTarget: t, changeProposedAt: now, changeConfirmAt: addMonths(now, REFLECTION_MONTHS) })
      .where(eq(electives.profileId, profileId));
    return this.view(profileId);
  }

  /** Confirme le changement — possible seulement après le mois de réflexion. */
  async confirmChange(profileId: string): Promise<ElectiveView> {
    const r = await this.electiveRow(profileId);
    if (!r || r.status !== 'change_pending' || !r.changeTarget)
      throw new BadRequestException('aucun changement en attente');
    if (r.changeConfirmAt && r.changeConfirmAt > new Date())
      throw new BadRequestException('Prends encore un peu de temps pour réfléchir — le changement se confirme après 1 mois.');
    // Bascule vers la nouvelle passion + nouvel engagement doux.
    const now = new Date();
    await this.db.delete(electivePlans).where(eq(electivePlans.profileId, profileId));
    await this.db
      .update(electives)
      .set({
        label: r.changeTarget,
        disciplineHint: '',
        status: 'active',
        chosenAt: now,
        commitUntil: addMonths(now, COMMIT_MONTHS),
        changeTarget: null,
        changeProposedAt: null,
        changeConfirmAt: null,
      })
      .where(eq(electives.profileId, profileId));
    return this.view(profileId);
  }

  /** Annule une proposition de changement (on garde la passion actuelle). */
  async cancelChange(profileId: string): Promise<ElectiveView> {
    await this.db
      .update(electives)
      .set({ status: 'active', changeTarget: null, changeProposedAt: null, changeConfirmAt: null })
      .where(eq(electives.profileId, profileId));
    return this.view(profileId);
  }

  /** Rampe de sortie sans pénalité (mal-être / inadéquation manifeste) : on libère complètement. */
  async exit(profileId: string): Promise<ElectiveView> {
    await this.db.delete(electivePlans).where(eq(electivePlans.profileId, profileId));
    await this.db.delete(electives).where(eq(electives.profileId, profileId));
    return this.view(profileId);
  }

  // ---------------- Plan (Plan A/B) + jalons ----------------

  async getPlan(profileId: string, label: string): Promise<ElectivePlan | null> {
    const row = (
      await this.db
        .select()
        .from(electivePlans)
        .where(and(eq(electivePlans.profileId, profileId), eq(electivePlans.label, label)))
    )[0];
    if (!row) return null;
    return {
      label: row.label,
      distalGoal: row.distalGoal,
      paths: row.paths as ElectivePlan['paths'],
      baseRate: row.baseRate,
      milestones: row.milestones as Milestone[],
    };
  }

  async generatePlan(profileId: string): Promise<ElectivePlan> {
    const r = await this.electiveRow(profileId);
    if (!r) throw new NotFoundException('aucune passion choisie');
    const age = await this.age(profileId);
    const prompt =
      `Passion : ${r.label}${r.disciplineHint ? ` (famille : ${r.disciplineHint})` : ''}. ` +
      `Mode : ${r.mode === 'pro' ? 'professionnaliser (viser un métier)' : 'pour le plaisir'}. ` +
      `Âge : ${age ?? 'inconnu'}. Conçois le plan (cap + jalons/projets/badges + Plan A/B + taux de base honnête).`;
    const { object } = await this.copilote.generateStructured<z.infer<typeof planGen>>(profileId, {
      schema: planGen,
      schemaName: 'ElectivePlan',
      system: PLAN_SYSTEM,
      prompt,
      temperature: 0.4,
      ref: 'elective-plan',
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
      .insert(electivePlans)
      .values({ profileId, label: r.label, distalGoal: object.distalGoal, paths: object.paths, baseRate: object.baseRate, milestones })
      .onConflictDoUpdate({
        target: [electivePlans.profileId, electivePlans.label],
        set: { distalGoal: object.distalGoal, paths: object.paths, baseRate: object.baseRate, milestones },
      });
    return { label: r.label, distalGoal: object.distalGoal, paths: object.paths, baseRate: object.baseRate, milestones };
  }

  async completeMilestone(profileId: string, milestoneId: string): Promise<ElectivePlan> {
    const r = await this.electiveRow(profileId);
    if (!r) throw new NotFoundException('aucune passion choisie');
    const row = (
      await this.db
        .select()
        .from(electivePlans)
        .where(and(eq(electivePlans.profileId, profileId), eq(electivePlans.label, r.label)))
    )[0];
    if (!row) throw new NotFoundException('aucun plan');
    const milestones = row.milestones as Milestone[];
    const m = milestones.find((x) => x.id === milestoneId);
    if (!m) throw new NotFoundException('jalon introuvable');
    if (!m.done) {
      m.done = true;
      await this.db.update(electivePlans).set({ milestones }).where(eq(electivePlans.id, row.id));
      await this.db.insert(learnerBadges).values({
        profileId,
        name: m.badgeName,
        discipline: `Passion · ${r.label}`,
        criteria: m.successCriteria.join(' · '),
        milestoneId,
      });
    }
    return { label: row.label, distalGoal: row.distalGoal, paths: row.paths as ElectivePlan['paths'], baseRate: row.baseRate, milestones };
  }
}
