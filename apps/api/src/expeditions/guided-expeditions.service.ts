import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { advancePhase } from '@dowze/core';
import {
  expeditionProposalsSchema,
  phaseGuidanceSchema,
  type Dossier,
  type ExpeditionPhase,
  type ExpeditionProposal,
  type ExpeditionProposals,
  type LearnerExpedition,
  type PhaseGuidance,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { expeditionPhaseNotes, learnerDossiers, learnerExpeditions, profiles } from '../db/schema';
import { CopiloteService } from '../copilote/copilote.service';
import {
  EXPEDITION_PHASE_SYSTEM,
  EXPEDITION_PROPOSE_SYSTEM,
  expeditionPhasePrompt,
  expeditionProposePrompt,
} from './expedition-prompts';

@Injectable()
export class GuidedExpeditionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly copilote: CopiloteService,
  ) {}

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

  /** 3 propositions différenciées, calibrées au dossier + à l'âge de l'élève. */
  async propose(
    profileId: string,
  ): Promise<{ propositions: ExpeditionProposal[]; creditsSpent: number }> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    const dossierRow = (
      await this.db.select().from(learnerDossiers).where(eq(learnerDossiers.profileId, profileId))
    )[0];
    const dossier = dossierRow?.structured as Dossier | undefined;

    const { object, creditsSpent } = await this.copilote.generateStructured<ExpeditionProposals>(
      profileId,
      {
        schema: expeditionProposalsSchema,
        schemaName: 'ExpeditionProposals',
        system: EXPEDITION_PROPOSE_SYSTEM,
        prompt: expeditionProposePrompt({
          resume: dossier?.resumePedagogique ?? '',
          interets: dossier?.interets?.map((i) => i.theme) ?? [],
          age: this.ageOf(prof?.birthDate ?? null),
        }),
        temperature: 0.7,
        ref: 'expedition-propose',
      },
    );
    return { propositions: object.propositions, creditsSpent };
  }

  /** L'élève choisit une expédition (ou en saisit une après spécialisation). */
  async choose(profileId: string, proposal: ExpeditionProposal): Promise<LearnerExpedition> {
    const row = (
      await this.db
        .insert(learnerExpeditions)
        .values({
          profileId,
          title: proposal.titre,
          grandeQuestion: proposal.grandeQuestion,
          produit: proposal.produit,
          phase: 'etincelle',
          status: 'en-cours',
        })
        .returning()
    )[0];
    if (!row) throw new Error('échec de création de l’expédition');
    return this.toView(row);
  }

  async listMine(profileId: string): Promise<LearnerExpedition[]> {
    const rows = await this.db
      .select()
      .from(learnerExpeditions)
      .where(eq(learnerExpeditions.profileId, profileId))
      .orderBy(desc(learnerExpeditions.createdAt));
    return rows.map((r) => this.toView(r));
  }

  private async require(id: string) {
    const row = (
      await this.db.select().from(learnerExpeditions).where(eq(learnerExpeditions.id, id))
    )[0];
    if (!row) throw new NotFoundException('expédition introuvable');
    return row;
  }

  /** Génère le guidage de la phase courante (explication + prompt + pistes) et le stocke. */
  async phaseGuide(
    id: string,
  ): Promise<{ phase: ExpeditionPhase; guidance: PhaseGuidance; creditsSpent: number }> {
    const exp = await this.require(id);
    const phase = exp.phase as ExpeditionPhase;

    // Guidage déjà généré pour cette phase ? On le renvoie (pas de re-facturation).
    const existing = (
      await this.db
        .select()
        .from(expeditionPhaseNotes)
        .where(eq(expeditionPhaseNotes.learnerExpeditionId, id))
    ).find((n) => n.phase === phase && n.guidance);
    if (existing?.guidance) {
      return { phase, guidance: phaseGuidanceSchema.parse(existing.guidance), creditsSpent: 0 };
    }

    const { object, creditsSpent } = await this.copilote.generateStructured<PhaseGuidance>(
      exp.profileId,
      {
        schema: phaseGuidanceSchema,
        schemaName: 'PhaseGuidance',
        system: EXPEDITION_PHASE_SYSTEM,
        prompt: expeditionPhasePrompt({
          title: exp.title,
          grandeQuestion: exp.grandeQuestion,
          phase,
        }),
        temperature: 0.6,
        ref: `expedition-phase-${phase}`,
      },
    );
    await this.db
      .insert(expeditionPhaseNotes)
      .values({ learnerExpeditionId: id, phase, guidance: object });
    return { phase, guidance: object, creditsSpent };
  }

  /** Enregistre un bilan de phase et avance à la phase suivante (reste sur Trace à la fin). */
  async advance(id: string, bilan?: string): Promise<LearnerExpedition> {
    const exp = await this.require(id);
    const current = exp.phase as ExpeditionPhase;
    if (bilan && bilan.trim()) {
      await this.db
        .insert(expeditionPhaseNotes)
        .values({ learnerExpeditionId: id, phase: current, bilan: bilan.trim() });
    }
    const next = advancePhase(current);
    const status = next === 'trace' && current === 'trace' ? 'terminee' : 'en-cours';
    const updated = (
      await this.db
        .update(learnerExpeditions)
        .set({ phase: next, status })
        .where(eq(learnerExpeditions.id, id))
        .returning()
    )[0];
    return this.toView(updated ?? exp);
  }

  private toView(row: typeof learnerExpeditions.$inferSelect): LearnerExpedition {
    return {
      id: row.id,
      title: row.title,
      grandeQuestion: row.grandeQuestion,
      produit: row.produit,
      phase: row.phase as ExpeditionPhase,
      status: row.status as LearnerExpedition['status'],
    };
  }
}
