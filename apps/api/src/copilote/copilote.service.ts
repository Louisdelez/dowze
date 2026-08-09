import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { generateObject, generateText, type ToolSet } from 'ai';
import { jsonrepair } from 'jsonrepair';
import { z, type ZodType } from 'zod';
import {
  aiEmbeddingModelSchema,
  aiModelSchema,
  courseReviewSchema,
  courseSheetGenSchema,
  courseSheetSchema,
  sessionSnapshotSchema,
  type AiEmbeddingModel,
  type AiModel,
  type CopiloteSettingsView,
  type CourseSheet,
  type IngestRequest,
  type MasteryState,
  type SessionSnapshot,
  type UpdateSettings,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import {
  aiEmbeddingModel,
  aiModel,
  carnetEntries,
  copiloteSettings,
  courseClosures,
  learnerDossiers,
  learnerMisconceptions,
  skills,
} from '../db/schema';
import type { Dossier } from '@dowze/schemas';
import { ProgressionService } from '../progression/progression.service';
import { CarnetService } from '../carnet/carnet.service';
import { FsrsService, outcomeToRating } from '../fsrs/fsrs.service';
import { CreditsService, creditsForUsage, estimateCredits } from './credits.service';
import { localDateStr } from '../common/local-date';
import { CacheService } from '../cache/cache.service';
import { platformKeyFor, resolveModel } from './provider';
import { decryptSecret, encryptSecret } from './crypto.util';
import { cosine, embedTexts, type EmbeddingConfig } from './embedding';
import {
  COURSE_REVIEW_SYSTEM,
  COURSE_SHEET_SYSTEM,
  EXTRACTION_SYSTEM,
  buildClosingPrompt,
  buildSessionPrompt,
  extractionPrompt,
} from './prompts';

const DEFAULT_MODEL_ID = 'gpt-4o-mini';
const MASTERY_THRESHOLD = 0.95;

/** Ébauche de compétence générée + vérifiée (sans id/prérequis/profondeur, calculés par l'appelant). */
export interface GeneratedSkillDraft {
  slug: string;
  title: string;
  description: string;
  kind: string;
  rank: number;
  epistemicStatus: 'etabli' | 'en-debat' | 'emergent' | 'obsolescent';
  halfLifeYears: number | null;
  masteryThreshold: number;
  sources: string[];
}

/** Système de l'architecte de l'Atlas — la carte vivante des savoirs, de la maternelle au front de recherche. */
const GRAPH_GROW_SYSTEM = [
  "Tu es l'architecte de l'Atlas de Dowze : la carte vivante des savoirs, continue et sans fin,",
  'de la maternelle au front de la recherche. On te donne une compétence-frontière déjà maîtrisée',
  "par un élève. Génère la ou les compétences qui la SUIVENT logiquement — l'étape immédiatement",
  'plus avancée, dans la même discipline. Règles strictes :',
  '- slug : kebab-case, court, parlant, spécifique (pas de doublon avec la frontière) ;',
  '- title : concis (≤ 8 mots) ;',
  '- description : 2-4 phrases, précise, qui SITUE le niveau (licence / master / doctorat / recherche…)',
  "  et énonce ce que l'élève sait faire ;",
  '- kind : la nature (savoir, savoir-faire, savoir-être, capacite-corporelle, civique, esthetique) ;',
  '- masteryThreshold : entre 0.85 et 0.98 selon la criticité ;',
  "- sources : 1-3 références réelles et vérifiables (ouvrage, article, standard) quand c'est pertinent.",
  "Reste rigoureux et fondé sur le consensus scientifique. N'invente jamais de source. Progression réaliste :",
  'une seule étape en avant, jamais un saut de plusieurs niveaux.',
].join('\n');

const skillKindEnum = z.enum([
  'savoir',
  'savoir-faire',
  'savoir-etre',
  'capacite-corporelle',
  'civique',
  'esthetique',
]);
const epistemicEnum = z.enum(['etabli', 'en-debat', 'emergent', 'obsolescent']);

/** Schéma des ébauches de compétences générées (sans id/prérequis/profondeur, calculés par l'appelant). */
const nextSkillsSchema = z.object({
  skills: z
    .array(
      z.object({
        slug: z.string().min(2).max(80),
        title: z.string().min(2).max(120),
        description: z.string().min(10).max(1200),
        kind: skillKindEnum,
        /** Rang ISCED (1 Fer → 10 Dowzer Suprême) — explicite, autoritatif. */
        rank: z.number().int().min(1).max(10),
        epistemicStatus: epistemicEnum.default('etabli'),
        halfLifeYears: z.number().positive().nullable().default(null),
        masteryThreshold: z.number().min(0.5).max(0.99).optional(),
        /** Ancrage : ≥1 source réelle et vérifiable (ouvrage, article, standard). */
        sources: z.array(z.string().min(3).max(300)).min(1).max(3),
      }),
    )
    .min(1)
    .max(3),
});

/** Schéma de la passe de vérification adversariale (ancrage / anti-hallucination). */
const verifySkillsSchema = z.object({
  verdicts: z
    .array(
      z.object({
        slug: z.string(),
        /** La compétence est-elle réelle, au bon niveau, dans le consensus ? */
        real: z.boolean(),
        /** Les sources citées sont-elles plausibles et vérifiables (pas inventées) ? */
        sourcesPlausibles: z.boolean(),
        /** Statut épistémique corrigé après vérification. */
        epistemicStatus: epistemicEnum,
        raison: z.string().max(300).optional(),
      }),
    )
    .default([]),
});

const GRAPH_VERIFY_SYSTEM = [
  "Tu es un vérificateur épistémique rigoureux et SCEPTIQUE de l'Atlas de Dowze. On te donne des",
  'compétences fraîchement générées (titre, description, sources). Pour CHACUNE, juge honnêtement :',
  '- real : la compétence existe-t-elle réellement, est-elle au niveau annoncé, et relève-t-elle du',
  '  consensus (pas une invention, pas un doublon trivial, pas une absurdité) ? En cas de doute, real=false.',
  '- sourcesPlausibles : les sources citées sont-elles réelles et vérifiables ? Si une source semble',
  '  inventée ou trop vague, sourcesPlausibles=false.',
  '- epistemicStatus : etabli (consensus stable) | en-debat (controversé) | emergent (front de recherche) |',
  '  obsolescent (en voie de péremption). Un savoir de pointe/recherche est rarement « etabli ».',
  'Sois exigeant : mieux vaut rejeter un nœud douteux que polluer la carte.',
].join('\n');

/** Libellés lisibles des domaines de compétence (kind → français). */
const DOMAIN_LABELS: Record<string, string> = {
  savoir: 'savoir',
  'savoir-faire': 'savoir-faire',
  'savoir-etre': 'savoir-être',
  'capacite-corporelle': 'capacité corporelle',
  civique: 'civique',
  esthetique: 'esthétique',
};

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
    private readonly cache: CacheService,
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
    const rows = await this.db.select().from(aiEmbeddingModel).where(eq(aiEmbeddingModel.id, id));
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
      lowcostModelId: row?.lowcostModelId ?? null,
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
      const embModel = await this.requireEmbeddingModel(input.embeddingModelId);
      embeddingProvider = embModel.provider;
      // Garde (audit 08-2026) : la ruche (pgvector `vector(1024)`) exige 1024 dimensions. Un modèle à
      // 1536 dims passait silencieusement → tous les stockages d'embeddings de la ruche devenaient des
      // no-op muets (recherche sémantique/dedup morts). On refuse net, avec un message actionnable.
      if (embModel.dimensions !== 1024) {
        throw new BadRequestException(
          `Le modèle d'embedding « ${embModel.label} » produit ${embModel.dimensions} dimensions ; ` +
            'la mémoire sémantique de Dowze en attend 1024. Choisis un modèle 1024 dimensions (ex. Jina v3).',
        );
      }
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
      lowcostModelId: input.lowcostModelId ?? null,
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
    if (input.lowcostModelId !== undefined) {
      if (input.lowcostModelId) await this.requireModel(input.lowcostModelId);
      updateSet.lowcostModelId = input.lowcostModelId;
    }

    await this.db
      .insert(copiloteSettings)
      .values(insertValues)
      .onConflictDoUpdate({ target: copiloteSettings.profileId, set: updateSet });

    return this.getSettings(input.profileId);
  }

  // --- Traduction (modèle LowCost) ---

  private static readonly LANG_NAMES: Record<string, string> = {
    fr: 'français',
    en: 'anglais',
    de: 'allemand',
    it: 'italien',
    es: 'espagnol',
    pt: 'portugais',
    nl: 'néerlandais',
    ar: 'arabe',
  };

  /**
   * Traduit un texte vers `targetLang` avec le modèle LowCost (ou l'IA principale si non défini).
   * Renvoie le texte + l'usage réel (tokens) + une estimation de coût.
   */
  async translate(
    profileId: string,
    text: string,
    targetLang: string,
  ): Promise<{ text: string; promptTokens: number; completionTokens: number; costUsd: number }> {
    const settings = await this.settingsRow(profileId);
    const billing = settings?.billing ?? 'credits';

    // Modèle : LowCost si défini, sinon l'IA principale.
    let model = await this.requireModel(
      settings?.lowcostModelId ?? settings?.modelId ?? DEFAULT_MODEL_ID,
    );
    // En BYOK, la clé est liée à un fournisseur : si le LowCost ne correspond pas, on réutilise l'IA principale.
    if (billing === 'byok' && settings?.byokProvider && model.provider !== settings.byokProvider) {
      model = await this.requireModel(settings.modelId);
    }

    // Facturation identique au reste du Copilote (audit 08-2026 : la traduction n'était PAS débitée en
    // mode crédits → usage LLM plateforme gratuit illimité). Hold estimé → réconciliation au réel.
    let apiKey: string;
    let held = 0;
    if (billing === 'byok') {
      if (!settings?.byokKeyEnc || !this.env.COPILOTE_SECRET_KEY) {
        throw new BadRequestException(
          'Configure ta clé dans « Mon Copilote » pour activer la traduction.',
        );
      }
      apiKey = decryptSecret(settings.byokKeyEnc, this.env.COPILOTE_SECRET_KEY);
    } else {
      const key = platformKeyFor(model.provider, this.env);
      if (!key)
        throw new ServiceUnavailableException(
          'Traduction indisponible : aucune clé configurée pour ce modèle.',
        );
      apiKey = key;
      held = estimateCredits(model);
      const ok = await this.credits.tryDebit(profileId, held, 'hold', 'translate');
      if (!ok) {
        throw new HttpException(
          'Crédits insuffisants. Recharge ton solde ou passe en BYOK.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const langName = CopiloteService.LANG_NAMES[targetLang] ?? targetLang;
    const lm = resolveModel(model.provider, model.modelId, apiKey);
    let res: Awaited<ReturnType<typeof generateText>>;
    try {
      res = await generateText({
        model: lm,
        system: `Tu es un traducteur professionnel. Traduis fidèlement le message de l'utilisateur en ${langName}. Réponds UNIQUEMENT par la traduction, sans guillemets, sans préambule, sans commentaire. Préserve les emojis, les @mentions et les liens tels quels.`,
        prompt: text,
        temperature: 0.2,
      });
    } catch (e) {
      // Échec LLM : rembourse le pré-débit.
      if (billing === 'credits' && held > 0)
        await this.credits.grant(profileId, held, 'refund', 'translate');
      throw e;
    }
    const promptTokens = res.usage?.promptTokens ?? 0;
    const completionTokens = res.usage?.completionTokens ?? 0;
    if (billing === 'credits') {
      const spent = creditsForUsage(model, promptTokens, completionTokens);
      await this.credits.reconcile(profileId, held, spent, 'translate');
    }
    const costUsd =
      (promptTokens / 1e6) * model.priceIn + (completionTokens / 1e6) * model.priceOut;
    return { text: res.text.trim(), promptTokens, completionTokens, costUsd };
  }

  // --- École générative : faire grandir l'Atlas au bord du graphe ---

  /**
   * Génère les 1-N compétences qui SUIVENT directement une compétence-frontière déjà maîtrisée
   * (une profondeur plus loin, même domaine). Renvoie des ébauches SANS id ni prérequis :
   * l'appelant (SkillGenerationService) leur attribue un id, fixe `depth = frontière.depth + 1`,
   * `prerequisites = [frontière.id]`, puis les ingère (validation par clôture avant écriture).
   * C'est ce qui rend l'Atlas « sans fin » : le graphe s'étend quand un élève atteint son bord.
   */
  async generateNextSkills(
    profileId: string,
    frontier: {
      slug: string;
      title: string;
      description: string;
      depth: number;
      kind: string;
      discipline: string;
      rank?: number | null;
    },
    count = 2,
    passes = 1,
  ): Promise<GeneratedSkillDraft[]> {
    const { model, apiKey, billing } = await this.resolveModelAndKey(profileId);
    const n = Math.max(1, Math.min(count, 3));
    const P = Math.max(1, Math.min(passes, 3));
    const ref = `grow:${frontier.slug}`;
    let held = 0;
    if (billing === 'credits') {
      held = estimateCredits(model) * (P + 1); // P générations + vérification
      const ok = await this.credits.tryDebit(profileId, held, 'hold', ref);
      if (!ok) throw new BadRequestException("Crédits insuffisants pour étendre l'Atlas.");
    }

    try {
      const lm = resolveModel(model.provider, model.modelId, apiKey);
      const rankHint =
        typeof frontier.rank === 'number' ? ` (rang actuel ${frontier.rank}/10)` : '';
      const prompt =
        `Discipline : ${frontier.discipline}.\n` +
        `Compétence-frontière déjà maîtrisée (profondeur ${frontier.depth})${rankHint} :\n` +
        `- titre : ${frontier.title}\n` +
        `- description : ${frontier.description}\n\n` +
        `Génère ${n} compétence(s) qui la SUIVENT directement — une étape plus avancée, dans la même ` +
        `discipline. Chaque description (2-4 phrases) doit situer clairement le NIVEAU (ex. licence, ` +
        `master, doctorat, front de recherche) et ce qu'on sait faire. Fournis le rang ISCED (1→10), ` +
        `≥1 source réelle, et le statut épistémique. Ne répète pas la frontière.`;

      // Consensus multi-passes (pour les zones sensibles) : on génère P fois et on ne garde que les
      // compétences sur lesquelles les passes CONVERGENT — les nœuds « controversés » (vus une seule
      // fois) signalent un trou probable et sont écartés. On ne s'appuie jamais sur l'auto-correction nue.
      const passesDrafts: Array<z.infer<typeof nextSkillsSchema>['skills']> = [];
      let genPromptTok = 0;
      let genCompTok = 0;
      for (let i = 0; i < P; i++) {
        const gen = await generateObject({
          model: lm,
          schema: nextSkillsSchema,
          schemaName: 'CompetencesSuivantes',
          system: GRAPH_GROW_SYSTEM,
          prompt,
          temperature: 0.35,
        });
        passesDrafts.push(gen.object.skills);
        genPromptTok += gen.usage?.promptTokens ?? 0;
        genCompTok += gen.usage?.completionTokens ?? 0;
      }
      const consensus =
        P > 1 ? this.consensusDrafts(passesDrafts, Math.ceil(P / 2)) : passesDrafts[0]!;
      // Repli gracieux : si aucune convergence, on retombe sur la 1re passe (mieux vaut avancer que bloquer).
      const pooled = consensus.length > 0 ? consensus : passesDrafts[0]!;

      // Passe de vérification adversariale : ancrage / anti-hallucination.
      const verified = await this.verifyDrafts(lm, frontier, pooled);

      if (billing === 'credits') {
        const spent =
          creditsForUsage(model, genPromptTok, genCompTok) +
          creditsForUsage(model, verified.usage.promptTokens, verified.usage.completionTokens);
        await this.credits.reconcile(profileId, held, spent, ref);
      }
      return verified.kept.slice(0, n);
    } catch (err) {
      if (billing === 'credits' && held > 0)
        await this.credits.grant(profileId, held, 'refund', ref);
      throw err;
    }
  }

  /**
   * Consensus : regroupe les ébauches de plusieurs passes par proximité de titre (Jaccard sur mots
   * significatifs ≥ 0,5) et ne garde que les groupes convergents (support ≥ `minSupport`), en prenant
   * comme représentant l'ébauche la mieux sourcée. Les nœuds vus une seule fois sont écartés.
   */
  private consensusDrafts(
    passes: Array<z.infer<typeof nextSkillsSchema>['skills']>,
    minSupport: number,
  ): z.infer<typeof nextSkillsSchema>['skills'] {
    const all = passes.flat();
    const toks = (t: string) =>
      new Set(
        t
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .split(' ')
          .filter((w) => w.length > 3),
      );
    const used = new Array(all.length).fill(false);
    const kept: z.infer<typeof nextSkillsSchema>['skills'] = [];
    for (let i = 0; i < all.length; i++) {
      if (used[i]) continue;
      const members = [all[i]!];
      used[i] = true;
      const ti = toks(all[i]!.title);
      for (let j = i + 1; j < all.length; j++) {
        if (used[j]) continue;
        const tj = toks(all[j]!.title);
        const inter = [...ti].filter((x) => tj.has(x)).length;
        const uni = new Set([...ti, ...tj]).size;
        if (uni > 0 && inter / uni >= 0.5) {
          members.push(all[j]!);
          used[j] = true;
        }
      }
      if (members.length >= minSupport) {
        kept.push(members.slice().sort((a, b) => b.sources.length - a.sources.length)[0]!);
      }
    }
    return kept;
  }

  /**
   * **Voisinage amont** — génère une compétence-CIBLE issue d'un objectif libre, PLUS la courte chaîne
   * de prérequis qui la relie à une compétence d'ancrage déjà existante. Renvoie la chaîne ordonnée
   * (du plus proche de l'ancrage au plus profond = la cible). L'appelant fixe ids/profondeurs/arêtes
   * et ingère (clôture validée). C'est « je veux apprendre X » : on fabrique le chemin qui manque.
   */
  async generateTowardGoal(
    profileId: string,
    goal: string,
    anchors: Array<{ title: string; description: string; depth: number }>,
  ): Promise<GeneratedSkillDraft[]> {
    const { model, apiKey, billing } = await this.resolveModelAndKey(profileId);
    const ref = `goal:${goal.slice(0, 24)}`;
    let held = 0;
    if (billing === 'credits') {
      held = estimateCredits(model) * 2;
      const ok = await this.credits.tryDebit(profileId, held, 'hold', ref);
      if (!ok) throw new BadRequestException('Crédits insuffisants pour tracer ce chemin.');
    }
    try {
      const lm = resolveModel(model.provider, model.modelId, apiKey);
      const anchorList = anchors
        .slice(0, 8)
        .map((a) => `- ${a.title} (déjà acquis)`)
        .join('\n');
      const gen = await generateObject({
        model: lm,
        schema: nextSkillsSchema,
        schemaName: 'CheminVersObjectif',
        system: GRAPH_GROW_SYSTEM,
        prompt:
          `Objectif de l'élève : « ${goal} ».\n\n` +
          `Compétences déjà acquises servant d'ancrage :\n${anchorList || '- (bases générales)'}\n\n` +
          `Produis une COURTE chaîne ORDONNÉE (2-3 compétences) menant à l'objectif : la 1re s'appuie ` +
          `directement sur les acquis ci-dessus, chacune est prérequis de la suivante, la DERNIÈRE est ` +
          `l'objectif lui-même. Ordre = du plus élémentaire (index 0) au plus avancé (dernier). Pour ` +
          `chacune : rang ISCED, ≥1 source réelle, statut épistémique. Reste dans le consensus.`,
        temperature: 0.3,
      });
      const verified = await this.verifyDrafts(
        lm,
        { title: goal, description: `objectif : ${goal}`, discipline: 'Fondations' },
        gen.object.skills,
      );
      if (billing === 'credits') {
        const spent =
          creditsForUsage(model, gen.usage?.promptTokens ?? 0, gen.usage?.completionTokens ?? 0) +
          creditsForUsage(model, verified.usage.promptTokens, verified.usage.completionTokens);
        await this.credits.reconcile(profileId, held, spent, ref);
      }
      return verified.kept;
    } catch (err) {
      if (billing === 'credits' && held > 0)
        await this.credits.grant(profileId, held, 'refund', ref);
      throw err;
    }
  }

  /** Résout modèle + clé API (BYOK ou plateforme) pour un profil, avec garde-fou de facturation. */
  private async resolveModelAndKey(
    profileId: string,
  ): Promise<{ model: AiModel; apiKey: string; billing: string }> {
    const settings = await this.settingsRow(profileId);
    const billing = settings?.billing ?? 'credits';
    const model = await this.requireModel(settings?.modelId ?? DEFAULT_MODEL_ID);
    if (billing === 'byok') {
      if (!settings?.byokKeyEnc || !this.env.COPILOTE_SECRET_KEY) {
        throw new BadRequestException(
          "Configure ta clé dans « Mon Copilote » pour étendre l'Atlas.",
        );
      }
      return {
        model,
        apiKey: decryptSecret(settings.byokKeyEnc, this.env.COPILOTE_SECRET_KEY),
        billing,
      };
    }
    const key = platformKeyFor(model.provider, this.env);
    if (!key)
      throw new ServiceUnavailableException(
        "Extension de l'Atlas indisponible : aucune clé configurée.",
      );
    return { model, apiKey: key, billing };
  }

  /**
   * **GraphRAG vectoriel — backfill.** Embed les nœuds du graphe (titre + description) qui n'ont pas
   * encore de vecteur, par lots, et stocke sur `skills.embedding`. Utilise la config d'embedding du
   * profil (BYOK). Idempotent, reprend là où il s'est arrêté. À déclencher hors ligne / admin.
   */
  async embedGraphNodes(
    profileId: string,
    limit = 1000,
  ): Promise<{ embedded: number; remaining: number }> {
    const settings = await this.settingsRow(profileId);
    const cfg = await this.resolveEmbeddingConfig(settings);
    if (!cfg)
      throw new BadRequestException(
        "Configure un modèle + une clé d'embedding dans « Mon Copilote ».",
      );
    const rows = await this.db
      .select({
        id: skills.id,
        title: skills.title,
        description: skills.description,
        embedding: skills.embedding,
      })
      .from(skills);
    const todo = rows.filter((r) => !r.embedding || r.embedding.length === 0).slice(0, limit);
    if (todo.length === 0) return { embedded: 0, remaining: 0 };
    let embedded = 0;
    for (let i = 0; i < todo.length; i += 64) {
      const batch = todo.slice(i, i + 64);
      const vecs = await embedTexts(
        cfg,
        batch.map((r) => `${r.title}. ${r.description}`.slice(0, 1000)),
      );
      await Promise.all(
        batch.map((r, k) => {
          const v = vecs[k];
          if (!v) return Promise.resolve();
          embedded++;
          return this.db.update(skills).set({ embedding: v }).where(eq(skills.id, r.id));
        }),
      );
    }
    const remaining =
      rows.filter((r) => !r.embedding || r.embedding.length === 0).length - embedded;
    return { embedded, remaining: Math.max(0, remaining) };
  }

  /**
   * **GraphRAG vectoriel — récupération.** Compétences du graphe sémantiquement PROCHES d'une requête
   * (cosinus sur `skills.embedding`), en excluant `excludeIds`. Complète la récupération SYMBOLIQUE
   * (arêtes du DAG) par une récupération par le SENS (compétences voisines d'autres branches).
   * `[]` si aucun nœud n'est embarqué (dégradation gracieuse).
   */
  private async semanticRelatedSkills(
    query: string,
    excludeIds: Set<string>,
    cfg: EmbeddingConfig,
    k = 2,
    minScore = 0.35,
  ): Promise<string[]> {
    try {
      // KNN pgvector (migration 0068) — avant : full scan de `skills` + cosinus en JS à chaque compose
      // (toutes les lignes AVEC leurs real[] en mémoire ; audit perf 08-2026).
      const qv = (await embedTexts(cfg, [query.slice(0, 512)]))[0];
      if (!qv || qv.length !== 1024) return [];
      const lit = `[${qv.join(',')}]`;
      const rows = (await this.db.execute(sql`
        select id, title, 1 - (embedding_vec <=> ${lit}::vector) as score
        from skills
        where embedding_vec is not null
        order by embedding_vec <=> ${lit}::vector
        limit ${k + excludeIds.size + 2}
      `)) as unknown as { id: string; title: string; score: number }[];
      return rows
        .filter((r) => !excludeIds.has(r.id) && Number(r.score) >= minScore)
        .slice(0, k)
        .map((r) => r.title);
    } catch {
      return [];
    }
  }

  /** Vérifie des ébauches (réel ? sources plausibles ? statut ?) et ne garde que celles validées. */
  private async verifyDrafts(
    lm: ReturnType<typeof resolveModel>,
    context: { title: string; description: string; discipline?: string },
    drafts: z.infer<typeof nextSkillsSchema>['skills'],
  ): Promise<{
    kept: GeneratedSkillDraft[];
    usage: { promptTokens: number; completionTokens: number };
  }> {
    if (drafts.length === 0) return { kept: [], usage: { promptTokens: 0, completionTokens: 0 } };
    const listing = drafts
      .map(
        (s, i) =>
          `${i + 1}. [${s.slug}] ${s.title} — ${s.description}\n   sources: ${s.sources.join(' | ')}`,
      )
      .join('\n');
    let verdicts: z.infer<typeof verifySkillsSchema>['verdicts'] = [];
    let usage = { promptTokens: 0, completionTokens: 0 };
    let verifierDown = false;
    try {
      const res = await generateObject({
        model: lm,
        schema: verifySkillsSchema,
        schemaName: 'VerificationCompetences',
        system: GRAPH_VERIFY_SYSTEM,
        prompt:
          `Contexte : ${context.discipline ? `discipline ${context.discipline}, ` : ''}fait suite à « ${context.title} ».\n\n` +
          `Compétences à vérifier :\n${listing}`,
        temperature: 0,
      });
      verdicts = res.object.verdicts;
      usage = {
        promptTokens: res.usage?.promptTokens ?? 0,
        completionTokens: res.usage?.completionTokens ?? 0,
      };
    } catch (err) {
      // Vérificateur indisponible : PAS de fail-open silencieux (audit 08-2026). On garde les ébauches
      // mais en QUARANTAINE : statut `emergent` + sources retirées (affirmations non vérifiées), et on
      // journalise pour que l'indisponibilité soit visible.
      verifierDown = true;
      console.warn(
        '[copilote] vérification adversariale indisponible — ébauches mises en quarantaine :',
        err instanceof Error ? err.message : err,
      );
    }
    const bySlug = new Map(verdicts.map((v) => [v.slug, v]));
    const kept: GeneratedSkillDraft[] = [];
    for (const s of drafts) {
      const v = bySlug.get(s.slug);
      if (v && v.real === false) continue; // rejeté par la vérification
      kept.push({
        slug: s.slug,
        title: s.title,
        description: s.description,
        kind: s.kind,
        rank: s.rank,
        epistemicStatus: verifierDown ? 'emergent' : (v?.epistemicStatus ?? s.epistemicStatus),
        halfLifeYears: s.halfLifeYears ?? null,
        masteryThreshold: s.masteryThreshold ?? 0.95,
        // Ancrage : sources conservées seulement si le vérificateur a pu les juger plausibles.
        sources: verifierDown || (v && v.sourcesPlausibles === false) ? [] : s.sources,
      });
    }
    return { kept, usage };
  }

  // --- Composer le prompt du jour (déterministe, gratuit) ---

  /**
   * Portrait court de l'élève tiré de son dossier (objectif de fond + centres d'intérêt + résumé
   * pédagogique) pour personnaliser la séance. `null` si aucun dossier. Ne renvoie que ce que
   * l'élève a lui-même dit (funds of knowledge) — jamais d'inférence lourde.
   */
  private async learnerProfileLine(profileId: string): Promise<string | null> {
    const row = (
      await this.db.select().from(learnerDossiers).where(eq(learnerDossiers.profileId, profileId))
    )[0];
    if (!row) return null;
    const d = row.structured as Dossier;
    const parts: string[] = [];
    if (d.objectifPrincipal?.valeur) parts.push(`objectif de fond : ${d.objectifPrincipal.valeur}`);
    const interets = (d.interets ?? [])
      .map((i) => i.theme)
      .filter(Boolean)
      .slice(0, 5);
    if (interets.length > 0) parts.push(`centres d'intérêt : ${interets.join(', ')}`);
    if (d.resumePedagogique) parts.push(d.resumePedagogique.trim());
    const line = parts.join('. ').trim();
    return line.length > 0 ? line.slice(0, 600) : null;
  }

  /**
   * **Récupération sémantique (GraphRAG léger).** Retrouve les notes de carnet passées (d'AUTRES
   * compétences) sémantiquement proches du sujet du jour, par similarité cosinus sur embeddings.
   * Backfill paresseux des embeddings manquants. Best-effort : `[]` si pas de config ou en cas d'erreur.
   */
  private async semanticRelatedNotes(
    profileId: string,
    query: string,
    currentSkillId: string,
    cfg: EmbeddingConfig,
  ): Promise<string[]> {
    try {
      // Backfill paresseux BORNÉ (20 notes récentes max) des notes sans vecteur — le trigger 0068
      // remplit `embedding_vec` à l'écriture. Avant : TOUT le carnet chargé + embeddé à chaque compose.
      const missing = await this.db
        .select({ id: carnetEntries.id, note: carnetEntries.note })
        .from(carnetEntries)
        .where(and(eq(carnetEntries.profileId, profileId), isNull(carnetEntries.embedding)))
        .orderBy(desc(carnetEntries.createdAt))
        .limit(20);
      if (missing.length > 0) {
        const vecs = await embedTexts(
          cfg,
          missing.map((r) => r.note.slice(0, 512)),
        );
        await Promise.all(
          missing.map((r, i) => {
            const v = vecs[i];
            if (!v) return Promise.resolve();
            return this.db
              .update(carnetEntries)
              .set({ embedding: v })
              .where(eq(carnetEntries.id, r.id));
          }),
        );
      }

      // KNN pgvector (cosinus, index HNSW) au lieu du scan JS.
      const qv = (await embedTexts(cfg, [query.slice(0, 512)]))[0];
      if (!qv || qv.length !== 1024) return [];
      const lit = `[${qv.join(',')}]`;
      const rows = (await this.db.execute(sql`
        select note, 1 - (embedding_vec <=> ${lit}::vector) as score
        from carnet_entries
        where profile_id = ${profileId}
          and embedding_vec is not null
          and (skill_id is null or skill_id <> ${currentSkillId})
          and length(btrim(note)) > 0
        order by embedding_vec <=> ${lit}::vector
        limit 4
      `)) as unknown as { note: string; score: number }[];
      return rows
        .filter((r) => Number(r.score) >= 0.3)
        .slice(0, 2)
        .map((r) => r.note.trim().slice(0, 200));
    } catch {
      return [];
    }
  }

  async compose(profileId: string): Promise<{
    prompt: string;
    closingPrompt: string;
    skill: { id: string; slug: string; title: string } | null;
  }> {
    const next = await this.progression.nextPrescribed(profileId);
    if (!next) return { prompt: '', closingPrompt: '', skill: null };

    // Chemin le plus chaud de l'API : les blocs indépendants partent EN PARALLÈLE (audit perf 08-2026 —
    // avant : ~10 aller-retours DB en série, dont TOUT le carnet chargé pour trouver une note).
    const [mastery, skillRows, lastNote, activeMisc, dueAll, learnerProfile, settingsForEmb] =
      await Promise.all([
        this.progression.getMastery(profileId),
        this.db.select().from(skills).where(eq(skills.id, next.id)),
        // Reprise SCOPÉE : la dernière note du carnet POUR CETTE compétence (requête LIMIT 1).
        this.carnet.lastNoteFor(profileId, next.id),
        // Mémoire : erreurs/confusions récurrentes actives sur cette compétence (les plus fréquentes).
        this.db
          .select()
          .from(learnerMisconceptions)
          .where(
            and(
              eq(learnerMisconceptions.profileId, profileId),
              eq(learnerMisconceptions.skillId, next.id),
              eq(learnerMisconceptions.status, 'active'),
            ),
          )
          .orderBy(desc(learnerMisconceptions.occurrences)),
        // Mémoire : compétences déjà vues et dues à réviser aujourd'hui (FSRS), à intercaler.
        this.fsrs.due(profileId, new Date().toISOString()),
        // Dossier de l'élève : objectif de fond + centres d'intérêt → le tuteur ancre ses exemples.
        this.learnerProfileLine(profileId),
        this.settingsRow(profileId),
      ]);

    const m = mastery.find((x) => x.skillId === next.id);
    const pct = Math.round((m?.pMastery ?? 0) * 100);
    const masteredCount = mastery.filter((x) => x.pMastery >= MASTERY_THRESHOLD).length;

    // Contexte précis de la compétence (description + domaine) → l'IA enseigne le bon sujet.
    const skillRow = skillRows[0];
    const description = skillRow?.description ?? '';
    const domain = DOMAIN_LABELS[skillRow?.kind ?? ''] ?? skillRow?.kind ?? '';

    const misconceptions = activeMisc.slice(0, 4).map((x) => x.label);

    const dueIds = dueAll.filter((id) => id !== next.id).slice(0, 2);
    let reviews: string[] = [];
    if (dueIds.length > 0) {
      const rows = await this.db
        .select({ id: skills.id, title: skills.title })
        .from(skills)
        .where(inArray(skills.id, dueIds));
      const byId = new Map(rows.map((r) => [r.id, r.title]));
      reviews = dueIds.map((id) => byId.get(id)).filter((t): t is string => Boolean(t));
    }

    // Récupération sémantique (notes proches + GraphRAG vectoriel), en parallèle aussi.
    const embConfig = await this.resolveEmbeddingConfig(settingsForEmb);
    const [relatedNotes, relatedSkills] = embConfig
      ? await Promise.all([
          this.semanticRelatedNotes(profileId, `${next.title}. ${description}`, next.id, embConfig),
          this.semanticRelatedSkills(
            `${next.title}. ${description}`,
            new Set([next.id]),
            embConfig,
          ),
        ])
      : [[], []];

    const prompt = buildSessionPrompt({
      title: next.title,
      description,
      domain,
      pct,
      masteredCount,
      lastNote,
      misconceptions,
      reviews,
      learnerProfile,
      epistemicStatus: skillRow?.epistemicStatus,
      sources: skillRow?.sources ?? [],
      relatedNotes,
      relatedSkills,
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

    // Application D'ABORD, facturation ENSUITE (audit 08-2026 : un échec DB après la réconciliation
    // laissait l'élève débité sans aucune mise à jour pédagogique — et son retry re-débitait).
    // Dowze RECALCULE la maîtrise (BKT) — jamais un score du LLM.
    let mastery: MasteryState;
    try {
      const nowIso = new Date().toISOString();
      const correct = snapshot.outcome !== 'bloque';
      mastery = await this.progression.observe(input.profileId, input.skillId, correct, nowIso);
      await this.carnet.addEntry(input.profileId, snapshot.carnetNote, input.skillId);
      await this.fsrs.rate(
        input.profileId,
        input.skillId,
        outcomeToRating(snapshot.outcome),
        nowIso,
      );
      const embConfig = await this.resolveEmbeddingConfig(settings);
      await this.reconcileMisconceptions(
        input.profileId,
        input.skillId,
        snapshot.errors,
        snapshot.outcome,
        nowIso,
        embConfig,
      );
    } catch (applyErr) {
      // L'application pédagogique a échoué : on rembourse le pré-débit (la plateforme assume le coût LLM).
      if (billing === 'credits' && held > 0) {
        await this.credits
          .grant(input.profileId, held, 'refund', input.skillId)
          .catch(() => undefined);
      }
      throw applyErr;
    }
    await this.invalidateCourseCache(input.profileId, input.skillId); // maîtrise changée → feuille périmée

    // Réconciliation des crédits avec le coût réel (l'élève a bien reçu sa mise à jour).
    let creditsSpent = 0;
    if (billing === 'credits') {
      creditsSpent = creditsForUsage(model, inTok, outTok);
      await this.credits.reconcile(input.profileId, held, creditsSpent, input.skillId);
    }

    return { snapshot, pMastery: mastery.pMastery, creditsSpent };
  }

  /**
   * Applique une progression pédagogique SANS appel LLM ni crédits : quand une source DÉJÀ résumée
   * (ex. le pont IA / « Mémorialiste ») a identifié la compétence travaillée et le résultat, Dowze
   * RECALCULE la maîtrise (BKT), ajoute une entrée au carnet et planifie la révision (FSRS) — exactement
   * la logique d'application de `ingest`, mais sans ré-extraire de snapshot ni facturer.
   */
  async applyProgress(
    profileId: string,
    skillId: string,
    outcome: 'maitrise' | 'progres' | 'bloque',
    carnetNote: string,
  ): Promise<{ pMastery: number }> {
    const nowIso = new Date().toISOString();
    // Dowze RECALCULE la maîtrise (BKT) — jamais un score fourni par un LLM.
    const mastery = await this.progression.observe(
      profileId,
      skillId,
      outcome !== 'bloque',
      nowIso,
    );
    const note = (carnetNote || '').trim();
    if (note) await this.carnet.addEntry(profileId, note, skillId);
    await this.fsrs.rate(profileId, skillId, outcomeToRating(outcome), nowIso);
    await this.invalidateCourseCache(profileId, skillId); // la feuille en cache ne reflète plus la maîtrise
    return { pMastery: mastery.pMastery };
  }

  /**
   * Clôture IDEMPOTENTE d'un cours natif : UNE clôture par (profil, compétence, jour) — la table
   * `course_closures` (PK composite) absorbe le double-clic et le retry réseau, sinon chaque appel
   * refaisait une observation BKT + un `fsrs.rate` (maîtrise gonflée artificiellement — audit 08-2026).
   * Rejouée le même jour : renvoie la maîtrise actuelle sans ré-observer.
   */
  async closeCourse(
    profileId: string,
    skillId: string,
    outcome: 'maitrise' | 'progres' | 'bloque',
    note: string,
  ): Promise<{ pMastery: number; alreadyClosed?: boolean }> {
    const inserted = await this.db
      .insert(courseClosures)
      .values({ profileId, skillId, closureDate: localDateStr(), outcome })
      .onConflictDoNothing()
      .returning({ profileId: courseClosures.profileId });
    if (inserted.length === 0) {
      const m = (await this.progression.getMastery(profileId)).find((x) => x.skillId === skillId);
      return { pMastery: m?.pMastery ?? 0, alreadyClosed: true };
    }
    return this.applyProgress(profileId, skillId, outcome, note);
  }

  /**
   * `generateStructured` avec RETRY : les modèles non-stricts (ex. deepseek) échouent parfois à produire un
   * schéma imbriqué complexe (feuille de cours). On réessaie `tries` fois avant d'abandonner. Les crédits des
   * tentatives ratées sont déjà remboursés par `generateStructured`.
   */
  async generateStructuredRetry<T>(
    profileId: string,
    opts: {
      schema: ZodType<T>;
      schemaName: string;
      system: string;
      prompt: string;
      temperature?: number;
      ref?: string;
      modelId?: string;
    },
    tries = 3,
  ): Promise<{ object: T; creditsSpent: number }> {
    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await this.generateStructured<T>(profileId, opts);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  // --- Le COURS NATIF Dowze : l'IA de Dowze GÉNÈRE le cours (feuille A4 à modules), rendu EN APP. ---

  /**
   * Génère une « feuille A4 » de cours pour la compétence prescrite : l'IA de Dowze compose une séquence de
   * MODULES pédagogiques (fiche, exemple résolu, QCM à distracteurs=misconceptions, exercices…) ancrée sur
   * l'état de l'élève. Réutilise le contexte de `compose()` (compétence, maîtrise, misconceptions, FSRS,
   * dossier, GraphRAG) + `generateStructured` (LLM→objet Zod validé, crédits/BYOK, filet jsonrepair).
   * MVP mono-passe ; la variante orchestrée par l'École (runProject) viendra ensuite. `null` si tout maîtrisé.
   */
  async runCourse(profileId: string): Promise<{
    sheet: CourseSheet;
    skill: { id: string; slug: string; title: string };
    creditsSpent: number;
  } | null> {
    const ctx = await this.compose(profileId);
    if (!ctx.skill) return null; // rien de prescrit (tout maîtrisé) → pas de cours
    const title = ctx.skill.title;
    const cacheKey = CopiloteService.courseCacheKey(profileId, ctx.skill.id);

    // 0. CACHE (audit perf 08-2026) : rouvrir le cours du jour = 0 appel LLM, ~0 s au lieu de 15-20 s.
    //    Invalidé à la clôture / à l'ingestion (la maîtrise a changé → la feuille doit être recomposée).
    try {
      const hit = await this.cache.getJson<CourseSheet>(cacheKey);
      if (hit) return { sheet: courseSheetSchema.parse(hit), skill: ctx.skill, creditsSpent: 0 };
    } catch {
      /* Redis absent ou entrée invalide : on génère */
    }

    // 1. LE PROF compose la feuille. Le prompt de `compose` porte tout le contexte pédagogique (rédigé pour un
    //    tuteur) → on s'en sert comme BRIEF, on ignore ses consignes adressées à un tuteur.
    const gen = await this.generateStructuredRetry(profileId, {
      schema: courseSheetGenSchema,
      schemaName: 'CourseSheet',
      system: COURSE_SHEET_SYSTEM,
      prompt: `${ctx.prompt}\n\n---\nÀ partir de ce BRIEF (contexte de l'élève ci-dessus), compose la FEUILLE DE COURS JSON pour « ${title} ».`,
      temperature: 0.4,
      ref: 'cours',
    });

    // Re-valide la feuille complète (avec le skillId de l'app) → type CourseSheet garanti.
    const sheet: CourseSheet = courseSheetSchema.parse({ ...gen.object, skillId: ctx.skill.id });

    // 2. On SERT immédiatement (déjà validée Zod) ; l'ÉVALUATEUR contrôle EN ARRIÈRE-PLAN et remplace la
    //    version en cache s'il corrige (QA hors chemin critique : −40-60 % de latence perçue ; la revue
    //    reste le maillon anti-dévaluation, appliquée à la version servie ensuite).
    try {
      await this.cache.setJson(cacheKey, sheet, 24 * 3600);
    } catch {
      /* sans Redis, pas de cache ni de QA différée : comportement dégradé acceptable */
    }
    void this.qaCourseInBackground(
      profileId,
      cacheKey,
      ctx.skill.id,
      title,
      ctx.prompt,
      gen.object,
    ).catch(() => undefined);

    return { sheet, skill: ctx.skill, creditsSpent: gen.creditsSpent };
  }

  static courseCacheKey(profileId: string, skillId: string): string {
    return `course:${profileId}:${skillId}`;
  }

  /** Invalide la feuille en cache pour (profil, compétence) — la maîtrise vient de changer. */
  private async invalidateCourseCache(profileId: string, skillId: string): Promise<void> {
    try {
      await this.cache.del(CopiloteService.courseCacheKey(profileId, skillId));
    } catch {
      /* Redis absent : rien à invalider */
    }
  }

  /**
   * Passe QA de l'Évaluateur, HORS chemin critique : contrôle la feuille (sujet, exactitude, QCM bien
   * corrigés), et en cas de problèmes régénère UNE fois (correction bornée) puis remplace la version en
   * cache. Feuille trop grosse pour une revue fiable → on saute (pas de troncature en plein JSON, qui
   * produisait de faux « à corriger » — audit 08-2026).
   */
  private async qaCourseInBackground(
    profileId: string,
    cacheKey: string,
    skillId: string,
    title: string,
    briefPrompt: string,
    object: unknown,
  ): Promise<void> {
    const json = JSON.stringify(object);
    if (json.length > 20000) return;
    const review = await this.generateStructured(profileId, {
      schema: courseReviewSchema,
      schemaName: 'CourseReview',
      system: COURSE_REVIEW_SYSTEM,
      prompt: `Compétence : « ${title} ».\nFeuille à contrôler (JSON) :\n${json}`,
      temperature: 0.1,
      ref: 'cours-qa',
    });
    const issues = review.object.issues ?? [];
    if (review.object.ok || issues.length === 0) return;
    const fix = await this.generateStructured(profileId, {
      schema: courseSheetGenSchema,
      schemaName: 'CourseSheet',
      system: COURSE_SHEET_SYSTEM,
      prompt: `${briefPrompt}\n\n---\nUn CONTRÔLE QUALITÉ a relevé sur la feuille précédente : ${issues.join(' ; ')}.\nRegénère la FEUILLE DE COURS JSON pour « ${title} » en CORRIGEANT ces points (garde ce qui allait).`,
      temperature: 0.3,
      ref: 'cours-fix',
    });
    const corrected: CourseSheet = courseSheetSchema.parse({ ...fix.object, skillId });
    await this.cache.setJson(cacheKey, corrected, 24 * 3600);
  }

  /**
   * Générateur structuré GÉNÉRIQUE (texte → objet Zod) réutilisable par toutes les
   * features IA de Dowze (dossier élève, placement, exercices, tests, expéditions).
   * Réutilise la résolution modèle/clé (BYOK ou plateforme), la facturation à crédits
   * (hold → réconcilie), `generateObject` + le filet `jsonrepair→Zod` pour les modèles
   * non-stricts. Ne touche jamais à la logique pédagogique — c'est un pur appel LLM.
   */
  async generateStructured<T>(
    profileId: string,
    opts: {
      schema: ZodType<T>;
      schemaName: string;
      system: string;
      prompt: string;
      temperature?: number;
      ref?: string;
      modelId?: string;
    },
  ): Promise<{ object: T; creditsSpent: number }> {
    const settings = await this.settingsRow(profileId);
    const modelId = opts.modelId ?? settings?.modelId ?? DEFAULT_MODEL_ID;
    const model = await this.requireModel(modelId);
    const billing = settings?.billing ?? 'credits';
    const ref = opts.ref ?? opts.schemaName;

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
      const ok = await this.credits.tryDebit(profileId, held, 'hold', ref);
      if (!ok) {
        throw new HttpException(
          'Crédits insuffisants. Recharge ton solde ou passe en BYOK.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    let object: T;
    let inTok = 0;
    let outTok = 0;
    try {
      const lm = resolveModel(model.provider, model.modelId, apiKey);
      const result = await generateObject({
        model: lm,
        schema: opts.schema,
        schemaName: opts.schemaName,
        system: opts.system,
        prompt: opts.prompt,
        temperature: opts.temperature ?? 0.2,
      });
      object = result.object;
      inTok = result.usage?.promptTokens ?? 0;
      outTok = result.usage?.completionTokens ?? 0;
    } catch {
      try {
        const lm = resolveModel(model.provider, model.modelId, apiKey);
        const txt = await generateText({
          model: lm,
          system: `${opts.system} Réponds UNIQUEMENT par un objet JSON conforme, sans texte autour.`,
          prompt: opts.prompt,
          temperature: opts.temperature ?? 0.2,
        });
        inTok = txt.usage?.promptTokens ?? 0;
        outTok = txt.usage?.completionTokens ?? 0;
        const repaired = jsonrepair(extractJsonBlock(txt.text));
        object = opts.schema.parse(JSON.parse(repaired));
      } catch {
        if (billing === 'credits' && held > 0) {
          await this.credits.grant(profileId, held, 'refund', ref);
        }
        throw new ServiceUnavailableException(
          "Le Copilote n'a pas réussi à produire une réponse exploitable. Réessaie, ou choisis un modèle plus fiable dans les réglages.",
        );
      }
    }

    let creditsSpent = 0;
    if (billing === 'credits') {
      creditsSpent = creditsForUsage(model, inTok, outTok);
      await this.credits.reconcile(profileId, held, creditsSpent, ref);
    }
    return { object, creditsSpent };
  }

  /**
   * **Boucle agentique (ReAct) GÉNÉRIQUE.** Frère de `generateStructured`, mais en tool-calling
   * multi-étapes : le modèle peut appeler des outils (`opts.tools`), lire leurs résultats, puis
   * poursuivre — jusqu'à `maxSteps` allers-retours — avant de rédiger sa réponse finale. Réutilise
   * la résolution modèle/clé (BYOK ou plateforme) et la facturation à crédits (hold → réconcilie).
   * Renvoie le texte final + la liste des outils réellement appelés (pour la trace/caption).
   */
  async runWithTools(
    profileId: string,
    opts: {
      system: string;
      prompt: string;
      tools: ToolSet;
      maxSteps?: number;
      temperature?: number;
      ref?: string;
      modelId?: string;
    },
  ): Promise<{ text: string; toolsUsed: string[]; creditsSpent: number }> {
    const settings = await this.settingsRow(profileId);
    const modelId = opts.modelId ?? settings?.modelId ?? DEFAULT_MODEL_ID;
    const model = await this.requireModel(modelId);
    const billing = settings?.billing ?? 'credits';
    const ref = opts.ref ?? 'agent-tools';
    const maxSteps = Math.max(1, Math.min(opts.maxSteps ?? 4, 6));

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
      // La boucle peut faire plusieurs allers-retours : on retient de quoi couvrir maxSteps, on réconcilie au réel.
      held = estimateCredits(model) * maxSteps;
      const ok = await this.credits.tryDebit(profileId, held, 'hold', ref);
      if (!ok) {
        throw new HttpException(
          'Crédits insuffisants. Recharge ton solde ou passe en BYOK.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    try {
      const lm = resolveModel(model.provider, model.modelId, apiKey);
      const result = await generateText({
        model: lm,
        system: opts.system,
        prompt: opts.prompt,
        tools: opts.tools,
        maxSteps,
        temperature: opts.temperature ?? 0.7,
        // Filet anti-blocage : un fournisseur IA qui ne répond pas ne fige pas la requête (ni les crédits en hold).
        abortSignal: AbortSignal.timeout(90_000),
      });
      const inTok = result.usage?.promptTokens ?? 0;
      const outTok = result.usage?.completionTokens ?? 0;
      let creditsSpent = 0;
      if (billing === 'credits') {
        creditsSpent = creditsForUsage(model, inTok, outTok);
        await this.credits.reconcile(profileId, held, creditsSpent, ref);
      }
      const toolsUsed = [
        ...new Set(result.steps.flatMap((s) => s.toolCalls.map((tc) => tc.toolName))),
      ];
      return { text: (result.text || '').trim(), toolsUsed, creditsSpent };
    } catch (err) {
      if (billing === 'credits' && held > 0)
        await this.credits.grant(profileId, held, 'refund', ref);
      throw err;
    }
  }

  /**
   * Recherche sémantique PUBLIQUE dans le graphe de connaissances (Atlas) : renvoie les compétences
   * (titre + description) sémantiquement PROCHES d'une requête, via les embeddings déjà stockés sur
   * `skills.embedding` et la config d'embedding du profil. `[]` si aucun embedding configuré / indexé
   * (dégradation gracieuse). Sert l'outil `chercher_connaissances` des abeilles-agents.
   */
  async searchKnowledge(
    profileId: string,
    query: string,
    k = 5,
  ): Promise<{ title: string; description: string }[]> {
    const cfg = await this.resolveEmbeddingConfig(await this.settingsRow(profileId));
    if (!cfg) return [];
    try {
      const rows = await this.db
        .select({
          title: skills.title,
          description: skills.description,
          embedding: skills.embedding,
        })
        .from(skills);
      const withEmb = rows.filter(
        (r): r is typeof r & { embedding: number[] } =>
          Array.isArray(r.embedding) && r.embedding.length > 0,
      );
      if (withEmb.length === 0) return [];
      const qv = (await embedTexts(cfg, [query.slice(0, 512)]))[0];
      if (!qv) return [];
      return withEmb
        .map((r) => ({
          title: r.title,
          description: r.description,
          score: cosine(qv, r.embedding),
        }))
        .filter((x) => x.score >= 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.min(k, 8)))
        .map((x) => ({ title: x.title, description: (x.description || '').slice(0, 300) }));
    } catch {
      return [];
    }
  }

  /** Résout la config d'embedding de l'élève (modèle + clé déchiffrée), ou null si non activée. */
  /**
   * Embeddings pour un profil (réutilise sa config « Mon Copilote » : modèle + clé). Renvoie un vecteur
   * par texte (même ordre), ou `null` si aucun embedding n'est configuré / en cas d'échec (dégradation gracieuse).
   */
  async embed(profileId: string, texts: string[]): Promise<number[][] | null> {
    if (texts.length === 0) return [];
    const cfg = await this.resolveEmbeddingConfig(await this.settingsRow(profileId));
    if (!cfg) return null;
    try {
      return await embedTexts(cfg, texts);
    } catch {
      return null;
    }
  }

  private async resolveEmbeddingConfig(row: SettingsRow | null): Promise<EmbeddingConfig | null> {
    if (!row?.embeddingModelId || !row.embeddingKeyEnc || !this.env.COPILOTE_SECRET_KEY)
      return null;
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
