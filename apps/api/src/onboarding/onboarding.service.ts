import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { dossierSchema, type Dossier, type PresentationInput } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { learnerDossiers } from '../db/schema';
import { CopiloteService } from '../copilote/copilote.service';
import { DOSSIER_SYSTEM, dossierPrompt } from '../copilote/prompts';

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly copilote: CopiloteService,
  ) {}

  /** Génère le dossier élève depuis la présentation (IA), le stocke NON validé. */
  async generate(
    input: PresentationInput,
  ): Promise<{ profileId: string; structured: Dossier; validated: boolean; creditsSpent: number }> {
    const { object, creditsSpent } = await this.copilote.generateStructured<Dossier>(
      input.profileId,
      {
        schema: dossierSchema,
        schemaName: 'DossierEleve',
        system: DOSSIER_SYSTEM,
        prompt: dossierPrompt(input),
        temperature: 0.3,
        ref: 'dossier',
      },
    );

    const now = new Date();
    await this.db
      .insert(learnerDossiers)
      .values({
        profileId: input.profileId,
        rawPresentation: input.presentation,
        structured: object,
        validated: false,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: learnerDossiers.profileId,
        set: { rawPresentation: input.presentation, structured: object, validated: false, updatedAt: now },
      });

    return { profileId: input.profileId, structured: object, validated: false, creditsSpent };
  }

  /** Renvoie le dossier stocké (structuré validé/corrigé), ou null s'il n'existe pas. */
  async get(profileId: string): Promise<{ profileId: string; structured: Dossier; validated: boolean } | null> {
    const rows = await this.db
      .select()
      .from(learnerDossiers)
      .where(eq(learnerDossiers.profileId, profileId));
    const row = rows[0];
    if (!row) return null;
    return {
      profileId,
      structured: dossierSchema.parse(row.structured),
      validated: row.validated,
    };
  }

  /** L'élève valide/corrige son dossier (human-in-the-loop). */
  async update(
    profileId: string,
    structured: Dossier,
    validated: boolean,
  ): Promise<{ profileId: string; structured: Dossier; validated: boolean }> {
    const now = new Date();
    await this.db
      .insert(learnerDossiers)
      .values({ profileId, rawPresentation: '', structured, validated, updatedAt: now })
      .onConflictDoUpdate({
        target: learnerDossiers.profileId,
        set: { structured, validated, updatedAt: now },
      });
    return { profileId, structured, validated };
  }
}
