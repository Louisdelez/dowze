import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { generateObject, generateText } from 'ai';
import { jsonrepair } from 'jsonrepair';
import {
  aiEmbeddingModelSchema,
  aiModelSchema,
  sessionSnapshotSchema,
  type AiEmbeddingModel,
  type AiModel,
  type CopiloteSettingsView,
  type IngestRequest,
  type SessionSnapshot,
  type UpdateSettings,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import {
  aiEmbeddingModel,
  aiModel,
  copiloteSettings,
  learnerMisconceptions,
  skills,
} from '../db/schema';
import { ProgressionService } from '../progression/progression.service';
import { CarnetService } from '../carnet/carnet.service';
import { FsrsService, outcomeToRating } from '../fsrs/fsrs.service';
import { CreditsService, creditsForUsage, estimateCredits } from './credits.service';
import { platformKeyFor, resolveModel } from './provider';
import { decryptSecret, encryptSecret } from './crypto.util';
import { cosine, embedTexts, type EmbeddingConfig } from './embedding';
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
    private readonly fsrs: FsrsService,
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

  /** Catalogue des modèles d'embedding disponibles (mémoire sémantique). */
  async embeddingModels(): Promise<AiEmbeddingModel[]> {
    const rows = await this.db
      .select()
      .from(aiEmbeddingModel)
      .where(eq(aiEmbeddingModel.active, true))
      .orderBy(asc(aiEmbeddingModel.sort));
    return rows.map((r) => aiEmbeddingModelSchema.parse(r));
  }

  private async requireEmbeddingModel(id: string): Promise<AiEmbeddingModel> {
    const rows = await this.db
      .select()
      .from(aiEmbeddingModel)
      .where(eq(aiEmbeddingModel.id, id));
    if (!rows[0] || !rows[0].active) {
      throw new BadRequestException(`Modèle d'embedding inconnu ou inactif : ${id}`);
    }
    return aiEmbeddingModelSchema.parse(rows[0]);
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
      embeddingModelId: row?.embeddingModelId ?? null,
      hasEmbeddingKey: Boolean(row?.embeddingKeyEnc),
    };
  }

  async updateSettings(input: UpdateSettings): Promise<CopiloteSettingsView> {
    if (input.modelId) await this.requireModel(input.modelId); // valide l'existence

    const encrypt = (plain: string): string => {
      if (!this.env.COPILOTE_SECRET_KEY) {
        throw new ServiceUnavailableException(
          'Clé indisponible : COPILOTE_SECRET_KEY non configurée côté serveur.',
        );
      }
      return encryptSecret(plain, this.env.COPILOTE_SECRET_KEY);
    };

    // Chiffrement de la clé BYOK (chat) si fournie.
    let keyEnc: string | null | undefined;
    if (input.byokApiKey === null) keyEnc = null;
    else if (typeof input.byokApiKey === 'string') keyEnc = encrypt(input.byokApiKey);

    // Modèle d'embedding + clé d'embedding (dérive le fournisseur du catalogue).
    let embeddingProvider: string | null | undefined;
    if (input.embeddingModelId === null) {
      embeddingProvider = null;
    } else if (typeof input.embeddingModelId === 'string') {
      embeddingProvider = (await this.requireEmbeddingModel(input.embeddingModelId)).provider;
    }
    let embKeyEnc: string | null | undefined;
    if (input.embeddingApiKey === null) embKeyEnc = null;
    else if (typeof input.embeddingApiKey === 'string') embKeyEnc = encrypt(input.embeddingApiKey);

    const now = new Date();
    const insertValues = {
      profileId: input.profileId,
      modelId: input.modelId ?? DEFAULT_MODEL_ID,
      billing: input.billing ?? 'credits',
      byokProvider: input.byokProvider ?? null,
      byokKeyEnc: keyEnc ?? null,
      embeddingModelId: input.embeddingModelId ?? null,
      embeddingProvider: embeddingProvider ?? null,
      embeddingKeyEnc: embKeyEnc ?? null,
      updatedAt: now,
    };
    const updateSet: Partial<typeof copiloteSettings.$inferInsert> = { updatedAt: now };
    if (input.modelId !== undefined) updateSet.modelId = input.modelId;
    if (input.billing !== undefined) updateSet.billing = input.billing;
    if (input.byokProvider !== undefined) updateSet.byokProvider = input.byokProvider;
    if (keyEnc !== undefined) updateSet.byokKeyEnc = keyEnc;
    if (input.embeddingModelId !== undefined) updateSet.embeddingModelId = input.embeddingModelId;
    if (embeddingProvider !== undefined) updateSet.embeddingProvider = embeddingProvider;
    if (embKeyEnc !== undefined) updateSet.embeddingKeyEnc = embKeyEnc;

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

    // Mémoire : erreurs/confusions récurrentes actives sur cette compétence (les plus fréquentes).
    const activeMisc = await this.db
      .select()
      .from(learnerMisconceptions)
      .where(
        and(
          eq(learnerMisconceptions.profileId, profileId),
          eq(learnerMisconceptions.skillId, next.id),
          eq(learnerMisconceptions.status, 'active'),
        ),
      )
      .orderBy(desc(learnerMisconceptions.occurrences));
    const misconceptions = activeMisc.slice(0, 4).map((m) => m.label);

    // Mémoire : compétences déjà vues et dues à réviser aujourd'hui (FSRS), à intercaler.
    const dueIds = (await this.fsrs.due(profileId, new Date().toISOString()))
      .filter((id) => id !== next.id)
      .slice(0, 2);
    let reviews: string[] = [];
    if (dueIds.length > 0) {
      const rows = await this.db
        .select({ id: skills.id, title: skills.title })
        .from(skills)
        .where(inArray(skills.id, dueIds));
      const byId = new Map(rows.map((r) => [r.id, r.title]));
      reviews = dueIds.map((id) => byId.get(id)).filter((t): t is string => Boolean(t));
    }

    const prompt = buildSessionPrompt({
      title: next.title,
      pct,
      masteredCount,
      lastNote,
      misconceptions,
      reviews,
    });
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
    await this.fsrs.rate(input.profileId, input.skillId, outcomeToRating(snapshot.outcome), nowIso);
    const embConfig = await this.resolveEmbeddingConfig(settings);
    await this.reconcileMisconceptions(
      input.profileId,
      input.skillId,
      snapshot.errors,
      snapshot.outcome,
      nowIso,
      embConfig,
    );

    return { snapshot, pMastery: mastery.pMastery, creditsSpent };
  }

  /** Résout la config d'embedding de l'élève (modèle + clé déchiffrée), ou null si non activée. */
  private async resolveEmbeddingConfig(row: SettingsRow | null): Promise<EmbeddingConfig | null> {
    if (!row?.embeddingModelId || !row.embeddingKeyEnc || !this.env.COPILOTE_SECRET_KEY) return null;
    const model = await this.db
      .select()
      .from(aiEmbeddingModel)
      .where(eq(aiEmbeddingModel.id, row.embeddingModelId));
    if (!model[0]) return null;
    return {
      provider: model[0].provider,
      modelId: model[0].modelId,
      apiKey: decryptSecret(row.embeddingKeyEnc, this.env.COPILOTE_SECRET_KEY),
    };
  }

  /**
   * Réconcilie les erreurs/confusions extraites avec la mémoire existante (pattern Mem0) :
   * compétence maîtrisée → confusions actives résolues ; sinon on regroupe avec une confusion
   * déjà connue (par le SENS si les embeddings sont activés, sinon par mots) et on incrémente,
   * ou on en crée une nouvelle. Jamais un simple empilement.
   */
  private async reconcileMisconceptions(
    profileId: string,
    skillId: string,
    errors: string[],
    outcome: SessionSnapshot['outcome'],
    nowIso: string,
    embConfig: EmbeddingConfig | null,
  ): Promise<void> {
    const now = new Date(nowIso);

    if (outcome === 'maitrise') {
      await this.db
        .update(learnerMisconceptions)
        .set({ status: 'resolved', lastSeen: now })
        .where(
          and(
            eq(learnerMisconceptions.profileId, profileId),
            eq(learnerMisconceptions.skillId, skillId),
            eq(learnerMisconceptions.status, 'active'),
          ),
        );
      return;
    }

    const norm = (s: string) => s.trim().toLowerCase();
    const uniq = [
      ...new Map(
        errors
          .map((e) => e.trim())
          .filter((e) => e.length > 0 && e.length <= 200)
          .map((e) => [norm(e), e]),
      ).values(),
    ];
    if (uniq.length === 0) return;

    const existing = await this.db
      .select()
      .from(learnerMisconceptions)
      .where(
        and(
          eq(learnerMisconceptions.profileId, profileId),
          eq(learnerMisconceptions.skillId, skillId),
          eq(learnerMisconceptions.status, 'active'),
        ),
      );
    const byLabel = new Map(existing.map((m) => [norm(m.label), m]));

    // Embeddings des nouvelles confusions (si la mémoire sémantique est activée).
    let vectors: number[][] | null = null;
    if (embConfig) {
      try {
        vectors = await embedTexts(embConfig, uniq);
      } catch {
        vectors = null; // repli silencieux sur la comparaison par mots
      }
    }
    const SIM_THRESHOLD = 0.72;

    for (let i = 0; i < uniq.length; i++) {
      const label = uniq[i] as string;
      const vec = vectors?.[i] ?? null;

      // 1) correspondance exacte (mots), 2) sinon par le sens (cosinus).
      let hit = byLabel.get(norm(label)) ?? null;
      if (!hit && vec) {
        let bestSim = SIM_THRESHOLD;
        for (const m of existing) {
          if (!m.embedding || m.embedding.length === 0) continue;
          const sim = cosine(vec, m.embedding);
          if (sim >= bestSim) {
            bestSim = sim;
            hit = m;
          }
        }
      }

      if (hit) {
        await this.db
          .update(learnerMisconceptions)
          .set({
            occurrences: hit.occurrences + 1,
            lastSeen: now,
            ...(vec && (!hit.embedding || hit.embedding.length === 0) ? { embedding: vec } : {}),
          })
          .where(eq(learnerMisconceptions.id, hit.id));
      } else {
        await this.db.insert(learnerMisconceptions).values({
          profileId,
          skillId,
          label,
          status: 'active',
          firstSeen: now,
          lastSeen: now,
          embedding: vec,
        });
      }
    }
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
