import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { generateObject, generateText } from 'ai';
import { jsonrepair } from 'jsonrepair';
import {
  aiModelSchema,
  sessionSnapshotSchema,
  type AiModel,
  type CopiloteSettingsView,
  type IngestRequest,
  type SessionSnapshot,
  type UpdateSettings,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { aiModel, copiloteSettings } from '../db/schema';
import { ProgressionService } from '../progression/progression.service';
import { CarnetService } from '../carnet/carnet.service';
import { CreditsService, creditsForUsage, estimateCredits } from './credits.service';
import { platformKeyFor, resolveModel } from './provider';
import { decryptSecret, encryptSecret } from './crypto.util';
import {
  EXTRACTION_SYSTEM,
  buildClosingPrompt,
  buildSessionPrompt,
  extractionPrompt,
} from './prompts';

const DEFAULT_MODEL_ID = 'gpt-4o-mini';
const MASTERY_THRESHOLD = 0.95;

type SettingsRow = typeof copiloteSettings.$inferSelect;

@Injectable()
export class CopiloteService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly progression: ProgressionService,
    private readonly carnet: CarnetService,
    private readonly credits: CreditsService,
  ) {}

  // --- Catalogue ---

  async models(): Promise<AiModel[]> {
    const rows = await this.db
      .select()
      .from(aiModel)
      .where(eq(aiModel.active, true))
      .orderBy(asc(aiModel.sort));
    return rows.map((r) => aiModelSchema.parse(r));
  }

  private async requireModel(id: string): Promise<AiModel> {
    const rows = await this.db.select().from(aiModel).where(eq(aiModel.id, id));
    if (!rows[0] || !rows[0].active) {
      throw new BadRequestException(`Modèle inconnu ou inactif : ${id}`);
    }
    return aiModelSchema.parse(rows[0]);
  }

  // --- Réglages ---

  private async settingsRow(profileId: string): Promise<SettingsRow | null> {
    const rows = await this.db
      .select()
      .from(copiloteSettings)
      .where(eq(copiloteSettings.profileId, profileId));
    return rows[0] ?? null;
  }

  async getSettings(profileId: string): Promise<CopiloteSettingsView> {
    const row = await this.settingsRow(profileId);
    return {
      profileId,
      modelId: row?.modelId ?? DEFAULT_MODEL_ID,
      billing: (row?.billing as CopiloteSettingsView['billing']) ?? 'credits',
      byokProvider: (row?.byokProvider as CopiloteSettingsView['byokProvider']) ?? null,
      hasByokKey: Boolean(row?.byokKeyEnc),
    };
  }

  async updateSettings(input: UpdateSettings): Promise<CopiloteSettingsView> {
    if (input.modelId) await this.requireModel(input.modelId); // valide l'existence

    // Chiffrement de la clé BYOK si fournie.
    let keyEnc: string | null | undefined;
    if (input.byokApiKey === null) {
      keyEnc = null; // effacer
    } else if (typeof input.byokApiKey === 'string') {
      if (!this.env.COPILOTE_SECRET_KEY) {
        throw new ServiceUnavailableException(
          'BYOK indisponible : COPILOTE_SECRET_KEY non configurée côté serveur.',
        );
      }
      keyEnc = encryptSecret(input.byokApiKey, this.env.COPILOTE_SECRET_KEY);
    }

    const now = new Date();
    const insertValues = {
      profileId: input.profileId,
      modelId: input.modelId ?? DEFAULT_MODEL_ID,
      billing: input.billing ?? 'credits',
      byokProvider: input.byokProvider ?? null,
      byokKeyEnc: keyEnc ?? null,
      updatedAt: now,
    };
    const updateSet: Partial<typeof copiloteSettings.$inferInsert> = { updatedAt: now };
    if (input.modelId !== undefined) updateSet.modelId = input.modelId;
    if (input.billing !== undefined) updateSet.billing = input.billing;
    if (input.byokProvider !== undefined) updateSet.byokProvider = input.byokProvider;
    if (keyEnc !== undefined) updateSet.byokKeyEnc = keyEnc;

    await this.db
      .insert(copiloteSettings)
      .values(insertValues)
      .onConflictDoUpdate({ target: copiloteSettings.profileId, set: updateSet });

    return this.getSettings(input.profileId);
  }

  // --- Composer le prompt du jour (déterministe, gratuit) ---

  async compose(profileId: string): Promise<{
    prompt: string;
    closingPrompt: string;
    skill: { id: string; slug: string; title: string } | null;
  }> {
    const next = await this.progression.nextPrescribed(profileId);
    if (!next) return { prompt: '', closingPrompt: '', skill: null };

    const mastery = await this.progression.getMastery(profileId);
    const m = mastery.find((x) => x.skillId === next.id);
    const pct = Math.round((m?.pMastery ?? 0) * 100);
    const masteredCount = mastery.filter((x) => x.pMastery >= MASTERY_THRESHOLD).length;

    const entries = await this.carnet.list(profileId);
    const lastNote = entries[0]?.note ?? null;

    const prompt = buildSessionPrompt({ title: next.title, pct, masteredCount, lastNote });
    const closingPrompt = buildClosingPrompt(next.title);
    return { prompt, closingPrompt, skill: { id: next.id, slug: next.slug, title: next.title } };
  }

  // --- Ingérer le résumé (texte → snapshot → BKT + carnet) ---

  async ingest(
    input: IngestRequest,
  ): Promise<{ snapshot: SessionSnapshot; pMastery: number; creditsSpent: number }> {
    const settings = await this.settingsRow(input.profileId);
    const modelId = input.modelId ?? settings?.modelId ?? DEFAULT_MODEL_ID;
    const model = await this.requireModel(modelId);
    const billing = settings?.billing ?? 'credits';

    // Résolution de la clé API + garde-fou facturation.
    let apiKey: string;
    let held = 0;
    if (billing === 'byok') {
      if (!settings?.byokKeyEnc || !this.env.COPILOTE_SECRET_KEY) {
        throw new BadRequestException(
          'Aucune clé BYOK configurée. Ajoute ta clé dans les réglages du Copilote, ou passe en mode crédits.',
        );
      }
      apiKey = decryptSecret(settings.byokKeyEnc, this.env.COPILOTE_SECRET_KEY);
    } else {
      const key = platformKeyFor(model.provider, this.env);
      if (!key) {
        throw new ServiceUnavailableException(
          `Le modèle ${model.label} n'est pas disponible en mode crédits pour l'instant. Choisis un autre modèle ou utilise ta propre clé (BYOK).`,
        );
      }
      apiKey = key;
      held = estimateCredits(model);
      const ok = await this.credits.tryDebit(input.profileId, held, 'hold', input.skillId);
      if (!ok) {
        throw new HttpException(
          'Crédits insuffisants. Recharge ton solde ou passe en BYOK.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    // Appel LLM structuré (+ filet jsonrepair→Zod pour les modèles non-stricts).
    let snapshot: SessionSnapshot;
    let inTok = 0;
    let outTok = 0;
    try {
      const lm = resolveModel(model.provider, model.modelId, apiKey);
      const result = await generateObject({
        model: lm,
        schema: sessionSnapshotSchema,
        schemaName: 'SessionSnapshot',
        system: EXTRACTION_SYSTEM,
        prompt: extractionPrompt(input.summary),
        temperature: 0.2,
      });
      snapshot = result.object;
      inTok = result.usage?.promptTokens ?? 0;
      outTok = result.usage?.completionTokens ?? 0;
    } catch (structuredErr) {
      try {
        const lm = resolveModel(model.provider, model.modelId, apiKey);
        const txt = await generateText({
          model: lm,
          system: `${EXTRACTION_SYSTEM} Réponds UNIQUEMENT par un objet JSON conforme, sans texte autour.`,
          prompt: extractionPrompt(input.summary),
          temperature: 0.2,
        });
        inTok = txt.usage?.promptTokens ?? 0;
        outTok = txt.usage?.completionTokens ?? 0;
        const repaired = jsonrepair(extractJsonBlock(txt.text));
        snapshot = sessionSnapshotSchema.parse(JSON.parse(repaired));
      } catch {
        // Échec complet : on rembourse le pré-débit puis on remonte l'erreur.
        if (billing === 'credits' && held > 0) {
          await this.credits.grant(input.profileId, held, 'refund', input.skillId);
        }
        throw new ServiceUnavailableException(
          "Le Copilote n'a pas réussi à lire ce résumé. Réessaie, ou choisis un modèle plus fiable dans les réglages.",
        );
      }
    }

    // Réconciliation des crédits avec le coût réel.
    let creditsSpent = 0;
    if (billing === 'credits') {
      creditsSpent = creditsForUsage(model, inTok, outTok);
      await this.credits.reconcile(input.profileId, held, creditsSpent, input.skillId);
    }

    // Application : Dowze RECALCULE la maîtrise (BKT) — jamais un score du LLM.
    const nowIso = new Date().toISOString();
    const correct = snapshot.outcome !== 'bloque';
    const mastery = await this.progression.observe(input.profileId, input.skillId, correct, nowIso);
    await this.carnet.addEntry(input.profileId, snapshot.carnetNote, input.skillId);

    return { snapshot, pMastery: mastery.pMastery, creditsSpent };
  }
}

/** Isole le premier objet JSON d'un texte (retire prose et clôtures ```json). */
function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}
