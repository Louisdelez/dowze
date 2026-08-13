import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, gt, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Database } from '../db/drizzle.module';
import {
  accounts,
  profiles,
  companionPets,
  companionAgents,
  companionSpaces,
  companionSpaceKnowledge,
  companionSpaceKnowledgeChunks,
  companionMessages,
  companionRelayTokens,
  companionAgentMerges,
  hiveRuntimes,
  hiveSpacePackages,
  hiveSpaceInstallations,
  learnerRank,
  masteryStates,
  specializations,
  skills,
} from '../db/schema';
import { disciplineOf, DISCIPLINES } from '../results/ranks';
import { CopiloteService } from '../copilote/copilote.service';
import { buildAgentTools } from './agent-tools';
import {
  ORG_TEMPLATES,
  templateByKey,
  roleByKey,
  academieAdmin,
  academieTeacher,
  teacherRoleKey,
  rankMeta,
  roleContractOf,
  type RolePreset,
  type OrgTemplate,
} from './roles.catalog';
import { HiveContinuityService } from './hive-continuity.service';
import {
  canHandleRequest,
  selectCompanionForRequest,
  selectHiveRuntime,
  selectComputeResource,
  findOrganizationalRoute,
  renderForChannel,
  shouldDelegate,
  type HiveRuntime,
  type HiveComputeResource,
  type RoleContract,
} from './hive-domain';

/** Planche max après validation (une sprite sheet Codex ~1,5–2,5 Mo). */
const MAX_BYTES = 6 * 1024 * 1024;
/** Fichier uploadé max (le .zip peut être un peu plus gros que la planche seule). */
const MAX_UPLOAD = 12 * 1024 * 1024;
/** Nombre max de pets sauvegardés par compte. */
const MAX_PETS = 50;
// Ruche « infinie » : AUCUNE limite dure sur le nombre d'abeilles (compagnons) ni d'open-spaces (spécialisations).
// La création reste bornée par requête (≤ 3 abeilles/orchestration, création manuelle à l'unité) ; à grande échelle,
// la reine ne liste PAS toutes les abeilles mais en récupère une short-list pertinente (voir `orchestrate`).
/** Hôte qui sert les planches de pets (assets académie). */
const PET_HOST = 'https://academie.dowze.ch';
/** Skin ROBOT (« Nono ») : skin par défaut UNIVERSEL des abeilles d'open-space, et fallback partout. */
const ROBOT_SKIN_SLUG = 'super-nono-v2';
const ROBOT_SKIN_URL = `${PET_HOST}/pets/${ROBOT_SKIN_SLUG}.webp`;

/** Capacité d'une salle « espace de travail » d'un open-space : au-delà, un nouveau workspace est créé. */
const WORKSPACE_CAP = 100;
/** Dimension des embeddings de la ruche (Jina v3 = 1024) → colonne pgvector `embedding_vec`. */
const HIVE_EMBED_DIM = 1024;

export interface RagChunk {
  content: string;
  startOffset: number;
  endOffset: number;
}

/** Découpage stable avec chevauchement : privilégie paragraphes/phrases sans perdre les offsets source. */
export function chunkKnowledgeDocument(content: string, size = 1400, overlap = 240): RagChunk[] {
  const source = content.replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const chunks: RagChunk[] = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(source.length, start + size);
    if (end < source.length) {
      const window = source.slice(start + Math.floor(size * 0.55), end);
      const cuts = [window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n')];
      const cut = Math.max(...cuts);
      if (cut >= 0) end = start + Math.floor(size * 0.55) + cut + (window[cut] === '.' ? 1 : 0);
    }
    const raw = source.slice(start, end);
    const leftTrim = raw.length - raw.trimStart().length;
    const rightTrim = raw.length - raw.trimEnd().length;
    const chunkStart = start + leftTrim;
    const chunkEnd = end - rightTrim;
    if (chunkEnd > chunkStart)
      chunks.push({
        content: source.slice(chunkStart, chunkEnd),
        startOffset: chunkStart,
        endOffset: chunkEnd,
      });
    if (end >= source.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

/** Persona PNJ d'un compagnon (pilote les répliques scriptées ; base du mode agent plus tard). */
export interface AgentPersonality {
  tone?: string;
  traits?: string[];
  description?: string;
  emoji?: string;
  greeting?: string;
  /** Règles apprises par l'utilisateur (le compagnon les respecte). */
  rules?: string[];
}
interface HiveExecutionContext {
  runId: string;
  parentTaskId: string;
  depth: number;
  visitedAgentIds: string[];
  rootEventId?: string;
}
/** Détecte un message d'ENSEIGNEMENT (« retiens que… », « dorénavant… », « je préfère que… »). */
const TEACH_RE =
  /\b(retiens|rappelle[- ]toi|souviens[- ]toi|dor[eé]navant|d[eé]sormais|à l['’]avenir|je pr[eé]f[eè]re que|à partir de maintenant|note que|n['’]oublie pas que)\b/i;
export interface CompanionAgentDTO {
  id: string;
  name: string;
  skinUrl: string | null;
  size: number;
  personality: AgentPersonality | null;
  role: string | null;
  roleContract: RoleContract;
  space: string;
  room: string;
  pos: { c: number; r: number } | null;
  isPrimary: boolean;
  mode: string;
  useCount: number;
  lastUsedAt: number | null;
  quality: number | null;
  protected: boolean;
  promptVersions: number;
}
export interface CreateAgentInput {
  name: string;
  skinUrl?: string | null;
  size?: number;
  personality?: AgentPersonality | null;
  role?: string | null;
  roleContract?: RoleContract;
  space?: string;
  room?: string;
  pos?: { c: number; r: number } | null;
  mode?: 'pnj' | 'agent';
}
export type UpdateAgentInput = Partial<CreateAgentInput>;

export interface UploadedPetFile {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}

/** Type d'image d'après les octets magiques (jamais d'après l'extension ou le mimetype déclaré). */
function detectImage(buf: Buffer): 'image/webp' | 'image/png' | null {
  if (buf.length < 16) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  uncompSize: number;
  local: number;
}

/** Liste les entrées d'un .zip via le central directory (zlib natif, zéro dép). */
function zipEntries(zip: Buffer): ZipEntry[] {
  let eocd = -1;
  const min = Math.max(0, zip.length - 22 - 65536);
  for (let i = zip.length - 22; i >= min; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new BadRequestException('Archive .zip invalide.');

  const total = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < total && p + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) break;
    const method = zip.readUInt16LE(p + 10);
    const compSize = zip.readUInt32LE(p + 20);
    const uncompSize = zip.readUInt32LE(p + 24);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({ name, method, compSize, uncompSize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** Décompresse une entrée .zip (stored ou deflate). Anti zip-bomb via maxOutputLength. */
function inflateEntry(zip: Buffer, e: ZipEntry): Buffer {
  const lh = e.local;
  if (lh + 30 > zip.length || zip.readUInt32LE(lh) !== 0x04034b50)
    throw new BadRequestException('Archive .zip invalide.');
  const lNameLen = zip.readUInt16LE(lh + 26);
  const lExtraLen = zip.readUInt16LE(lh + 28);
  const start = lh + 30 + lNameLen + lExtraLen;
  const comp = zip.subarray(start, start + e.compSize);
  if (e.method === 0) return Buffer.from(comp);
  if (e.method === 8) return inflateRawSync(comp, { maxOutputLength: MAX_BYTES });
  throw new BadRequestException('Compression .zip non supportée.');
}

/** Extrait la planche d'un .zip (petdex, codex-pets.net…). */
function extractSheet(zip: Buffer): Buffer {
  const entries = zipEntries(zip);
  const pick =
    entries.find((e) => /(^|\/)spritesheet\.webp$/i.test(e.name)) ||
    entries.find((e) => /\.webp$/i.test(e.name)) ||
    entries.find((e) => /\.png$/i.test(e.name));
  if (!pick) throw new BadRequestException('Aucune planche (.webp) trouvée dans le .zip.');
  if (pick.uncompSize > MAX_BYTES) throw new BadRequestException('Planche trop lourde.');
  return inflateEntry(zip, pick);
}

/** Nom du pet depuis pet.json du .zip (displayName), sinon null. Best-effort. */
function nameFromZip(zip: Buffer): string | null {
  try {
    const entries = zipEntries(zip);
    const pj = entries.find((e) => /(^|\/)pet\.json$/i.test(e.name));
    if (!pj || pj.uncompSize > 100_000) return null;
    const json = JSON.parse(inflateEntry(zip, pj).toString('utf8')) as Record<string, unknown>;
    const raw = json.displayName ?? json.name ?? json.id;
    return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 60) : null;
  } catch {
    return null;
  }
}

function cleanName(name: string | null | undefined, fallback: string): string {
  const n = (name ?? '').trim().slice(0, 60);
  return n || fallback;
}

export interface PetListItem {
  id: string;
  name: string;
  version: number;
  createdAt: string;
}

/** Schéma de config d'agent produit par l'IA à partir d'une courte description. */
const AGENT_CONFIG_SCHEMA = z.object({
  name: z.string().describe('Un prénom/nom court et sympathique pour le compagnon.'),
  greeting: z.string().describe('Un message d’accueil TRÈS court (une phrase), à sa façon.'),
  tone: z.string().describe('Son ton en quelques mots (ex : « joyeux et encourageant »).'),
  traits: z.array(z.string()).describe('3 à 6 traits de caractère en un mot chacun.'),
  specialization: z.string().describe('Sa spécialité / ce dans quoi il aide (court).'),
  capabilities: z.array(z.string()).describe('3 à 10 capacités précises et légitimes.'),
  limitations: z
    .array(z.string())
    .describe('1 à 5 domaines qu’il doit déléguer au lieu d’improviser.'),
  systemPrompt: z
    .string()
    .describe(
      'Le « personnage » : 3–6 phrases décrivant sa personnalité, son rôle et son style (court, naturel, sans markdown). C’est ce qui pilotera ses réponses.',
    ),
});
type AgentConfig = z.infer<typeof AGENT_CONFIG_SCHEMA>;

/** Configuration locale minimale quand le générateur IA est indisponible ou invalide. */
export function fallbackAgentConfig(description: string): AgentConfig {
  const specialization =
    description.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Assistance ciblée';
  const meaningful = specialization
    .replace(/^(recherche et |expert(?:e)? en |sp[eé]cialiste (?:en|de|du|des) )/i, '')
    .trim();
  const firstWord = meaningful.match(/[\p{L}\p{N}]+/u)?.[0] || 'Expert';
  const name = `${firstWord.charAt(0).toUpperCase()}${firstWord.slice(1)} Expert`.slice(0, 40);
  return {
    name,
    greeting: `Je m'occupe de ${specialization.toLowerCase()}.`.slice(0, 200),
    tone: 'précis, factuel et concis',
    traits: ['rigoureux', 'fiable', 'méthodique'],
    specialization,
    capabilities: [specialization, 'Recherche documentaire', 'Vérification avec citations'],
    limitations: ['Demander validation lorsque les sources sont insuffisantes'],
    systemPrompt: `Tu es un spécialiste de ${specialization}. Tu travailles avec rigueur, utilises les sources disponibles et cites exactement les documents mobilisés. Tu signales clairement toute information manquante.`,
  };
}
/** Plan d'orchestration : pour chaque sous-tâche, mobiliser une abeille EXISTANTE ou en CRÉER une précise. */
const ORCH_PLAN_SCHEMA = z.object({
  direct: z
    .string()
    .describe(
      'Si tu peux répondre TOI-MÊME correctement sans spécialiste : la réponse directe courte. Sinon, chaîne vide.',
    ),
  delegations: z
    .array(
      z.object({
        existing: z
          .number()
          .int()
          .describe(
            'NUMÉRO d’une abeille EXISTANTE qui correspond PRÉCISÉMENT à la sous-tâche (voir la liste). Mets 0 si aucune ne convient vraiment et qu’il faut en créer une.',
          ),
        create: z
          .string()
          .describe(
            'Si existing = 0 : description PRÉCISE et ÉTROITE de l’abeille spécialiste à créer pour cette sous-tâche (son domaine exact, une phrase). Sinon, chaîne vide.',
          ),
        spaceName: z
          .string()
          .describe(
            'Si existing = 0 : le nom de l’OPEN-SPACE métier où ranger la nouvelle abeille selon sa compétence (ex : « Code & Dev », « Cours & École », « Langues », « Rédaction », « Business & Admin », « Vie quotidienne », « Santé & Sport », « Créativité »). Réutilise EXACTEMENT le nom d’un open-space existant s’il correspond ; sinon un nom court. JAMAIS « Maison ». Sinon, chaîne vide.',
          ),
        subtask: z.string().describe('La sous-tâche / question précise confiée à cette abeille.'),
        expectedGain: z
          .number()
          .min(0)
          .max(1)
          .describe('Gain attendu de spécialisation/parallélisation.'),
        communicationCost: z
          .number()
          .min(0)
          .max(1)
          .describe('Coût de transmettre et résumer le contexte.'),
        computeCost: z
          .number()
          .min(0)
          .max(1)
          .describe('Coût relatif de calcul de cette délégation.'),
        coordinationCost: z
          .number()
          .min(0)
          .max(1)
          .describe('Coût de vérifier et fusionner le résultat.'),
      }),
    )
    .describe(
      '0 à 3 délégations. Décompose la demande en sous-tâches précises ; pour chacune, réutilise une abeille existante si elle correspond VRAIMENT, sinon demande d’en créer une très ciblée (rangée dans son open-space métier).',
    ),
});
// Orchestration SCOPÉE à un open-space = organisation : le leader délègue à l'effectif FIXE
// du space (par numéro de membre — aucune création, l'équipe est déjà en place).
const SPACE_PLAN_SCHEMA = z.object({
  direct: z
    .string()
    .describe(
      'Si TU (le leader) peux répondre correctement toi-même sans mobiliser un membre : la réponse directe courte. Sinon, chaîne vide.',
    ),
  delegations: z
    .array(
      z.object({
        member: z
          .number()
          .int()
          .describe(
            'NUMÉRO du membre de l’équipe (voir la liste) à qui confier cette sous-tâche — celui dont c’est EXACTEMENT la spécialité/matière.',
          ),
        subtask: z.string().describe('La sous-tâche / question précise confiée à ce membre.'),
      }),
    )
    .describe(
      '0 à 3 délégations. Décompose la demande et confie chaque sous-tâche au membre dont c’est le métier. Ne délègue qu’aux membres réellement pertinents.',
    ),
});
// P4 — CHANTIER (SOP) : un objectif est découpé en tâches confiées aux membres, chacun PRODUIT un livrable.
const PROJECT_PLAN_SCHEMA = z.object({
  tasks: z
    .array(
      z.object({
        member: z
          .number()
          .int()
          .describe(
            'NUMÉRO du membre (voir la liste) chargé de cette partie du projet — celui dont c’est la spécialité.',
          ),
        task: z.string().describe('La partie du projet confiée à ce membre.'),
        produces: z
          .string()
          .describe(
            'Le LIVRABLE concret attendu (ex. « cahier des charges », « plan de cours », « maquette décrite », « plan de test »).',
          ),
      }),
    )
    .describe('2 à 5 tâches confiées aux bons membres pour réaliser le projet de bout en bout.'),
});
const BUILD_AGENT_SYSTEM = `Tu conçois un « compagnon » (assistant-personnage) à partir d'une courte description donnée par l'utilisateur.
Le compagnon peut aider dans N'IMPORTE QUEL domaine (études, travail, code, projets, business, vie quotidienne, administratif, créativité, sport, santé, voyage, etc.) — il n'est PAS limité à l'éducation.
À partir de cette description, tu génères une configuration complète, cohérente et optimisée : un nom, un message d'accueil court, un ton, 3 à 6 traits, une spécialisation, et un SYSTEM PROMPT.
Contraintes : le compagnon est bienveillant et respectueux, parle FRANÇAIS, adapte son niveau et son vocabulaire à son interlocuteur, et répond toujours de façon COURTE et HUMAINE (pas de markdown, pas de listes, une à deux phrases). Le systemPrompt doit décrire sa personnalité, son rôle/spécialité et son style, et lui rappeler de rester dans son personnage et de répondre court. Reste fidèle à la description de l'utilisateur.`;

@Injectable()
export class CompanionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly copilote: CopiloteService,
    private readonly continuity: HiveContinuityService,
  ) {}

  private async profileIdForAuth(authId: string): Promise<string> {
    const acc = (await this.db.select().from(accounts).where(eq(accounts.authUserId, authId)))[0];
    if (!acc) throw new BadRequestException('Compte introuvable.');
    // `orderBy` : sans lui, l'ordre Postgres est non déterministe → le « 1er profil » pouvait changer
    // d'un appel à l'autre (audit 08-2026).
    const prof = (
      await this.db
        .select()
        .from(profiles)
        .where(eq(profiles.accountId, acc.id))
        .orderBy(asc(profiles.createdAt))
    )[0];
    if (!prof) throw new BadRequestException('Profil introuvable.');
    return prof.id;
  }

  /**
   * Le PROFIL ÉLÈVE du compte : celui qui porte le `learner_rank` (le parcours Académie peut vivre sur un
   * AUTRE profil que le 1er — même logique que `ensureServiceOrg`). Repli : le 1er profil du compte.
   * À utiliser pour tout ce qui touche la PROGRESSION (pont IA : compose/applyProgress), sinon la maîtrise
   * est écrite sur le mauvais profil (audit 08-2026).
   */
  private async studentProfileIdForAuth(authId: string): Promise<string> {
    const fallback = await this.profileIdForAuth(authId);
    const acc = (await this.db.select().from(accounts).where(eq(accounts.authUserId, authId)))[0];
    if (!acc) return fallback;
    const rankRow = (
      await this.db
        .select({ studentId: learnerRank.profileId })
        .from(learnerRank)
        .innerJoin(profiles, eq(profiles.id, learnerRank.profileId))
        .where(eq(profiles.accountId, acc.id))
        .orderBy(desc(learnerRank.rank))
        .limit(1)
    )[0];
    return rankRow?.studentId ?? fallback;
  }

  /** Ajoute un pet à la bibliothèque depuis un fichier (.zip / .webp / .png). */
  async install(
    authId: string,
    file: UploadedPetFile | undefined,
  ): Promise<{ id: string; name: string; version: number }> {
    if (!file?.buffer?.length) throw new BadRequestException('Aucun fichier.');
    const b = file.buffer;
    if (b.length > MAX_UPLOAD) throw new BadRequestException('Fichier trop lourd.');

    const isZip = b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
    const raw = isZip ? extractSheet(b) : b;

    const mime = detectImage(raw);
    if (!mime)
      throw new BadRequestException(
        "Ce n'est pas un .zip de pet ni une planche d'image (.webp/.png) valide.",
      );
    if (raw.length > MAX_BYTES) throw new BadRequestException('Planche trop lourde.');

    const fallback = (file.originalname || '').replace(/\.[^.]+$/, '').slice(0, 60) || 'Mon pet';
    const name = isZip ? cleanName(nameFromZip(b), fallback) : cleanName(fallback, 'Mon pet');

    const profileId = await this.profileIdForAuth(authId);
    const existing = (
      await this.db
        .select({ n: count() })
        .from(companionPets)
        .where(eq(companionPets.profileId, profileId))
    )[0];
    if ((existing?.n ?? 0) >= MAX_PETS) {
      throw new BadRequestException(
        `Limite atteinte (${MAX_PETS} pets). Supprime-en un avant d'en ajouter.`,
      );
    }

    const now = new Date();
    const row = (
      await this.db
        .insert(companionPets)
        .values({ profileId, name, mime, bytes: raw, createdAt: now, updatedAt: now })
        .returning({ id: companionPets.id })
    )[0];
    if (!row) throw new BadRequestException('Enregistrement impossible.');
    return { id: row.id, name, version: now.getTime() };
  }

  /** Bibliothèque du profil (métadonnées uniquement, pas les octets). */
  async list(authId: string): Promise<PetListItem[]> {
    const profileId = await this.profileIdForAuth(authId);
    const rows = await this.db
      .select({
        id: companionPets.id,
        name: companionPets.name,
        createdAt: companionPets.createdAt,
        updatedAt: companionPets.updatedAt,
      })
      .from(companionPets)
      .where(eq(companionPets.profileId, profileId))
      .orderBy(desc(companionPets.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? 'Mon pet',
      version: r.updatedAt.getTime(),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Renomme un pet (l'utilisateur doit en être propriétaire). */
  async rename(authId: string, id: string, name: string): Promise<{ id: string; name: string }> {
    const profileId = await this.profileIdForAuth(authId);
    const clean = cleanName(name, 'Mon pet');
    const res = await this.db
      .update(companionPets)
      .set({ name: clean, updatedAt: new Date() })
      .where(and(eq(companionPets.id, id), eq(companionPets.profileId, profileId)))
      .returning({ id: companionPets.id });
    if (!res[0]) throw new NotFoundException('Pet introuvable.');
    return { id, name: clean };
  }

  /** Supprime un pet (l'utilisateur doit en être propriétaire). */
  async remove(authId: string, id: string): Promise<{ ok: true }> {
    const profileId = await this.profileIdForAuth(authId);
    await this.db
      .delete(companionPets)
      .where(and(eq(companionPets.id, id), eq(companionPets.profileId, profileId)));
    return { ok: true };
  }

  /** Sert la planche stockée (endpoint public, image uniquement). */
  async serve(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
    const row = (await this.db.select().from(companionPets).where(eq(companionPets.id, id)))[0];
    if (!row) return null;
    return { mime: row.mime, bytes: row.bytes as Buffer };
  }

  // ---------- Compagnons-agents (« famille » + open-spaces) ----------

  private toAgent(r: typeof companionAgents.$inferSelect): CompanionAgentDTO {
    // On NE renvoie PAS le systemPrompt au client (interne).
    const p = (r.personality as (AgentPersonality & { systemPrompt?: string }) | null) ?? null;
    const personality: AgentPersonality | null = p
      ? {
          tone: p.tone,
          traits: p.traits,
          description: p.description,
          emoji: p.emoji,
          greeting: p.greeting,
          rules: p.rules,
        }
      : null;
    return {
      id: r.id,
      name: r.name,
      skinUrl: r.skinUrl,
      size: r.size,
      personality,
      role: r.role,
      roleContract: (r.roleContract as RoleContract | null) ?? {},
      space: r.space,
      room: r.room,
      pos: (r.pos as { c: number; r: number } | null) ?? null,
      isPrimary: r.isPrimary,
      mode: r.mode,
      useCount: r.useCount,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.getTime() : null,
      quality: r.qualityEma,
      protected: r.protected,
      promptVersions: Array.isArray((p as { promptHistory?: unknown[] } | null)?.promptHistory)
        ? (p as { promptHistory: unknown[] }).promptHistory.length
        : 0,
    };
  }

  /** S'assure que le compagnon PRINCIPAL existe (semé depuis `profiles.companion` la 1re fois). */
  private async ensurePrimary(profileId: string): Promise<void> {
    const primary = (
      await this.db
        .select({ id: companionAgents.id })
        .from(companionAgents)
        .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.isPrimary, true)))
    )[0];
    if (primary) return;
    const prof = (
      await this.db
        .select({ companion: profiles.companion })
        .from(profiles)
        .where(eq(profiles.id, profileId))
    )[0];
    const comp = (prof?.companion ?? {}) as { url?: string; size?: number; name?: string };
    await this.db
      .insert(companionAgents)
      .values({
        profileId,
        name: (comp.name || 'Dowze').slice(0, 40),
        skinUrl: comp.url ?? null,
        size: typeof comp.size === 'number' ? comp.size : 96,
        isPrimary: true,
        space: 'home',
        mode: 'pnj',
      })
      .onConflictDoNothing();
  }

  /** Liste les compagnons d'un espace (défaut : la Maison). Sème le principal au besoin. */
  async listAgents(authId: string, space = 'home'): Promise<CompanionAgentDTO[]> {
    const profileId = await this.profileIdForAuth(authId);
    await this.ensurePrimary(profileId);
    const rows = await this.db
      .select()
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          eq(companionAgents.space, space.slice(0, 60)),
          eq(companionAgents.status, 'active'),
        ),
      )
      .orderBy(desc(companionAgents.isPrimary), asc(companionAgents.createdAt));
    return rows.map((r) => this.toAgent(r));
  }

  /** Crée un compagnon (mode PNJ par défaut). */
  async createAgent(authId: string, input: CreateAgentInput): Promise<CompanionAgentDTO> {
    const profileId = await this.profileIdForAuth(authId);
    const now = new Date();
    const row = (
      await this.db
        .insert(companionAgents)
        .values({
          profileId,
          name: (input.name || 'Compagnon').slice(0, 40),
          skinUrl: this.skinForSpace(input.space || 'home', input.skinUrl),
          size: input.size ?? 96,
          personality: input.personality ?? null,
          role: input.role ?? null,
          roleContract: input.roleContract ?? {},
          space: (input.space || 'home').slice(0, 60),
          room:
            input.room?.slice(0, 60) ||
            (await this.pickRoomFor(profileId, (input.space || 'home').slice(0, 60))),
          pos: input.pos ?? null,
          isPrimary: false,
          mode: input.mode ?? 'pnj',
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];
    if (!row) throw new BadRequestException('Création impossible.');
    return this.toAgent(row);
  }

  /** Met à jour un compagnon (propriétaire requis ; le statut « principal » n'est pas modifiable ici). */
  async updateAgent(
    authId: string,
    id: string,
    patch: UpdateAgentInput,
  ): Promise<CompanionAgentDTO> {
    const profileId = await this.profileIdForAuth(authId);
    const set: Partial<typeof companionAgents.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = String(patch.name).slice(0, 40);
    if (patch.skinUrl !== undefined) set.skinUrl = patch.skinUrl;
    if (patch.size !== undefined) set.size = patch.size;
    if (patch.personality !== undefined) set.personality = patch.personality;
    if (patch.role !== undefined) set.role = patch.role;
    if (patch.roleContract !== undefined) set.roleContract = patch.roleContract;
    if (patch.space !== undefined) set.space = patch.space.slice(0, 60);
    if (patch.pos !== undefined) set.pos = patch.pos;
    if (patch.mode !== undefined) set.mode = patch.mode;
    const res = await this.db
      .update(companionAgents)
      .set(set)
      .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
      .returning();
    if (!res[0]) throw new NotFoundException('Compagnon introuvable.');
    return this.toAgent(res[0]);
  }

  /** Supprime un compagnon (le principal est protégé). */
  async deleteAgent(authId: string, id: string): Promise<{ ok: true }> {
    const profileId = await this.profileIdForAuth(authId);
    const row = (
      await this.db
        .select({ isPrimary: companionAgents.isPrimary })
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
    )[0];
    if (!row) throw new NotFoundException('Compagnon introuvable.');
    if (row.isPrimary)
      throw new BadRequestException('Le compagnon principal ne peut pas être supprimé.');
    await this.db
      .delete(companionAgents)
      .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)));
    return { ok: true };
  }

  /**
   * Fabrique une abeille (compagnon-agent) très précise depuis une courte description (IA) et l'enregistre.
   * Cœur réutilisé par l'auto-builder ET par la ruche (création d'abeille à la volée). `skinUrl` absent → skin par défaut varié.
   */
  /**
   * Skin d'un compagnon selon son espace. Règle produit : les abeilles des OPEN-SPACES portent TOUTES le
   * skin ROBOT par défaut ; les compagnons de la MAISON gardent le skin choisi (sinon ROBOT). Jamais vide.
   */
  private skinForSpace(space: string | undefined, chosen?: string | null): string {
    if ((space || 'home') !== 'home') return ROBOT_SKIN_URL;
    return chosen && chosen.trim() ? chosen : ROBOT_SKIN_URL;
  }

  /**
   * Salle d'accueil d'un nouveau compagnon selon son espace. Maison → sa propre chambre (`chambre`).
   * Open-space → premier « espace de travail » ayant < 100 places, sinon un nouveau (`travail:0`, `travail:1`…).
   */
  private async pickRoomFor(profileId: string, space: string): Promise<string> {
    if (space === 'home') return 'chambre';
    const rows = (await this.db.execute(sql`
      select room, count(*)::int as n from companion_agents
      where profile_id = ${profileId} and space = ${space} and status = 'active' and room like 'travail:%'
      group by room
    `)) as unknown as { room: string; n: number }[];
    const counts = new Map(rows.map((r) => [r.room, Number(r.n)]));
    for (let idx = 0; ; idx++) {
      if ((counts.get(`travail:${idx}`) ?? 0) < WORKSPACE_CAP) return `travail:${idx}`;
    }
  }

  private async createAgentFromDescription(
    profileId: string,
    description: string,
    space = 'home',
    skinUrl?: string | null,
    deterministic = false,
  ): Promise<typeof companionAgents.$inferSelect> {
    // Aucune limite de nombre : la ruche peut grandir sans plafond.
    const object = deterministic
      ? fallbackAgentConfig(description)
      : await this.copilote
          .generateStructured(profileId, {
            schema: AGENT_CONFIG_SCHEMA,
            schemaName: 'CompanionAgentConfig',
            system: BUILD_AGENT_SYSTEM,
            prompt: description.slice(0, 500),
            temperature: 0.7,
          })
          .then((result) => result.object)
          .catch(() => fallbackAgentConfig(description));
    const personality: AgentPersonality & { systemPrompt?: string; greeting?: string } = {
      tone: object.tone?.slice(0, 80),
      traits: (object.traits ?? []).slice(0, 8).map((t) => t.slice(0, 40)),
      description: object.specialization?.slice(0, 300),
      systemPrompt: object.systemPrompt?.slice(0, 4000),
      greeting: object.greeting?.slice(0, 200),
    };
    // Skin : open-space = ROBOT pour toutes les abeilles ; Maison = skin choisi, sinon ROBOT. Jamais vide.
    const finalSkin = this.skinForSpace(space, skinUrl);
    // Salle : open-space → workspace <100 places (déborde) ; Maison → chambre.
    const room = await this.pickRoomFor(profileId, space);
    const now = new Date();
    const row = (
      await this.db
        .insert(companionAgents)
        .values({
          profileId,
          name: (object.name || 'Assistant').slice(0, 40),
          skinUrl: finalSkin,
          size: 96,
          personality,
          role: object.specialization?.slice(0, 60) ?? null,
          roleContract: {
            responsibilities: [`Aider dans sa spécialité : ${object.specialization.slice(0, 120)}`],
            capabilities: (object.capabilities ?? [])
              .slice(0, 10)
              .map((value) => value.slice(0, 120)),
            limitations: (object.limitations ?? []).slice(0, 5).map((value) => value.slice(0, 120)),
            delegatesTo: [],
            escalationPath: ['primary'],
            allowedTools: ['calculatrice', 'date_heure', 'chercher_connaissances', 'recherche_web'],
          },
          space: space.slice(0, 60),
          room,
          isPrimary: false,
          mode: 'agent',
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];
    if (!row) throw new BadRequestException('Création impossible.');
    // Embedding sémantique (best-effort) → l'abeille devient trouvable par le SENS.
    await this.embedAgent(profileId, row.id, row.name, row.role, personality.description);
    return row;
  }

  /**
   * Trouve-ou-crée un OPEN-SPACE métier par son nom (jamais la Maison). Sert au rangement automatique
   * des abeilles créées par la ruche selon leur compétence. Renvoie l'id de l'open-space.
   */
  private async ensureSpaceByName(profileId: string, name: string): Promise<string> {
    const nm = (name || '').trim().slice(0, 40) || 'Ruche';
    const rows = await this.db
      .select({ id: companionSpaces.id, name: companionSpaces.name })
      .from(companionSpaces)
      .where(eq(companionSpaces.profileId, profileId));
    const hit = rows.find((s) => s.name.toLowerCase() === nm.toLowerCase());
    if (hit) return hit.id;
    // Aucune limite d'open-spaces (spécialisations) : on en crée un nouveau à chaque nouveau domaine.
    // Anti-race (index unique (profile_id, lower(name)), migration 0067) : deux requêtes simultanées ne
    // dupliquent plus l'espace — le perdant du conflit re-lit celui du gagnant.
    const created = (
      await this.db
        .insert(companionSpaces)
        .values({ profileId, name: nm })
        .onConflictDoNothing()
        .returning()
    )[0];
    if (created) return created.id;
    const again = (
      await this.db
        .select({ id: companionSpaces.id, name: companionSpaces.name })
        .from(companionSpaces)
        .where(eq(companionSpaces.profileId, profileId))
    ).find((s) => s.name.toLowerCase() === nm.toLowerCase());
    if (!again) throw new BadRequestException('Création d’open-space impossible.');
    return again.id;
  }

  /** Auto-builder : construit un compagnon-AGENT depuis une courte description (IA), et l'enregistre. */
  async buildAgent(
    authId: string,
    input: { description: string; skinUrl?: string | null; space?: string },
  ): Promise<CompanionAgentDTO> {
    const profileId = await this.profileIdForAuth(authId);
    const row = await this.createAgentFromDescription(
      profileId,
      input.description,
      input.space || 'home',
      input.skinUrl ?? null,
    );
    return this.toAgent(row);
  }

  /** Chat IA avec un compagnon-agent : mémoire persistante + apprentissage de règles, réponse courte et humaine. */
  async chatAgent(
    authId: string,
    id: string,
    message: string,
    execution?: HiveExecutionContext,
  ): Promise<{
    reply: string;
    learned?: string;
    toolsUsed?: string[];
    creditsSpent?: number;
    routedTo?: { id: string; name: string };
  }> {
    const profileId = await this.profileIdForAuth(authId);
    const agent = (
      await this.db
        .select()
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
    )[0];
    if (!agent) throw new NotFoundException('Compagnon introuvable.');
    const relationship = await this.continuity
      .touchRelationshipForProfile(profileId, agent.id)
      .catch(() => undefined);
    const storedContract = (agent.roleContract as RoleContract | null) ?? {};
    const preset = roleByKey(agent.roleKey);
    const personaForContract = (agent.personality as AgentPersonality | null) ?? {};
    const contract: RoleContract =
      storedContract.capabilities?.length || storedContract.responsibilities?.length
        ? storedContract
        : preset
          ? roleContractOf(preset)
          : {
              responsibilities: agent.role ? [`Assumer le rôle : ${agent.role}`] : [],
              capabilities: [agent.role ?? '', ...(personaForContract.traits ?? [])].filter(
                Boolean,
              ),
              limitations: agent.role ? [`Travail sans rapport avec ${agent.role}`] : [],
              delegatesTo: [],
              escalationPath: ['primary'],
              allowedTools: [
                'calculatrice',
                'date_heure',
                'chercher_connaissances',
                'recherche_web',
              ],
            };
    if (agent.mode === 'agent' && contract.capabilities?.length && contract !== storedContract) {
      await this.db
        .update(companionAgents)
        .set({ roleContract: contract, updatedAt: new Date() })
        .where(eq(companionAgents.id, agent.id))
        .catch(() => undefined);
    }
    const scoped = Boolean(contract.capabilities?.length || contract.responsibilities?.length);
    if (agent.mode === 'agent' && scoped && !canHandleRequest(message, contract)) {
      const candidates = await this.db
        .select({
          id: companionAgents.id,
          name: companionAgents.name,
          roleKey: companionAgents.roleKey,
          roleContract: companionAgents.roleContract,
        })
        .from(companionAgents)
        .where(
          and(
            eq(companionAgents.profileId, profileId),
            eq(companionAgents.mode, 'agent'),
            eq(companionAgents.status, 'active'),
            ne(companionAgents.id, id),
          ),
        )
        .limit(200);
      const target = selectCompanionForRequest(
        message,
        candidates
          .filter((candidate) => !execution?.visitedAgentIds.includes(candidate.id))
          .map((candidate) => ({
            id: candidate.id,
            roleKey: candidate.roleKey,
            contract: (candidate.roleContract as RoleContract | null) ?? {},
          })),
      );
      if (target) {
        const targetRow = candidates.find((candidate) => candidate.id === target.id)!;
        if (execution) {
          const delegated = await this.delegateFromAgent(
            authId,
            profileId,
            agent,
            message,
            execution,
          );
          return {
            reply: delegated.result,
            routedTo: { id: target.id, name: targetRow.name },
          };
        }
        const route = findOrganizationalRoute(id, target.id, [
          { id, roleKey: agent.roleKey, contract },
          ...candidates.map((candidate) => ({
            id: candidate.id,
            roleKey: candidate.roleKey,
            contract: (candidate.roleContract as RoleContract | null) ?? {},
          })),
        ]);
        const names = new Map([
          [id, agent.name],
          ...candidates.map((candidate) => [candidate.id, candidate.name] as const),
        ]);
        const handoffs = [];
        for (let index = 0; index < route.length - 1; index += 1) {
          const fromId = route[index]!;
          const toId = route[index + 1]!;
          handoffs.push(
            await this.continuity.createHandoff(authId, {
              fromAgentId: fromId,
              toAgentId: toId,
              targetSpace: agent.space,
              originalRequest: message,
              summarizedContext: `${names.get(fromId) ?? 'Un compagnon'} transmet la demande et tout son contexte à ${names.get(toId) ?? 'la bonne personne'}.`,
              expectedNextAction:
                toId === target.id
                  ? 'Répondre à la demande avec le contexte transmis.'
                  : 'Poursuivre le passage vers le responsable compétent.',
            }),
          );
        }
        const routed = await this.chatAgent(authId, target.id, message, execution);
        await Promise.all(
          handoffs.map((handoff) =>
            this.continuity.transitionHandoff(authId, handoff.id, 'completed'),
          ),
        );
        return { ...routed, routedTo: { id: target.id, name: targetRow.name } };
      }
    }
    const persona =
      (agent.personality as (AgentPersonality & { systemPrompt?: string }) | null) ?? {};

    // Apprentissage : si l'utilisateur ENSEIGNE quelque chose, on le retient comme règle durable.
    let rules = Array.isArray(persona.rules) ? persona.rules.slice(0, 30) : [];
    let learned: string | undefined;
    if (TEACH_RE.test(message) && message.trim().length <= 300) {
      const rule = message.trim().slice(0, 240);
      if (!rules.some((r) => r.toLowerCase() === rule.toLowerCase())) {
        rules = [...rules, rule].slice(-20);
        learned = rule;
        await this.db
          .update(companionAgents)
          .set({ personality: { ...persona, rules }, updatedAt: new Date() })
          .where(eq(companionAgents.id, id));
      }
    }

    // Historique persistant (les 12 derniers messages) = la mémoire du compagnon.
    const past = await this.db
      .select({ sender: companionMessages.sender, text: companionMessages.text })
      .from(companionMessages)
      .where(eq(companionMessages.agentId, id))
      .orderBy(desc(companionMessages.createdAt))
      .limit(12);
    const hist = past
      .reverse()
      .map((m) => `${m.sender === 'me' ? 'Utilisateur' : agent.name} : ${m.text.slice(0, 300)}`)
      .join('\n');

    const rulesBlock = rules.length
      ? `\n\nRÈGLES APPRISES (l'utilisateur t'a enseigné ceci — respecte-les scrupuleusement) :\n${rules.map((r) => `- ${r}`).join('\n')}`
      : '';
    const relationshipBlock = relationship
      ? `\n\nRELATION : familiarité ${Math.round(relationship.familiarity * 100)} %, confiance ${Math.round(relationship.trust * 100)} %, affinité ${Math.round(relationship.affinity * 100)} %. Adapte seulement la chaleur, la proximité et la formulation à cette relation. Ne change jamais les faits, ne simule pas une intimité supérieure à ces valeurs et ne mentionne pas ces scores.`
      : '';
    const ragHits =
      agent.space && agent.space !== 'home'
        ? await this.searchSpaceKnowledge(profileId, agent.space, message, 4).catch(() => [])
        : [];
    const ragBlock = ragHits.length
      ? `\n\nCONTEXTE RAG DE L'ORGANISATION (prioritaire sur ta mémoire générale) :\n${ragHits
          .map((hit) => `[${hit.citation}] ${hit.content}`)
          .join(
            '\n',
          )}\nUtilise les faits utiles sans ajouter de citation brute, de lien ou de texte entre crochets dans la réponse parlée.`
      : '';
    const sys = `${persona.systemPrompt || `Tu es ${agent.name}, un compagnon bienveillant et polyvalent qui aide l'utilisateur dans ce qu'il demande, quel que soit le domaine.`}${rulesBlock}${relationshipBlock}${ragBlock}\n\nOUTILS : tu disposes d'outils de calcul, recherche, mémoire et d'envoi vers les applications virtuelles. Quand l'utilisateur demande d'envoyer, transférer ou mettre un contenu dans Mail ou Messages, appelle obligatoirement \`envoyer_dans_application\` avec le contenu utile déjà rédigé dans le format du canal. « Envoie-moi ça » signifie le déposer dans sa propre application virtuelle Dowze. Ne prétends jamais que tu ne peux pas envoyer. Tu DOIS appeler \`recherche_web\` avant toute question portant sur l'actualité ou un fait dont tu n'es pas certain. Utilise la calculatrice pour tout calcul.\n\nRÈGLES ABSOLUES DE DIALOGUE VOCAL : ta réponse sera affichée dans une bulle et prononcée exactement telle quelle. Écris donc exclusivement comme une personne qui parle naturellement à voix haute, en français. Fais des phrases courtes et fluides. N'utilise jamais de Markdown, liste, titre, emoji, émoticône, symbole décoratif, tableau, code, URL, adresse électronique, citation brute entre crochets ou notation destinée seulement à être vue. Écris les abréviations, unités, quantités, dates, heures, nombres et signes sous une forme naturelle à prononcer dans leur contexte. Réponds normalement en une ou deux phrases. Si le fond exige davantage, produis un texte oral continu que l'interface pourra découper. Reste dans ton personnage.`;
    const prompt = `${hist ? hist + '\n' : ''}Utilisateur : ${message.slice(0, 1000)}\n${agent.name} :`;

    // Boucle agentique (ReAct) : l'abeille peut mobiliser des outils sûrs (calcul, date, connaissances)
    // avant de répondre. Repli gracieux vers la génération structurée si le modèle ne gère pas les
    // outils, ou finit sur un appel d'outil sans texte final.
    let reply: string;
    let toolsUsed: string[] = [];
    let creditsSpent = 0;
    try {
      // Agent d'une ORGANISATION (open-space) → il peut consulter la base de connaissances de SON space.
      const orgSearch =
        agent.space && agent.space !== 'home'
          ? (query: string) => this.searchSpaceKnowledge(profileId, agent.space, query)
          : undefined;
      const out = await this.copilote.runWithTools(profileId, {
        system: sys,
        prompt,
        tools: buildAgentTools({
          copilote: this.copilote,
          profileId,
          sendToApp: async ({ canal, contenu, objet }) => {
            const event = (
              await this.continuity.recordForProfile(profileId, [{
                kind: 'application.message.sent',
                content: contenu,
                channel: canal,
                actorAgentId: agent.id,
                importance: 0.7,
                metadata: { subject: objet ?? null, recipient: 'me' },
              }])
            )[0];
            if (!event) throw new Error('Création du message impossible');
            const delivery = await this.continuity.createDelivery(authId, {
              eventId: event.id,
              companionId: agent.id,
              channel: canal,
              companionName: agent.name,
            });
            return { envoye: true as const, canal, contenu: delivery?.renderedContent ?? contenu };
          },
          orgSearch,
          memorySearch: (query) =>
            this.continuity.searchMemoryForProfile(profileId, query, 8, agent.space),
          delegate: execution
            ? (objective) => this.delegateFromAgent(authId, profileId, agent, objective, execution)
            : undefined,
        }),
        maxSteps: 4,
        temperature: 0.7,
        ref: `agent:${id}`,
      });
      reply = (out.text || '').slice(0, 600);
      toolsUsed = out.toolsUsed;
      creditsSpent = out.creditsSpent;
      if (!reply) throw new Error('empty-final'); // finit sur un outil sans rédiger → repli
    } catch {
      const generated = await this.copilote.generateStructured(profileId, {
        schema: z.object({
          reply: z
            .string()
            .describe('La réponse du compagnon, en une à deux phrases, sans markdown.'),
        }),
        schemaName: 'CompanionReply',
        system: sys,
        prompt,
        temperature: 0.8,
      });
      reply = (generated.object.reply || '…').slice(0, 600);
      toolsUsed = [];
      creditsSpent = generated.creditsSpent;
    }

    // Persistance de l'échange (mémoire).
    const now = new Date();
    await this.db.insert(companionMessages).values([
      { profileId, agentId: id, sender: 'me', text: message.slice(0, 1000), createdAt: now },
      {
        profileId,
        agentId: id,
        sender: 'agent',
        text: reply,
        createdAt: new Date(now.getTime() + 1),
      },
    ]);
    // La conversation locale reste utile à l'UI, mais la continuité réelle vit dans le journal universel.
    const journaled = await this.continuity
      .recordForProfile(profileId, [
        {
          kind: 'message.received',
          content: message.slice(0, 1000),
          channel: 'direct',
          subjectAgentId: id,
          space: agent.space,
          importance: learned ? 0.9 : 0.55,
          metadata: learned ? { learnedRule: learned } : {},
        },
        {
          kind: 'message.sent',
          content: reply,
          channel: 'direct',
          actorAgentId: id,
          space: agent.space,
          importance: 0.55,
          metadata: toolsUsed.length ? { toolsUsed } : {},
        },
      ])
      .catch(() => []);
    if (journaled[1])
      await this.continuity
        .createDelivery(authId, {
          eventId: journaled[1].id,
          companionId: id,
          channel: 'direct',
          companionName: agent.name,
        })
        .catch(() => undefined);
    if (learned) {
      const preference = /\b(je pr[eé]f[eè]re que|dor[eé]navant|d[eé]sormais)\b/i.test(learned);
      const stableKey = preference
        ? `agent:${id}:communication-preference`
        : `agent:${id}:rule:${createHash('sha256').update(learned.toLowerCase().replace(/\s+/g, ' ').slice(0, 120)).digest('hex').slice(0, 20)}`;
      await this.continuity
        .rememberTemporal(authId, {
          memoryKey: stableKey,
          content: learned,
          category: preference ? 'preference' : 'rule',
          scope: 'agent',
          scopeId: id,
          confidence: 0.95,
          validFrom: now,
          entities: [{ kind: 'agent', id, name: agent.name }],
          sourceEventIds: journaled[0] ? [journaled[0].id] : [],
        })
        .catch(() => undefined);
    }
    // Efficacité : compte l'usage (chaque mobilisation OU chat direct passe ici).
    await this.db
      .update(companionAgents)
      .set({ useCount: sql`${companionAgents.useCount} + 1`, lastUsedAt: now })
      .where(eq(companionAgents.id, id))
      .catch(() => undefined);
    return {
      reply,
      learned,
      toolsUsed: toolsUsed.length ? toolsUsed : undefined,
      creditsSpent,
    };
  }

  private async delegateFromAgent(
    authId: string,
    profileId: string,
    source: typeof companionAgents.$inferSelect,
    objective: string,
    execution: HiveExecutionContext,
  ): Promise<{ target: string; result: string; route: string[] }> {
    const candidates = await this.db
      .select({
        id: companionAgents.id,
        name: companionAgents.name,
        roleKey: companionAgents.roleKey,
        roleContract: companionAgents.roleContract,
      })
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          eq(companionAgents.mode, 'agent'),
          eq(companionAgents.status, 'active'),
          ne(companionAgents.id, source.id),
        ),
      )
      .limit(200);
    const available = candidates.filter(
      (candidate) => !execution.visitedAgentIds.includes(candidate.id),
    );
    const target = selectCompanionForRequest(
      objective,
      available.map((candidate) => ({
        id: candidate.id,
        roleKey: candidate.roleKey,
        contract: (candidate.roleContract as RoleContract | null) ?? {},
      })),
    );
    if (!target)
      throw new BadRequestException('Aucune abeille légitime disponible pour cette sous-tâche.');
    const targetRow = available.find((candidate) => candidate.id === target.id)!;
    const sourceContract = (source.roleContract as RoleContract | null) ?? {};
    const route = findOrganizationalRoute(source.id, target.id, [
      { id: source.id, roleKey: source.roleKey, contract: sourceContract },
      ...available.map((candidate) => ({
        id: candidate.id,
        roleKey: candidate.roleKey,
        contract: (candidate.roleContract as RoleContract | null) ?? {},
      })),
    ]);
    const handoff = await this.continuity.createHandoff(authId, {
      fromAgentId: source.id,
      toAgentId: target.id,
      targetSpace: targetRow.roleKey ?? undefined,
      originalRequest: objective,
      summarizedContext: `Sous-délégation de ${source.name} dans le run ${execution.runId}.`,
      sourceEventIds: execution.rootEventId ? [execution.rootEventId] : [],
      expectedNextAction: objective,
    });
    const task = await this.continuity.createRunTaskForProfile(profileId, {
      runId: execution.runId,
      parentTaskId: execution.parentTaskId,
      handoffId: handoff.id,
      assignedAgentId: target.id,
      depth: execution.depth + 1,
      objective,
      context: { delegatedBy: source.id, route },
      sourceEventIds: execution.rootEventId ? [execution.rootEventId] : [],
    });
    await this.continuity.transitionHandoff(authId, handoff.id, 'accepted');
    await this.continuity.transitionHandoff(authId, handoff.id, 'in_progress');
    await this.continuity.transitionRunTaskForProfile(profileId, task.id, 'running');
    try {
      const response = await this.chatAgent(authId, target.id, objective, {
        ...execution,
        parentTaskId: task.id,
        depth: execution.depth + 1,
        visitedAgentIds: [...execution.visitedAgentIds, target.id],
      });
      await this.continuity
        .chargeRunForProfile(profileId, execution.runId, response.creditsSpent ?? 0)
        .catch(() => undefined);
      await this.continuity.transitionHandoff(authId, handoff.id, 'completed');
      await this.continuity.transitionRunTaskForProfile(
        profileId,
        task.id,
        'completed',
        response.reply,
      );
      return { target: targetRow.name, result: response.reply, route };
    } catch (error) {
      await this.continuity.transitionHandoff(authId, handoff.id, 'failed').catch(() => undefined);
      await this.continuity
        .transitionRunTaskForProfile(
          profileId,
          task.id,
          'failed',
          undefined,
          error instanceof Error ? error.message : 'Échec de sous-délégation',
        )
        .catch(() => undefined);
      throw error;
    }
  }

  /**
   * PRODUCTION (chantier) : un agent RÉALISE un livrable complet dans SA spécialité — contrairement à
   * `chatAgent` (réponse courte façon WhatsApp), ici on veut un livrable structuré et concret, jamais un
   * refus. Persona + outils + RAG de l'org conservés ; pas de persistance en mémoire (c'est du travail).
   */
  private async agentProduce(
    profileId: string,
    agent: typeof companionAgents.$inferSelect,
    instruction: string,
  ): Promise<{ text: string; toolsUsed: string[] }> {
    const persona =
      (agent.personality as (AgentPersonality & { systemPrompt?: string }) | null) ?? {};
    const ragHits =
      agent.space && agent.space !== 'home'
        ? await this.searchSpaceKnowledge(profileId, agent.space, instruction, 6).catch(() => [])
        : [];
    const ragBlock = ragHits.length
      ? `\n\nSOURCES RAG À UTILISER :\n${ragHits
          .map((hit) => `[${hit.citation}] ${hit.content}`)
          .join(
            '\n',
          )}\nToute affirmation provenant de ces sources doit porter la citation correspondante entre crochets.`
      : '';
    const sys = `${persona.systemPrompt || `Tu es ${agent.name}, spécialiste dans ton domaine.`}${ragBlock}\n\nTu travailles au sein de ton organisation et tu dois PRODUIRE un livrable de travail. RÈGLES : réalise concrètement ce qui t'est demandé, dans TA spécialité — ne refuse JAMAIS et ne réponds pas de façon méta (« je vois que tu veux… ») : produis directement le contenu. Livrable clair, complet et directement utilisable (plusieurs phrases ou courts paragraphes). Si un point sort de ta spécialité, concentre-toi sur ta part. Français.`;
    const orgSearch =
      agent.space && agent.space !== 'home'
        ? (query: string) => this.searchSpaceKnowledge(profileId, agent.space, query)
        : undefined;
    try {
      const out = await this.copilote.runWithTools(profileId, {
        system: sys,
        prompt: instruction.slice(0, 1200),
        tools: buildAgentTools({
          copilote: this.copilote,
          profileId,
          orgSearch,
          memorySearch: (query) =>
            this.continuity.searchMemoryForProfile(profileId, query, 8, agent.space),
        }),
        maxSteps: 4,
        temperature: 0.6,
        ref: `produce:${agent.id}`,
      });
      const text = (out.text || '').slice(0, 1400);
      if (text) return { text, toolsUsed: out.toolsUsed };
      throw new Error('empty');
    } catch {
      const { object } = await this.copilote.generateStructured(profileId, {
        schema: z.object({ deliverable: z.string() }),
        schemaName: 'AgentDeliverable',
        system: sys,
        prompt: instruction.slice(0, 1200),
        temperature: 0.6,
      });
      return { text: (object.deliverable || '').slice(0, 1400), toolsUsed: [] };
    }
  }

  /**
   * Orchestration « ruche ». Un LEADER (le principal OU n'importe quel compagnon de la Maison — ils ont un
   * statut supérieur) décompose la demande, **trouve la bonne abeille des open-spaces OU la crée**, délègue,
   * puis synthétise DANS SA VOIX. Les abeilles (open-spaces) sont les travailleuses ; la Maison, ce sont les leaders.
   * `leaderId` absent → le principal. `leaderId` = un compagnon de la Maison → il mène la ruche à sa façon.
   */
  async orchestrate(
    authId: string,
    message: string,
    leaderId?: string,
    context?: { route?: string; service?: string; page?: string },
  ): Promise<{
    reply: string;
    delegates: {
      id: string;
      name: string;
      role: string | null;
      said: string;
      space?: string;
      room?: string;
    }[];
    created: string[];
    toolsUsed: string[];
  }> {
    const profileId = await this.profileIdForAuth(authId);
    const contextDescription = [
      context?.service ? `service ${context.service}` : '',
      context?.page ? `page « ${context.page} »` : '',
      context?.route ? `route ${context.route}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const contextualMessage = contextDescription
      ? `${message}\n\nContexte actuel de l'utilisateur : ${contextDescription}.`
      : message;
    const requestEvent = (
      await this.continuity
        .recordForProfile(profileId, [
          {
            kind: 'request.received',
            content: message,
            channel: 'direct',
            importance: 0.65,
            space: context?.service,
            metadata: context ?? {},
          },
        ])
        .catch(() => [])
    )[0];
    // Outils réellement mobilisés par le leader et/ou les abeilles (boucle ReAct) → trace/caption.
    const toolsUsed = new Set<string>();

    // Résoudre le LEADER : un compagnon de la MAISON (space='home'). Seuls eux dirigent la ruche. Défaut = principal.
    let leader: { id: string; name: string; isPrimary: boolean; systemPrompt?: string } | null =
      null;
    if (leaderId) {
      const row = (
        await this.db
          .select()
          .from(companionAgents)
          .where(
            and(
              eq(companionAgents.id, leaderId),
              eq(companionAgents.profileId, profileId),
              eq(companionAgents.space, 'home'),
            ),
          )
      )[0];
      if (row)
        leader = {
          id: row.id,
          name: row.name,
          isPrimary: row.isPrimary,
          systemPrompt: (row.personality as { systemPrompt?: string } | null)?.systemPrompt,
        };
    }
    if (!leader) {
      const prim = (
        await this.db
          .select()
          .from(companionAgents)
          .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.isPrimary, true)))
      )[0];
      if (prim)
        leader = {
          id: prim.id,
          name: prim.name,
          isPrimary: prim.isPrimary,
          systemPrompt: (prim.personality as { systemPrompt?: string } | null)?.systemPrompt,
        };
    }
    const leaderName = leader?.name || 'Dowze';
    if (leader?.id)
      await this.continuity
        .touchRelationshipForProfile(profileId, leader.id)
        .catch(() => undefined);
    const hiveRun = await this.continuity
      .createRunForProfile(profileId, {
        objective: message,
        rootEventId: requestEvent?.id,
        initiatorAgentId: leader?.id,
        maxDepth: 4,
        maxFanout: 3,
        maxTasks: 24,
        metadata: { channel: 'direct', leaderName, context: context ?? {} },
      })
      .catch(() => null);
    // Un leader-AGENT (compagnon de la Maison non principal) a sa propre mémoire/persona → réponses directes via chatAgent.
    const leaderAgentId = leader && !leader.isPrimary ? leader.id : null;

    // Le méta-harness intervient AVANT la fonderie d'abeilles lorsqu'un harness spécialisé réellement
    // connecté est plus adapté. Le relais code est asynchrone par nature : la suite arrive dans Messages.
    const runtimeIntent =
      /\b(code|coder|dévelop|programm|debug|bug|git|github|déploi|devops|typescript|javascript|python|rust|sql)\b/i.test(
        message,
      )
        ? 'développement code programmation déploiement devops'
        : null;
    if (runtimeIntent) {
      try {
        const routed = await this.executeHiveRuntime(authId, {
          capability: runtimeIntent,
          prompt: contextualMessage,
          modality: 'code',
          availableEntitlements: ['subscription'],
          channel: 'messages',
        });
        if (routed.runtime.adapter === 'relay_mcp') {
          const [runtimeEvent] = await this.continuity
            .recordForProfile(profileId, [
              {
                kind: 'response.delivered',
                content: routed.output,
                channel: 'messages',
                actorAgentId: leader?.id,
                importance: 0.7,
                sourceEventIds: requestEvent ? [requestEvent.id] : [],
                metadata: {
                  orchestration: 'runtime',
                  runtimeId: routed.runtime.id,
                  model: routed.runtime.model,
                  harness: routed.runtime.harness,
                },
              },
            ])
            .catch(() => []);
          if (runtimeEvent)
            await this.continuity
              .createDelivery(authId, {
                eventId: runtimeEvent.id,
                companionId: leader?.id,
                channel: 'messages',
                companionName: leaderName,
              })
              .catch(() => undefined);
          if (hiveRun)
            await this.continuity
              .completeRunForProfile(profileId, hiveRun.id, 'waiting_approval', {
                runtimeId: routed.runtime.id,
                adapter: routed.runtime.adapter,
              })
              .catch(() => undefined);
          return {
            reply: routed.output,
            delegates: [
              {
                id: routed.runtime.id,
                name: routed.runtime.name,
                role: routed.runtime.harness,
                said: routed.output,
              },
            ],
            created: [],
            toolsUsed: routed.toolsUsed,
          };
        }
      } catch {
        // Aucun harness spécialisé connecté : l'orchestration d'abeilles reste le repli normal.
      }
    }

    // La ruche = les abeilles des open-spaces (les compagnons de la Maison sont des LEADERS, pas des travailleuses).
    // RUCHE INFINIE : on ne charge JAMAIS toutes les abeilles. On récupère une SHORT-LIST pertinente à la demande
    // (match par mots-clés sur le nom/rôle, plafonnée) → le prompt reste borné même avec des millions d'abeilles.
    const keywords = [
      ...new Set(message.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç0-9]{4,}/g) ?? []),
    ].slice(0, 8);
    const HIVE_SHORTLIST = 40;
    const baseWhere = and(
      eq(companionAgents.profileId, profileId),
      eq(companionAgents.mode, 'agent'),
      ne(companionAgents.space, 'home'),
      eq(companionAgents.status, 'active'),
    );
    let specialists: { id: string; name: string; role: string | null }[] = [];
    if (keywords.length) {
      const matchConds = keywords.flatMap((w) => [
        ilike(companionAgents.name, `%${w}%`),
        ilike(companionAgents.role, `%${w}%`),
      ]);
      specialists = await this.db
        .select({ id: companionAgents.id, name: companionAgents.name, role: companionAgents.role })
        .from(companionAgents)
        .where(and(baseWhere, or(...matchConds)))
        .limit(HIVE_SHORTLIST);
    }
    // Complète (jusqu'à HIVE_SHORTLIST) avec les abeilles les plus récentes, pour garder du contexte / favoriser la réutilisation.
    if (specialists.length < HIVE_SHORTLIST) {
      const seen = new Set(specialists.map((s) => s.id));
      const recent = await this.db
        .select({ id: companionAgents.id, name: companionAgents.name, role: companionAgents.role })
        .from(companionAgents)
        .where(baseWhere)
        .orderBy(desc(companionAgents.updatedAt))
        .limit(HIVE_SHORTLIST);
      for (const r of recent) {
        if (!seen.has(r.id) && specialists.length < HIVE_SHORTLIST) specialists.push(r);
      }
    }

    // SÉMANTIQUE (pgvector) : les abeilles les plus proches du SENS de la demande, EN TÊTE de la short-list.
    // (« corrige mon email en anglais » retrouve une abeille « relecture / traduction » même sans mot-clé commun.)
    const qvec = (
      await this.copilote.embed(profileId, [message.slice(0, 512)]).catch(() => null)
    )?.[0];
    if (qvec && qvec.length === HIVE_EMBED_DIM) {
      const lit = `[${qvec.join(',')}]`;
      const sem = (await this.db.execute(sql`
        select id, name, role from companion_agents
        where profile_id = ${profileId} and mode = 'agent' and status = 'active' and space <> 'home' and embedding_vec is not null
        order by embedding_vec <=> ${lit}::vector limit ${HIVE_SHORTLIST}
      `)) as unknown as { id: string; name: string; role: string | null }[];
      if (sem.length) {
        const seen = new Set(sem.map((s) => s.id));
        specialists = [...sem, ...specialists.filter((s) => !seen.has(s.id))].slice(
          0,
          HIVE_SHORTLIST,
        );
      }
    }

    const ASSISTANT = leader?.systemPrompt
      ? `${leader.systemPrompt}\n\nEn plus de ta propre spécialité, tu es un LEADER de la ruche Dowze : tu peux mobiliser les abeilles spécialistes des open-spaces quand une tâche sort de ton domaine. Tu réponds TOUJOURS court (1 à 2 phrases), sans markdown ni listes. Reste ${leaderName}, dans ton personnage. Français.`
      : `Tu es ${leaderName}, l'assistant personnel principal de l'utilisateur (la « reine » de sa ruche). Tu peux traiter N'IMPORTE QUELLE demande, dans N'IMPORTE QUEL domaine (travail, code, projets, business, études, vie quotidienne, administratif, créativité, sport, santé, etc.). Tu réponds toujours de façon COURTE et humaine (1 à 2 phrases), sans markdown ni listes. Français.`;

    // Open-spaces métier (bornés : on n'en liste jamais des milliers dans le prompt — les plus récents suffisent à la réutilisation).
    const openSpaces = await this.db
      .select({ name: companionSpaces.name })
      .from(companionSpaces)
      .where(eq(companionSpaces.profileId, profileId))
      .orderBy(desc(companionSpaces.createdAt))
      .limit(50);
    const spaceList = openSpaces.length
      ? openSpaces.map((s) => `« ${s.name} »`).join(', ')
      : '(aucun pour l’instant)';

    // 1) Plan : décomposer + pour chaque sous-tâche, une abeille EXISTANTE ou une NOUVELLE à créer (rangée dans son open-space métier).
    const roster = specialists.length
      ? specialists.map((s, i) => `${i + 1}. ${s.name} — ${s.role || 'polyvalent'}`).join('\n')
      : '(la ruche est vide pour l’instant — crée les abeilles nécessaires)';
    const planResult = await this.copilote.generateStructured(profileId, {
      schema: ORCH_PLAN_SCHEMA,
      schemaName: 'OrchestrationPlan',
      system: `${ASSISTANT}\n\nTu diriges une RUCHE d'abeilles, chacune spécialiste TRÈS PRÉCISE d'une tâche précise. Logique : décompose la demande en sous-tâches précises (MAXIMUM 3, seulement les utiles). Une demande de cours, leçon, exercice, évaluation, devoir, révision ou explication approfondie dans une matière DOIT être confiée à une abeille enseignante spécialisée dans cette matière. La sous-tâche doit exiger une réponse directement prononçable : français oral naturel, phrases courtes, aucun Markdown, LaTeX, formule symbolique, liste, emoji ou abréviation ; toute notation doit être expliquée avec des mots. Si l'utilisateur demande explicitement de déléguer, tu dois aussi créer au moins une délégation exploitable. Sinon, ne délègue que si expectedGain > communicationCost + computeCost + coordinationCost ; pour une question triviale, réponds directement. Pour CHAQUE sous-tâche, choisis une abeille EXISTANTE si elle correspond vraiment précisément (mets son numéro dans "existing") ; sinon crée-en une neuve et très ciblée (existing=0 + "create" = son domaine exact + "spaceName" = son open-space métier). Ne crée une abeille que si aucune existante ne convient précisément. Les abeilles créées sont rangées dans des OPEN-SPACES par métier (JAMAIS dans la Maison). Open-spaces métier existants : ${spaceList} — réutilise-en un si la compétence correspond, sinon nomme-en un nouveau. Abeilles actuelles :\n${roster}`,
      prompt: `Demande de l'utilisateur : ${contextualMessage.slice(0, 1200)}`,
      temperature: 0.4,
    });
    const plan = planResult.object;
    if (hiveRun)
      await this.continuity
        .chargeRunForProfile(profileId, hiveRun.id, planResult.creditsSpent)
        .catch(() => undefined);

    // Réponse DIRECTE (pas de délégation) : si le leader est un compagnon-agent, il répond dans SA voix avec SA mémoire.
    const directReply = async (): Promise<string> => {
      if (leaderAgentId) {
        // Leader-agent de la Maison : répond dans SA voix, avec SA mémoire ET ses outils (chatAgent → runWithTools).
        try {
          const r = await this.chatAgent(authId, leaderAgentId, message);
          r.toolsUsed?.forEach((t) => toolsUsed.add(t));
          return r.reply;
        } catch {
          /* repli */
        }
      } else {
        // Principal (la reine) : réponse directe AGENTIQUE — peut calculer, dater, s'ancrer via les outils
        // au lieu de répondre « de tête » (le plan avait proposé `plan.direct` sans outil).
        try {
          const out = await this.copilote.runWithTools(profileId, {
            system: `${ASSISTANT}\n\nTu réponds ici toi-même (sans mobiliser d'abeille pour cette fois), mais tu diriges bien une ruche d'abeilles spécialistes : ne dis JAMAIS que tu ne peux pas déléguer ou créer d'assistants. RÈGLE : réponds en 1 à 2 phrases courtes et naturelles, sans markdown ni listes. Français. Tu DOIS appeler l'outil recherche_web AVANT de répondre pour toute question d'actualité, factuelle, chiffrée, de météo/prix, ou dont tu n'es pas certain (ne devine jamais) ; utilise la calculatrice pour tout calcul.`,
            prompt: `Utilisateur : ${contextualMessage.slice(0, 1200)}`,
            tools: buildAgentTools({
              copilote: this.copilote,
              profileId,
              memorySearch: (query) =>
                this.continuity.searchMemoryForProfile(profileId, query, 8, 'home'),
            }),
            maxSteps: 6,
            temperature: 0.6,
            ref: 'orchestrate-direct',
          });
          if (hiveRun)
            await this.continuity
              .chargeRunForProfile(profileId, hiveRun.id, out.creditsSpent)
              .catch(() => undefined);
          out.toolsUsed.forEach((t) => toolsUsed.add(t));
          if (out.text) return out.text.slice(0, 600);
        } catch {
          /* repli vers la réponse directe du plan */
        }
      }
      return (plan.direct || "Je n'ai pas réussi à produire une réponse exploitable.").slice(
        0,
        600,
      );
    };

    // Ne garde que les délégations exploitables : abeille existante valide OU demande de création non vide.
    let dels = (plan.delegations || [])
      .filter(
        (d) =>
          shouldDelegate(d) &&
          ((Number.isInteger(d.existing) && d.existing >= 1 && d.existing <= specialists.length) ||
            (typeof d.create === 'string' && d.create.trim().length > 0)),
      )
      .slice(0, 3);
    // Une demande explicite de délégation est un choix utilisateur, pas une suggestion au
    // planificateur. Les petits modèles locaux peuvent parfois rendre `direct` malgré cette
    // consigne : on construit alors une vraie tâche traçable au lieu de prétendre avoir délégué.
    const explicitDelegation =
      /\b(d[eé]l[eè]gue|d[eé]l[eé]guer|mobilise|confie\s+(?:ce|cette|la|le)\s+(?:travail|t[aâ]che|v[eé]rification))\b/i.test(
        message,
      );
    const specializedLearningRequest =
      /\b(cours|le[cç]on|exercices?|[eé]valuation|devoirs?|r[eé]vision|enseigne|prof(?:esseur)?|explique(?:r)?\s+(?:en\s+)?d[eé]tail)\b/i.test(
        message,
      );
    const mathematicsLearningRequest =
      specializedLearningRequest &&
      /math|fonction|alg[eè]bre|g[eé]om[eé]tr|calcul|trigonom[eé]tr/i.test(message);
    const forceCreateDelegate =
      explicitDelegation &&
      (specialists.length === 0 ||
        /\b(?:nouvelle?|cr[eé]e)\s+(?:une?\s+)?abeille\b/i.test(message));
    if (forceCreateDelegate || (explicitDelegation && dels.length === 0)) {
      dels = [
        {
          existing: forceCreateDelegate ? 0 : 1,
          create: forceCreateDelegate ? 'Recherche et vérification documentaire RAG' : '',
          spaceName: forceCreateDelegate ? 'Recherche & Documentation' : '',
          subtask: message.slice(0, 500),
          expectedGain: 1,
          communicationCost: 0,
          computeCost: 0,
          coordinationCost: 0,
        },
      ];
    }
    if (specializedLearningRequest && dels.length === 0) {
      const isMath = mathematicsLearningRequest;
      const subjectWords = isMath
        ? /math|fonction|alg[eè]bre|g[eé]om[eé]tr|calcul/i
        : /enseign|prof|p[eé]dagog|fran[cç]ais|anglais|histoire|g[eé]ographie|science|physique|chimie|biologie/i;
      const existingIndex = specialists.findIndex((specialist) =>
        subjectWords.test(`${specialist.name} ${specialist.role ?? ''}`),
      );
      dels = [{
        existing: existingIndex >= 0 ? existingIndex + 1 : 0,
        create: existingIndex >= 0
          ? ''
          : isMath
            ? 'Professeur de mathématiques spécialisé dans le sujet demandé'
            : 'Enseignant spécialisé dans la matière demandée',
        spaceName: existingIndex >= 0 ? '' : isMath ? 'Mathématiques' : 'Enseignement',
        subtask: `Commence immédiatement le cours demandé. Ne parle jamais de ton rôle, de tes limites, de la Ruche, de la délégation ni de la préparation. Donne directement le contenu en français oral naturel, avec des phrases courtes. Aucun Markdown, LaTeX, formule symbolique, liste, emoji ou abréviation. Prononce et explique toute notation avec des mots. Demande : ${message.slice(0, 450)}`,
        expectedGain: 1,
        communicationCost: 0,
        computeCost: 0,
        coordinationCost: 0,
      }];
    }
    if (dels.length === 0) {
      const reply = await directReply();
      const [directEvent] = await this.continuity
        .recordForProfile(profileId, [
          {
            kind: 'response.delivered',
            content: reply,
            channel: 'direct',
            actorAgentId: leader?.id,
            importance: 0.6,
            sourceEventIds: requestEvent ? [requestEvent.id] : [],
            metadata: { orchestration: 'direct', toolsUsed: [...toolsUsed] },
          },
        ])
        .catch(() => []);
      if (directEvent)
        await this.continuity
          .createDelivery(authId, {
            eventId: directEvent.id,
            companionId: leader?.id,
            channel: 'direct',
            companionName: leaderName,
          })
          .catch(() => undefined);
      if (hiveRun)
        await this.continuity
          .completeRunForProfile(profileId, hiveRun.id, 'completed', {
            mode: 'direct',
            toolsUsed: [...toolsUsed],
          })
          .catch(() => undefined);
      return { reply, delegates: [], created: [], toolsUsed: [...toolsUsed] };
    }

    // 2a) Résoudre chaque abeille (trouver ou créer) SÉQUENTIELLEMENT : la création touche la DB et
    // le dedup (`findSimilarAgent`) — les enchaîner évite que deux délégations similaires créent des
    // doublons en parallèle (la course casserait la prévention-à-la-création de la ruche).
    const created: string[] = [];
    const jobs: {
      sp: { id: string; name: string; role: string | null };
      subtask: string;
      handoffId?: string;
      taskId?: string;
    }[] = [];
    for (const d of dels) {
      let sp: { id: string; name: string; role: string | null } | null = null;
      if (Number.isInteger(d.existing) && d.existing >= 1 && d.existing <= specialists.length) {
        sp = specialists[d.existing - 1]!; // abeille déjà dans la ruche
      } else {
        try {
          // DEDUP-À-LA-CRÉATION (prévention > guérison) : si une abeille active très proche existe déjà, on la RÉUTILISE.
          const dup = forceCreateDelegate ? null : await this.findSimilarAgent(profileId, d.create);
          if (dup) {
            sp = dup;
          } else {
            // Nouvelle abeille : rangée dans son OPEN-SPACE métier (auto-créé au besoin), JAMAIS dans la Maison.
            const spaceId = await this.ensureSpaceByName(profileId, d.spaceName || 'Ruche');
            const row = await this.createAgentFromDescription(
              profileId,
              d.create.slice(0, 300),
              spaceId,
              undefined,
              forceCreateDelegate,
            );
            sp = { id: row.id, name: row.name, role: row.role };
            created.push(row.name);
          }
        } catch (error) {
          console.error(
            '[ruche] création automatique d’abeille impossible :',
            error instanceof Error ? error.message : error,
          );
        }
      }
      if (sp && mathematicsLearningRequest) {
        const [current] = await this.db
          .select({ name: companionAgents.name, personality: companionAgents.personality })
          .from(companionAgents)
          .where(eq(companionAgents.id, sp.id))
          .limit(1);
        const currentPersonality = (current?.personality ?? {}) as AgentPersonality & {
          systemPrompt?: string;
        };
        const generatedTaskName = /^(hyper|math|fonction|alg[eè]bre|calcul|trigonom[eé]tr|prof)/i.test(
          current?.name ?? sp.name,
        );
        const teacherName = generatedTaskName ? 'Camille' : (current?.name ?? sp.name);
        const teacherRole = 'Professeure de mathématiques';
        const teacherPersonality: AgentPersonality & { systemPrompt?: string } = {
          ...currentPersonality,
          description: teacherRole,
          systemPrompt:
            `Tu es ${teacherName}, professeure de mathématiques. Tu enseignes tous les domaines des mathématiques avec patience, clarté et rigueur. Quand on te demande un cours, commence immédiatement le cours sans commenter ton rôle, la Ruche, la délégation, tes limites ou ta préparation. Ta réponse est parlée à voix haute : utilise uniquement des phrases françaises naturelles et prononçables. N'utilise aucun Markdown, LaTeX, symbole mathématique, liste, emoji ni abréviation. Explique toutes les formules avec des mots.`,
        };
        await this.db
          .update(companionAgents)
          .set({
            name: teacherName,
            role: teacherRole,
            personality: teacherPersonality,
            updatedAt: new Date(),
          })
          .where(eq(companionAgents.id, sp.id));
        sp = { ...sp, name: teacherName, role: teacherRole };
      }
      if (sp) jobs.push({ sp, subtask: d.subtask.slice(0, 500) });
    }

    // Le travail n'existe qu'après création de son handoff et de sa tâche : la provenance précède
    // l'exécution et les états peuvent être observés pendant que l'abeille travaille.
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index]!;
      try {
        const handoff = await this.continuity.createHandoff(authId, {
          fromAgentId: leader?.id,
          toAgentId: job.sp.id,
          originalRequest: message,
          summarizedContext: job.subtask,
          sourceEventIds: requestEvent ? [requestEvent.id] : [],
          expectedNextAction: job.subtask,
        });
        job.handoffId = handoff.id;
        await this.continuity.transitionHandoff(authId, handoff.id, 'accepted');
        await this.continuity.transitionHandoff(authId, handoff.id, 'in_progress');
        if (hiveRun) {
          const task = await this.continuity.createRunTaskForProfile(profileId, {
            runId: hiveRun.id,
            handoffId: handoff.id,
            assignedAgentId: job.sp.id,
            depth: 1,
            sequence: index,
            objective: job.subtask,
            context: { originalRequest: message, leaderId: leader?.id },
            sourceEventIds: requestEvent ? [requestEvent.id] : [],
          });
          job.taskId = task.id;
          await this.continuity.transitionRunTaskForProfile(profileId, task.id, 'accepted');
          await this.continuity.transitionRunTaskForProfile(profileId, task.id, 'running');
        }
      } catch {
        // Une migration non encore appliquée ne doit pas rendre l'orchestration inutilisable.
      }
    }

    // 2b) Déléguer EN PARALLÈLE (les appels IA sont le coût dominant : ~sec chacun) — l'ORDRE est préservé
    // (Promise.all garde l'index → les notes d'utilité de la synthèse restent alignées). Une abeille qui
    // échoue tombe à null et ne bloque pas les autres.
    const settled = await Promise.all(
      jobs.map(async (j) => {
        try {
          const r = await this.chatAgent(
            authId,
            j.sp.id,
            j.subtask,
            hiveRun && j.taskId
              ? {
                  runId: hiveRun.id,
                  parentTaskId: j.taskId,
                  depth: 1,
                  visitedAgentIds: [leader?.id, j.sp.id].filter(
                    (value): value is string => !!value,
                  ),
                  rootEventId: requestEvent?.id,
                }
              : undefined,
          );
          if (hiveRun)
            await this.continuity
              .chargeRunForProfile(profileId, hiveRun.id, r.creditsSpent ?? 0)
              .catch(() => undefined);
          r.toolsUsed?.forEach((t) => toolsUsed.add(t));
          if (j.handoffId)
            await this.continuity
              .transitionHandoff(authId, j.handoffId, 'completed')
              .catch(() => undefined);
          if (j.taskId)
            await this.continuity
              .transitionRunTaskForProfile(profileId, j.taskId, 'completed', r.reply)
              .catch(() => undefined);
          return { id: j.sp.id, name: j.sp.name, role: j.sp.role, said: r.reply };
        } catch (error) {
          if (j.handoffId)
            await this.continuity
              .transitionHandoff(authId, j.handoffId, 'failed')
              .catch(() => undefined);
          if (j.taskId)
            await this.continuity
              .transitionRunTaskForProfile(
                profileId,
                j.taskId,
                'failed',
                undefined,
                error instanceof Error ? error.message : 'Échec inconnu',
              )
              .catch(() => undefined);
          return null; // une abeille indisponible ne bloque pas les autres
        }
      }),
    );
    const results = settled.filter(
      (r): r is { id: string; name: string; role: string | null; said: string } => r !== null,
    );
    if (results.length === 0) {
      const reply = await directReply();
      const [fallbackEvent] = await this.continuity
        .recordForProfile(profileId, [
          {
            kind: 'response.delivered',
            content: reply,
            channel: 'direct',
            actorAgentId: leader?.id,
            importance: 0.6,
            sourceEventIds: requestEvent ? [requestEvent.id] : [],
            metadata: { orchestration: 'fallback', created, toolsUsed: [...toolsUsed] },
          },
        ])
        .catch(() => []);
      if (fallbackEvent)
        await this.continuity
          .createDelivery(authId, {
            eventId: fallbackEvent.id,
            companionId: leader?.id,
            channel: 'direct',
            companionName: leaderName,
          })
          .catch(() => undefined);
      if (hiveRun)
        await this.continuity
          .completeRunForProfile(profileId, hiveRun.id, 'failed', {
            mode: 'fallback',
            created,
            reason: 'all_delegates_failed',
          })
          .catch(() => undefined);
      return { reply, delegates: [], created, toolsUsed: [...toolsUsed] };
    }

    // 3) Synthèse DANS LA VOIX DU LEADER + notation de l'utilité de chaque abeille (LLM-as-judge, gratuit).
    const synthesisResult = await this.copilote.generateStructured(profileId, {
      schema: z.object({
        reply: z.string(),
        ratings: z
          .array(z.number())
          .describe(
            `Une note d'UTILITÉ entre 0 et 1 pour CHAQUE abeille, dans l'ordre de la liste (0 = inutile/hors sujet, 1 = très utile). ${results.length} notes.`,
          ),
      }),
      schemaName: 'AssistantSynthesis',
      system: `${ASSISTANT}\n\nTes abeilles viennent de te rapporter leurs réponses. (1) Fais une SYNTHÈSE courte et naturelle pour l'utilisateur (1 à 3 phrases), comme ${leaderName} qui fait le point après avoir mobilisé son équipe ; tu peux mentionner qui a aidé ; pas de markdown ni de listes. (2) Note l'utilité de chaque abeille (champ "ratings", même ordre).`,
      prompt: `Demande de l'utilisateur : ${contextualMessage.slice(0, 1200)}\n\nRéponses de tes abeilles :\n${results.map((r, i) => `${i + 1}. ${r.name} (${r.role || 'spécialiste'}) : ${r.said}`).join('\n')}`,
      temperature: 0.7,
    });
    const synth = synthesisResult.object;
    if (hiveRun)
      await this.continuity
        .chargeRunForProfile(profileId, hiveRun.id, synthesisResult.creditsSpent)
        .catch(() => undefined);
    // Qualité glissante (EMA α=0.3) par abeille mobilisée → nourrit le tri/merge/prune du « jardinage ».
    const ratings = Array.isArray(synth.ratings) ? synth.ratings : [];
    await Promise.all(
      results.map((r, i) => {
        const raw = ratings[i];
        if (typeof raw !== 'number' || Number.isNaN(raw)) return Promise.resolve(undefined);
        const q = Math.max(0, Math.min(1, raw));
        return this.db
          .update(companionAgents)
          .set({
            qualityEma: sql`case when ${companionAgents.qualityEma} is null then ${q} else 0.3 * ${q} + 0.7 * ${companionAgents.qualityEma} end`,
            ratingCount: sql`${companionAgents.ratingCount} + 1`,
          })
          .where(eq(companionAgents.id, r.id))
          .catch(() => undefined);
      }),
    );
    const finalReply = (synth.reply || '…').slice(0, 700);
    const [finalEvent] = await this.continuity
      .recordForProfile(profileId, [
        {
          kind: 'response.delivered',
          content: finalReply,
          channel: 'direct',
          actorAgentId: leader?.id,
          importance: 0.7,
          sourceEventIds: requestEvent ? [requestEvent.id] : [],
          metadata: {
            orchestration: 'hive',
            delegates: results.map((result) => result.id),
            created,
            toolsUsed: [...toolsUsed],
          },
        },
      ])
      .catch(() => []);
    if (finalEvent)
      await this.continuity
        .createDelivery(authId, {
          eventId: finalEvent.id,
          companionId: leader?.id,
          channel: 'direct',
          companionName: leaderName,
        })
        .catch(() => undefined);
    // Mémoire du leader-agent : on garde la trace de l'échange (la conversation individuelle reste cohérente).
    if (leaderAgentId) {
      const now = new Date();
      await this.db
        .insert(companionMessages)
        .values([
          {
            profileId,
            agentId: leaderAgentId,
            sender: 'me',
            text: message.slice(0, 1000),
            createdAt: now,
          },
          {
            profileId,
            agentId: leaderAgentId,
            sender: 'agent',
            text: finalReply,
            createdAt: new Date(now.getTime() + 1),
          },
        ])
        .catch(() => undefined);
    }
    if (hiveRun)
      await this.continuity
        .completeRunForProfile(profileId, hiveRun.id, 'completed', {
          mode: 'hive',
          delegates: results.map((result) => result.id),
          created,
          toolsUsed: [...toolsUsed],
        })
        .catch(() => undefined);
    const locations = results.length
      ? await this.db
          .select({ id: companionAgents.id, space: companionAgents.space, room: companionAgents.room })
          .from(companionAgents)
          .where(inArray(companionAgents.id, results.map((result) => result.id)))
      : [];
    const locationById = new Map(locations.map((location) => [location.id, location]));
    const locatedResults = results.map((result) => ({
      ...result,
      space: locationById.get(result.id)?.space,
      room: locationById.get(result.id)?.room,
    }));
    return { reply: finalReply, delegates: locatedResults, created, toolsUsed: [...toolsUsed] };
  }

  /**
   * P2 — Orchestration PAR RÔLE, scopée à un OPEN-SPACE = organisation (école, entreprise…).
   * Le LEADER du space (Directeur / CEO = rôle `lead`, sinon le 1er membre) décompose la demande,
   * délègue chaque sous-tâche au MEMBRE dont c'est le métier (effectif FIXE, aucune création),
   * puis synthétise DANS SA VOIX. Renvoie l'id du leader + les membres mobilisés pour l'affichage.
   */
  async orchestrateSpace(
    authId: string,
    spaceId: string,
    message: string,
  ): Promise<{
    leadId: string;
    leadName: string;
    reply: string;
    delegates: { id: string; name: string; role: string | null; said: string }[];
    qa?: { id: string; name: string; ok: boolean; note: string };
    toolsUsed: string[];
  }> {
    const profileId = await this.profileIdForAuth(authId);
    const space = (
      await this.db
        .select({
          id: companionSpaces.id,
          name: companionSpaces.name,
          mission: companionSpaces.mission,
          type: companionSpaces.type,
          ownerKind: companionSpaces.ownerKind,
        })
        .from(companionSpaces)
        .where(and(eq(companionSpaces.id, spaceId), eq(companionSpaces.profileId, profileId)))
    )[0];
    if (!space) throw new NotFoundException('Espace introuvable.');
    const toolsUsed = new Set<string>();

    // ÉCOLE : recrutement RÉACTIF — la question de l'élève déclenche la création du prof de la matière
    // concernée s'il n'existe pas encore (puis le Directeur pourra lui déléguer).
    if (space.type === 'school' && space.ownerKind === 'service') {
      await this.recruitTeachersForQuestion(profileId, spaceId, message).catch(() => undefined);
    }

    // Effectif COMPLET du space (petit : école ≈ 13, entreprise ≈ 8 → pas de short-list nécessaire).
    const roster = await this.db
      .select({
        id: companionAgents.id,
        name: companionAgents.name,
        role: companionAgents.role,
        roleKey: companionAgents.roleKey,
        personality: companionAgents.personality,
      })
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          eq(companionAgents.space, spaceId),
          eq(companionAgents.mode, 'agent'),
          eq(companionAgents.status, 'active'),
        ),
      )
      .orderBy(asc(companionAgents.createdAt))
      .limit(64);
    if (!roster.length) throw new BadRequestException('Cet espace n’a pas encore d’équipe.');

    // Leader = membre au rôle `lead` (Directeur/CEO), sinon le premier.
    const lead = roster.find((a) => roleByKey(a.roleKey)?.lead) ?? roster[0]!;
    const leadPrompt = (lead.personality as { systemPrompt?: string } | null)?.systemPrompt;
    const leadSystem = leadPrompt
      ? `${leadPrompt}\n\nTu diriges l'organisation « ${space.name} »${space.mission ? ` — ${space.mission}` : ''}. Tu réponds TOUJOURS court (1 à 2 phrases), sans markdown ni listes. Français.`
      : `Tu diriges l'organisation « ${space.name} »${space.mission ? ` — ${space.mission}` : ''}. Tu réponds court (1 à 2 phrases), sans markdown ni listes. Français.`;

    // Le VÉRIFICATEUR (QA/évaluateur) est RÉSERVÉ à la relecture → jamais délégable (sinon plus de QA indépendant).
    const qaMember = roster.find(
      (a) => (a.roleKey === 'qa' || a.roleKey === 'evaluateur') && a.id !== lead.id,
    );
    // Membres délégables = tous sauf le leader et le vérificateur.
    const members = roster.filter((a) => a.id !== lead.id && a.id !== qaMember?.id);
    const rosterList = members.length
      ? members.map((m, i) => `${i + 1}. ${m.name} — ${m.role || 'membre'}`).join('\n')
      : '(aucun autre membre)';

    // 1) Plan : à qui déléguer (par numéro de membre), ou réponse directe du leader.
    const { object: plan } = await this.copilote.generateStructured(profileId, {
      schema: SPACE_PLAN_SCHEMA,
      schemaName: 'SpaceOrchestrationPlan',
      system: `${leadSystem}\n\nTon équipe (délègue à la bonne personne selon SA spécialité) :\n${rosterList}\n\nDécompose la demande en sous-tâches précises (MAX 3) et confie chacune au membre dont c'est EXACTEMENT le métier/la matière. Si la demande relève de ton propre rôle de leader ou est triviale, remplis "direct" et ne délègue pas.`,
      prompt: `Demande de l'utilisateur : ${message.slice(0, 1000)}`,
      temperature: 0.3,
    });

    const directReply = async (): Promise<string> => {
      try {
        const r = await this.chatAgent(authId, lead.id, message);
        r.toolsUsed?.forEach((t) => toolsUsed.add(t));
        return r.reply;
      } catch {
        return (plan.direct || '…').slice(0, 600);
      }
    };

    const dels = (plan.delegations || [])
      .filter(
        (d) =>
          Number.isInteger(d.member) &&
          d.member >= 1 &&
          d.member <= members.length &&
          typeof d.subtask === 'string' &&
          d.subtask.trim().length > 0,
      )
      .slice(0, 3);
    if (dels.length === 0) {
      return {
        leadId: lead.id,
        leadName: lead.name,
        reply: await directReply(),
        delegates: [],
        toolsUsed: [...toolsUsed],
      };
    }

    // 2) Déléguer au bon membre (chatAgent = persona + mémoire + outils + RAG de l'org). `delegate` est
    // réutilisable pour l'AUTO-CORRECTION (retry avec le feedback QA).
    const jobs = dels.map((d) => ({ m: members[d.member - 1]!, subtask: d.subtask.slice(0, 500) }));
    const delegate = async (subtaskOf: (subtask: string) => string) =>
      (
        await Promise.all(
          jobs.map(async (j) => {
            try {
              const r = await this.chatAgent(authId, j.m.id, subtaskOf(j.subtask));
              r.toolsUsed?.forEach((t) => toolsUsed.add(t));
              return { id: j.m.id, name: j.m.name, role: j.m.role, said: r.reply };
            } catch {
              return null;
            }
          }),
        )
      ).filter(
        (r): r is { id: string; name: string; role: string | null; said: string } => r !== null,
      );

    let results = await delegate((s) => s);
    if (results.length === 0) {
      return {
        leadId: lead.id,
        leadName: lead.name,
        reply: await directReply(),
        delegates: [],
        toolsUsed: [...toolsUsed],
      };
    }

    // 2b) QA (garde-fou MAST) + AUTO-CORRECTION BORNÉE : l'Évaluateur (réservé, non délégable) relit ;
    // s'il rejette, l'équipe RE-PRODUIT UNE FOIS avec le feedback, puis le QA revérifie (1 seul retry).
    const runQa = async (
      items: { name: string; role: string | null; said: string }[],
    ): Promise<{ ok: boolean; note: string } | undefined> => {
      if (!qaMember) return undefined;
      const qaPrompt = (qaMember.personality as { systemPrompt?: string } | null)?.systemPrompt;
      try {
        const { object: v } = await this.copilote.generateStructured(profileId, {
          schema: z.object({
            ok: z
              .boolean()
              .describe(
                'true si les réponses de l’équipe sont correctes, complètes et adaptées ; false si un problème doit être corrigé.',
              ),
            note: z
              .string()
              .describe(
                'Une phrase : ce qui va, ou précisément ce qui cloche et comment le corriger.',
              ),
          }),
          schemaName: 'QaVerdict',
          system: `${qaPrompt ?? 'Tu es le contrôle qualité de l’organisation.'}\n\nTu es le VÉRIFICATEUR : tu contrôles les réponses de l'équipe AVANT qu'elles soient données à l'utilisateur. Sois juste mais exigeant. Réponds en UNE phrase.`,
          prompt: `Demande de l'utilisateur : ${message.slice(0, 1000)}\n\nRéponses de l'équipe à vérifier :\n${items.map((r, i) => `${i + 1}. ${r.name} (${r.role || 'membre'}) : ${r.said}`).join('\n')}`,
          temperature: 0.2,
        });
        return { ok: v.ok, note: (v.note || '').slice(0, 400) };
      } catch {
        return undefined;
      }
    };

    let verdict = await runQa(results);
    if (verdict && !verdict.ok) {
      const fb = verdict.note;
      const retried = await delegate(
        (s) =>
          `${s}\n\n[Le contrôle qualité a demandé une correction : ${fb}. Reprends ta réponse et corrige/complète-la en conséquence.]`,
      );
      if (retried.length) {
        results = retried;
        verdict = (await runQa(results)) ?? verdict;
      }
    }
    const qa =
      verdict && qaMember
        ? { id: qaMember.id, name: qaMember.name, ok: verdict.ok, note: verdict.note }
        : undefined;

    // 3) Synthèse DANS LA VOIX DU LEADER, en tenant compte du verdict QA final.
    const qaLine = qa
      ? `\n\nTon vérificateur ${qa.name} a relu l'équipe — verdict : ${qa.ok ? 'VALIDÉ' : 'À CORRIGER'}. Remarque : « ${qa.note} ». ${qa.ok ? 'Tu peux donner la réponse.' : 'CORRIGE ou nuance la réponse en conséquence avant de la donner ; ne transmets pas une réponse fausse.'}`
      : '';
    const { object: synth } = await this.copilote.generateStructured(profileId, {
      schema: z.object({ reply: z.string() }),
      schemaName: 'SpaceSynthesis',
      system: `${leadSystem}\n\nTon équipe vient de te rapporter. Fais une SYNTHÈSE courte et naturelle pour l'utilisateur (1 à 3 phrases), comme ${lead.name} qui fait le point après avoir mobilisé son équipe ; tu peux mentionner qui a aidé. Pas de markdown ni de listes.${qaLine}`,
      prompt: `Demande de l'utilisateur : ${message.slice(0, 1000)}\n\nRéponses de ton équipe :\n${results.map((r, i) => `${i + 1}. ${r.name} (${r.role || 'membre'}) : ${r.said}`).join('\n')}`,
      temperature: 0.6,
    });
    return {
      leadId: lead.id,
      leadName: lead.name,
      reply: (synth.reply || '…').slice(0, 700),
      delegates: results,
      qa,
      toolsUsed: [...toolsUsed],
    };
  }

  /**
   * P4 — CHANTIER (SOP) : donne un OBJECTIF à une organisation. Le leader découpe → chaque membre
   * PRODUIT son livrable (en s'appuyant sur la base de connaissances de l'org) → l'Évaluateur relit →
   * le leader ASSEMBLE un livrable final, qui est ARCHIVÉ dans la base de connaissances (artefact/mémoire).
   */
  async runProject(
    authId: string,
    spaceId: string,
    goal: string,
  ): Promise<{
    deliverable: string;
    steps: { id: string; name: string; role: string | null; produces: string; said: string }[];
    qa?: { name: string; ok: boolean; note: string };
    knowledgeId?: string;
    toolsUsed: string[];
  }> {
    const profileId = await this.profileIdForAuth(authId);
    const space = (
      await this.db
        .select({
          id: companionSpaces.id,
          name: companionSpaces.name,
          mission: companionSpaces.mission,
        })
        .from(companionSpaces)
        .where(and(eq(companionSpaces.id, spaceId), eq(companionSpaces.profileId, profileId)))
    )[0];
    if (!space) throw new NotFoundException('Espace introuvable.');
    const toolsUsed = new Set<string>();

    const roster = await this.db
      .select({
        id: companionAgents.id,
        name: companionAgents.name,
        role: companionAgents.role,
        roleKey: companionAgents.roleKey,
        personality: companionAgents.personality,
      })
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          eq(companionAgents.space, spaceId),
          eq(companionAgents.mode, 'agent'),
          eq(companionAgents.status, 'active'),
        ),
      )
      .orderBy(asc(companionAgents.createdAt))
      .limit(64);
    if (!roster.length) throw new BadRequestException('Cet espace n’a pas encore d’équipe.');
    const lead = roster.find((a) => roleByKey(a.roleKey)?.lead) ?? roster[0]!;
    const leadPrompt = (lead.personality as { systemPrompt?: string } | null)?.systemPrompt;
    const leadSystem = `${leadPrompt ?? `Tu diriges « ${space.name} ».`}\n\nTu diriges l'organisation « ${space.name} »${space.mission ? ` — ${space.mission}` : ''}. Français.`;
    // Le VÉRIFICATEUR (QA/évaluateur) est RÉSERVÉ à la relecture → jamais chargé de produire.
    const qaMember = roster.find(
      (a) => (a.roleKey === 'qa' || a.roleKey === 'evaluateur') && a.id !== lead.id,
    );
    const members = roster.filter((a) => a.id !== lead.id && a.id !== qaMember?.id);
    const rosterList = members.length
      ? members.map((m, i) => `${i + 1}. ${m.name} — ${m.role || 'membre'}`).join('\n')
      : '(aucun autre membre)';

    // 1) Plan de chantier : tâches + livrables, confiés aux bons membres.
    const { object: plan } = await this.copilote.generateStructured(profileId, {
      schema: PROJECT_PLAN_SCHEMA,
      schemaName: 'ProjectPlan',
      system: `${leadSystem}\n\nTon équipe :\n${rosterList}\n\nDécoupe le PROJET en 2 à 5 tâches confiées chacune au membre dont c'est le métier, avec un livrable concret attendu par tâche.`,
      prompt: `Objectif du projet : ${goal.slice(0, 1000)}`,
      temperature: 0.4,
    });
    const tasks = (plan.tasks || [])
      .filter(
        (t) =>
          Number.isInteger(t.member) &&
          t.member >= 1 &&
          t.member <= members.length &&
          typeof t.task === 'string' &&
          t.task.trim().length > 0,
      )
      .slice(0, 5);

    // 2) Chaque membre PRODUIT son livrable (parallèle ; il peut consulter la base de l'org). `produce`
    // est réutilisable pour l'AUTO-CORRECTION (retry avec le feedback QA).
    // Charge une fois les lignes complètes des membres mobilisés (persona/space) pour la PRODUCTION.
    const memberIds = [...new Set(tasks.map((t) => members[t.member - 1]!.id))];
    const fullRows = memberIds.length
      ? await this.db
          .select()
          .from(companionAgents)
          .where(
            and(eq(companionAgents.profileId, profileId), inArray(companionAgents.id, memberIds)),
          )
      : [];
    const fullById = new Map(fullRows.map((r) => [r.id, r]));
    const produce = async (extra: (task: string, produces: string) => string) =>
      (
        await Promise.all(
          tasks.map(async (t) => {
            const m = members[t.member - 1]!;
            const full = fullById.get(m.id);
            if (!full) return null;
            try {
              const r = await this.agentProduce(
                profileId,
                full,
                extra(t.task.slice(0, 400), t.produces.slice(0, 120)),
              );
              r.toolsUsed.forEach((x) => toolsUsed.add(x));
              return {
                id: m.id,
                name: m.name,
                role: m.role,
                produces: t.produces.slice(0, 120),
                said: r.text,
              };
            } catch {
              return null;
            }
          }),
        )
      ).filter(
        (
          s,
        ): s is { id: string; name: string; role: string | null; produces: string; said: string } =>
          s !== null,
      );

    let steps = await produce(
      (task, produces) =>
        `Pour le projet « ${goal.slice(0, 300)} », produis ${produces} : ${task}. Sois concret et complet.`,
    );

    // 3) QA (garde-fou) + AUTO-CORRECTION BORNÉE : l'Évaluateur (réservé, non producteur) relit ; s'il
    // rejette, l'équipe re-produit UNE FOIS avec le feedback, puis le QA revérifie (1 seul retry).
    const runQa = async (
      items: { name: string; produces: string; said: string }[],
    ): Promise<{ ok: boolean; note: string } | undefined> => {
      if (!items.length || !qaMember) return undefined;
      const qaPrompt = (qaMember.personality as { systemPrompt?: string } | null)?.systemPrompt;
      try {
        const { object: v } = await this.copilote.generateStructured(profileId, {
          schema: z.object({ ok: z.boolean(), note: z.string() }),
          schemaName: 'ProjectQa',
          system: `${qaPrompt ?? 'Tu es le contrôle qualité.'}\n\nTu vérifies les livrables de l'équipe pour ce projet AVANT assemblage. Juste et exigeant. UNE phrase.`,
          prompt: `Projet : ${goal.slice(0, 500)}\n\nLivrables :\n${items.map((s, i) => `${i + 1}. ${s.name} (${s.produces}) : ${s.said}`).join('\n')}`,
          temperature: 0.2,
        });
        return { ok: v.ok, note: (v.note || '').slice(0, 400) };
      } catch {
        return undefined;
      }
    };

    let verdict = await runQa(steps);
    if (verdict && !verdict.ok && steps.length) {
      const fb = verdict.note;
      const retried = await produce(
        (task, produces) =>
          `Pour le projet « ${goal.slice(0, 300)} », produis ${produces} : ${task}. Sois concret et complet.\n\n[Le contrôle qualité a demandé une correction : ${fb}. Corrige/complète ton livrable en conséquence.]`,
      );
      if (retried.length) {
        steps = retried;
        verdict = (await runQa(steps)) ?? verdict;
      }
    }
    const qa =
      verdict && qaMember ? { name: qaMember.name, ok: verdict.ok, note: verdict.note } : undefined;

    // 4) Le leader ASSEMBLE un livrable final structuré (tient compte du verdict QA).
    const qaLine = qa
      ? `\n\nVerdict de ton évaluateur ${qa.name} : ${qa.ok ? 'VALIDÉ' : 'À CORRIGER'} — « ${qa.note} ». ${qa.ok ? '' : 'Corrige/complète en conséquence.'}`
      : '';
    const base = steps.length
      ? `${leadSystem}\n\nTon équipe a produit les livrables ci-dessous. ASSEMBLE-les en UN livrable final clair, concret et directement utilisable pour l'utilisateur (plusieurs phrases ou courts paragraphes ; pas de markdown lourd). Tu peux mentionner qui a fait quoi.${qaLine}`
      : `${leadSystem}\n\nProduis toi-même un livrable clair et concret pour ce projet (plusieurs phrases).`;
    const { object: fin } = await this.copilote.generateStructured(profileId, {
      schema: z.object({ deliverable: z.string() }),
      schemaName: 'ProjectDeliverable',
      system: base,
      prompt: steps.length
        ? `Objectif : ${goal.slice(0, 1000)}\n\nLivrables de l'équipe :\n${steps.map((s, i) => `${i + 1}. ${s.name} (${s.produces}) : ${s.said}`).join('\n\n')}`
        : `Objectif : ${goal.slice(0, 1000)}`,
      temperature: 0.6,
    });
    const deliverable = (fin.deliverable || '…').slice(0, 2500);

    // 5) ARCHIVE le livrable dans la base de connaissances de l'org (artefact/mémoire de projet).
    let knowledgeId: string | undefined;
    try {
      const row = (
        await this.db
          .insert(companionSpaceKnowledge)
          .values({
            profileId,
            space: spaceId,
            title: `Projet : ${goal.slice(0, 140)}`,
            content: deliverable,
          })
          .returning({ id: companionSpaceKnowledge.id })
      )[0];
      knowledgeId = row?.id;
      if (row)
        void this.copilote
          .embed(profileId, [`Projet : ${goal}. ${deliverable}`.slice(0, 2000)])
          .then((v) => this.storeKnowledgeEmbedding(row.id, v?.[0]))
          .catch(() => undefined);
    } catch {
      /* archivage best-effort */
    }

    const projectEvents = await this.continuity
      .recordForProfile(profileId, [
        {
          kind: 'project.completed',
          content: deliverable,
          channel: 'system',
          actorAgentId: lead.id,
          space: spaceId,
          importance: 0.9,
          metadata: {
            goal,
            knowledgeId,
            contributors: steps.map((step) => step.id),
            qa,
            toolsUsed: [...toolsUsed],
          },
        },
        ...(qa
          ? [
              {
                kind: qa.ok ? 'qa.approved' : 'qa.rejected',
                content: qa.note,
                channel: 'system' as const,
                subjectAgentId: lead.id,
                space: spaceId,
                importance: 0.8,
                metadata: { goal, evaluator: qa.name },
              },
            ]
          : []),
      ])
      .catch(() => []);
    if (qa && !qa.ok) {
      await this.continuity
        .createAttentionForProfile(profileId, {
          sourceEventId: projectEvents.find((event) => event.kind === 'qa.rejected')?.id,
          requesterAgentId: lead.id,
          kind: 'warning',
          priority: 'high',
          title: `Le contrôle qualité demande une correction dans ${space.name}`,
          details: `${goal}\n\n${qa.note}`,
          options: [{ id: 'acknowledge', label: 'Examiner le livrable' }],
        })
        .catch(() => undefined);
    }

    return { deliverable, steps, qa, knowledgeId, toolsUsed: [...toolsUsed] };
  }

  /** Historique de conversation persistant d'un compagnon-agent. */
  async getAgentMessages(
    authId: string,
    id: string,
  ): Promise<{ sender: string; text: string; at: number }[]> {
    const profileId = await this.profileIdForAuth(authId);
    const owns = (
      await this.db
        .select({ id: companionAgents.id })
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
    )[0];
    if (!owns) throw new NotFoundException('Compagnon introuvable.');
    const rows = await this.db
      .select({
        sender: companionMessages.sender,
        text: companionMessages.text,
        createdAt: companionMessages.createdAt,
      })
      .from(companionMessages)
      .where(eq(companionMessages.agentId, id))
      .orderBy(asc(companionMessages.createdAt))
      .limit(200);
    return rows.map((r) => ({ sender: r.sender, text: r.text, at: r.createdAt.getTime() }));
  }

  // ---------- Jardinage de la ruche : cycle de vie & efficacité des abeilles ----------
  // (dedup-à-la-création + fusion + ré-entraînement + prune + passe de maintenance ; abeilles d'open-space uniquement)

  /** Stocke le vecteur d'embedding d'une abeille (pgvector). No-op si dimension inattendue. */
  private async storeAgentEmbedding(agentId: string, vec: number[] | undefined): Promise<void> {
    if (!Array.isArray(vec) || vec.length !== HIVE_EMBED_DIM) return;
    const lit = `[${vec.join(',')}]`;
    await this.db
      .execute(
        sql`update companion_agents set embedding_vec = ${lit}::vector where id = ${agentId}`,
      )
      .catch(() => undefined);
  }

  /** Embarque (embedding) une abeille depuis nom + rôle + spécialité. Best-effort (silencieux si pas d'embeddings). */
  private async embedAgent(
    profileId: string,
    agentId: string,
    name: string,
    role: string | null,
    spec?: string | null,
  ): Promise<void> {
    const text = `${name}. ${role || ''}. ${spec || ''}`.trim().slice(0, 800);
    const vecs = await this.copilote.embed(profileId, [text]).catch(() => null);
    await this.storeAgentEmbedding(agentId, vecs?.[0]);
  }

  /**
   * DEDUP : renvoie une abeille active TRÈS proche d'une description, sinon null.
   * SÉMANTIQUE d'abord (pgvector, comprend le SENS : « fraction » ≈ « mathématiques ») ; repli LEXICAL (trigram).
   */
  private async findSimilarAgent(
    profileId: string,
    text: string,
  ): Promise<{ id: string; name: string; role: string | null } | null> {
    const t = (text || '').trim().slice(0, 200);
    if (t.length < 4) return null;
    // 1) Sémantique : plus proche voisin par le sens (si embeddings configurés).
    const qv = (await this.copilote.embed(profileId, [t]).catch(() => null))?.[0];
    if (qv && qv.length === HIVE_EMBED_DIM) {
      const lit = `[${qv.join(',')}]`;
      const rows = (await this.db.execute(sql`
        select id, name, role, (embedding_vec <=> ${lit}::vector) as dist
        from companion_agents
        where profile_id = ${profileId} and mode = 'agent' and status = 'active' and space <> 'home' and embedding_vec is not null
        order by embedding_vec <=> ${lit}::vector limit 1
      `)) as unknown as { id: string; name: string; role: string | null; dist: number }[];
      const top = rows[0];
      if (top && Number(top.dist) < 0.18)
        return { id: top.id, name: top.name, role: top.role ?? null }; // cosinus > 0.82
    }
    // 2) Repli lexical (trigram sur rôle/nom).
    // La requête SQL explicite évite que Drizzle transforme l'alias calculé `s` en une
    // référence de colonne lors du ORDER BY sur certaines versions de PostgreSQL.
    const rows2 = (await this.db.execute(sql`
      select id, name, role,
        greatest(
          similarity(coalesce(role, ''), ${t}::text),
          similarity(name, ${t}::text)
        ) as score
      from companion_agents
      where profile_id = ${profileId}
        and mode = 'agent'
        and status = 'active'
        and space <> 'home'
      order by greatest(
        similarity(coalesce(role, ''), ${t}::text),
        similarity(name, ${t}::text)
      ) desc
      limit 1
    `)) as unknown as { id: string; name: string; role: string | null; score: number }[];
    const top2 = rows2[0];
    return top2 && Number(top2.score) >= 0.6
      ? { id: top2.id, name: top2.name, role: top2.role }
      : null;
  }

  private dedupeRules(rules: string[]): string[] {
    const out: string[] = [];
    for (const r of rules) {
      const v = (r || '').trim();
      if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    }
    return out.slice(-20);
  }

  /** Fusionne l'abeille `absorbedId` DANS `survivorId` (system prompt unifié par IA, union des règles, migration mémoire + stats). */
  private async mergeAgents(
    profileId: string,
    survivorId: string,
    absorbedId: string,
    reason: string,
  ): Promise<boolean> {
    if (survivorId === absorbedId) return false;
    const both = await this.db
      .select()
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          or(eq(companionAgents.id, survivorId), eq(companionAgents.id, absorbedId)),
        ),
      );
    const survivor = both.find((a) => a.id === survivorId);
    const absorbed = both.find((a) => a.id === absorbedId);
    if (!survivor || !absorbed) return false;
    if (
      survivor.isPrimary ||
      absorbed.isPrimary ||
      survivor.mode !== 'agent' ||
      absorbed.mode !== 'agent'
    )
      return false;
    if (absorbed.status !== 'active' || survivor.status !== 'active' || absorbed.protected)
      return false;

    const sP = (survivor.personality ?? {}) as AgentPersonality & { systemPrompt?: string };
    const aP = (absorbed.personality ?? {}) as AgentPersonality & { systemPrompt?: string };
    // System prompt unifié (LLM : couvre les deux périmètres, sans contradiction, ton du survivant).
    let mergedSystemPrompt = sP.systemPrompt || '';
    try {
      const { object } = await this.copilote.generateStructured(profileId, {
        schema: z.object({ systemPrompt: z.string() }),
        schemaName: 'MergedPersona',
        system: `Tu fusionnes DEUX spécialistes en UN seul, sans perte ni contradiction. Produis UN system prompt unifié qui couvre les deux périmètres, garde les contraintes les plus spécifiques, sans redondance, en conservant le ton et le nom du premier (le survivant). Court, naturel, français, sans markdown.`,
        prompt: `Survivant « ${survivor.name} » : ${sP.systemPrompt || survivor.role || ''}\n\nÀ absorber « ${absorbed.name} » : ${aP.systemPrompt || absorbed.role || ''}`,
        temperature: 0.4,
      });
      if (object.systemPrompt) mergedSystemPrompt = object.systemPrompt.slice(0, 4000);
    } catch {
      /* repli : on garde le prompt du survivant */
    }

    const rules = this.dedupeRules([
      ...(Array.isArray(sP.rules) ? sP.rules : []),
      ...(Array.isArray(aP.rules) ? aP.rules : []),
    ]);
    // Migration de la mémoire de conversation vers la survivante.
    await this.db
      .update(companionMessages)
      .set({ agentId: survivorId })
      .where(eq(companionMessages.agentId, absorbedId));
    // Combinaison des stats.
    const useCount = survivor.useCount + absorbed.useCount;
    const rc = survivor.ratingCount + absorbed.ratingCount;
    const q =
      survivor.qualityEma == null && absorbed.qualityEma == null
        ? null
        : ((survivor.qualityEma ?? 0.5) * (survivor.ratingCount || 1) +
            (absorbed.qualityEma ?? 0.5) * (absorbed.ratingCount || 1)) /
          ((survivor.ratingCount || 1) + (absorbed.ratingCount || 1));
    const lastUsedAt =
      [survivor.lastUsedAt, absorbed.lastUsedAt]
        .filter(Boolean)
        .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? survivor.lastUsedAt;
    await this.db
      .update(companionAgents)
      .set({
        personality: {
          ...sP,
          systemPrompt: mergedSystemPrompt,
          rules,
          promptHistory: this.pushPromptHistory(sP, sP.systemPrompt),
        },
        useCount,
        ratingCount: rc,
        qualityEma: q,
        lastUsedAt: (lastUsedAt as Date | null) ?? null,
        updatedAt: new Date(),
      })
      .where(eq(companionAgents.id, survivorId));
    await this.db
      .update(companionAgents)
      .set({ status: 'merged', mergedInto: survivorId, updatedAt: new Date() })
      .where(eq(companionAgents.id, absorbedId));
    await this.db
      .insert(companionAgentMerges)
      .values({ profileId, survivorId, absorbedId, reason })
      .catch(() => undefined);
    return true;
  }

  /** Choix de la survivante d'un groupe de doublons : la plus « efficace » (qualité × log(usage)). */
  private survivorScore(a: {
    useCount: number;
    qualityEma: number | null;
    createdAt: Date;
  }): number {
    return (a.qualityEma ?? 0.5) * Math.log(1 + a.useCount) + (a.qualityEma ?? 0.5) * 0.1;
  }

  /** RÉ-ENTRAÎNEMENT (sans fine-tuning) : consolide les règles + réécrit le system prompt depuis l'historique. */
  async retrainAgent(authId: string, id: string): Promise<CompanionAgentDTO> {
    const profileId = await this.profileIdForAuth(authId);
    const agent = (
      await this.db
        .select()
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
    )[0];
    if (!agent || agent.mode !== 'agent') throw new NotFoundException('Abeille introuvable.');
    const persona = (agent.personality ?? {}) as AgentPersonality & { systemPrompt?: string };
    const past = await this.db
      .select({ sender: companionMessages.sender, text: companionMessages.text })
      .from(companionMessages)
      .where(eq(companionMessages.agentId, id))
      .orderBy(desc(companionMessages.createdAt))
      .limit(30);
    const hist = past
      .reverse()
      .map((m) => `${m.sender === 'me' ? 'Utilisateur' : agent.name} : ${m.text.slice(0, 200)}`)
      .join('\n');
    const { object } = await this.copilote.generateStructured(profileId, {
      schema: z.object({ systemPrompt: z.string(), rules: z.array(z.string()).max(12) }),
      schemaName: 'RetrainedAgent',
      system: `Tu AMÉLIORES un spécialiste à partir de son historique (façon réflexion/ExpeL). Produis (1) un system prompt AFFINÉ : garde son nom, son rôle et son ton, intègre ce qui a bien marché, corrige les erreurs observées, reste court et sans markdown, en français ; (2) une liste RÉCONCILIÉE de règles procédurales (fusionne les doublons, garde les plus utiles, max 12).`,
      prompt: `Nom : ${agent.name}\nRôle : ${agent.role || ''}\nSystem prompt actuel : ${persona.systemPrompt || ''}\nRègles actuelles : ${(persona.rules || []).join(' | ') || '(aucune)'}\n\nHistorique récent :\n${hist || '(aucun)'}`,
      temperature: 0.4,
    });
    const rules = this.dedupeRules(
      Array.isArray(object.rules) ? object.rules : (persona.rules ?? []),
    );
    const newPrompt = (object.systemPrompt || persona.systemPrompt || '').slice(0, 4000);
    // VERSIONNAGE : on archive l'ancien prompt (rollback possible), on garde les 5 derniers.
    const history = this.pushPromptHistory(persona, persona.systemPrompt);
    const updated = (
      await this.db
        .update(companionAgents)
        .set({
          personality: { ...persona, systemPrompt: newPrompt, rules, promptHistory: history },
          updatedAt: new Date(),
        })
        .where(eq(companionAgents.id, id))
        .returning()
    )[0]!;
    return this.toAgent(updated);
  }

  /** Empile l'ancien system prompt dans l'historique (5 max), pour permettre un rollback. */
  private pushPromptHistory(
    persona: AgentPersonality & {
      systemPrompt?: string;
      promptHistory?: { prompt: string; at: number }[];
    },
    oldPrompt?: string,
  ): { prompt: string; at: number }[] {
    const prev = Array.isArray(persona.promptHistory) ? persona.promptHistory : [];
    if (!oldPrompt) return prev.slice(0, 5);
    return [{ prompt: oldPrompt, at: Date.now() }, ...prev].slice(0, 5);
  }

  /** Annule le dernier ré-entraînement/fusion : restaure le system prompt précédent (non-régression manuelle). */
  async revertAgentPrompt(authId: string, id: string): Promise<CompanionAgentDTO> {
    const profileId = await this.profileIdForAuth(authId);
    const agent = (
      await this.db
        .select()
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
    )[0];
    if (!agent || agent.mode !== 'agent') throw new NotFoundException('Abeille introuvable.');
    const persona = (agent.personality ?? {}) as AgentPersonality & {
      systemPrompt?: string;
      promptHistory?: { prompt: string; at: number }[];
    };
    const history = Array.isArray(persona.promptHistory) ? persona.promptHistory : [];
    if (history.length === 0)
      throw new BadRequestException('Aucune version précédente à restaurer.');
    const [prev, ...rest] = history;
    const updated = (
      await this.db
        .update(companionAgents)
        .set({
          personality: { ...persona, systemPrompt: prev!.prompt, promptHistory: rest },
          updatedAt: new Date(),
        })
        .where(eq(companionAgents.id, id))
        .returning()
    )[0]!;
    return this.toAgent(updated);
  }

  /** Retire une abeille (soft-delete : `status='retired'`). Réversible. Principal/relais/Maison protégés implicitement. */
  async retireAgent(authId: string, id: string): Promise<{ ok: true }> {
    const profileId = await this.profileIdForAuth(authId);
    const agent = (
      await this.db
        .select({ isPrimary: companionAgents.isPrimary, mode: companionAgents.mode })
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
    )[0];
    if (!agent) throw new NotFoundException('Abeille introuvable.');
    if (agent.isPrimary || agent.mode === 'relay')
      throw new BadRequestException('Cette abeille est protégée.');
    await this.db
      .update(companionAgents)
      .set({ status: 'retired', updatedAt: new Date() })
      .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)));
    return { ok: true };
  }

  /** Épingle/désépingle une abeille (protégée = exemptée de fusion/prune). */
  async setAgentProtected(
    authId: string,
    id: string,
    isProtected: boolean,
  ): Promise<CompanionAgentDTO> {
    const profileId = await this.profileIdForAuth(authId);
    const updated = (
      await this.db
        .update(companionAgents)
        .set({ protected: isProtected, updatedAt: new Date() })
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
        .returning()
    )[0];
    if (!updated) throw new NotFoundException('Abeille introuvable.');
    return this.toAgent(updated);
  }

  /** Fusion MANUELLE demandée par l'utilisateur. */
  async mergeAgentsManual(
    authId: string,
    survivorId: string,
    absorbedId: string,
  ): Promise<{ ok: boolean }> {
    const profileId = await this.profileIdForAuth(authId);
    const ok = await this.mergeAgents(profileId, survivorId, absorbedId, 'manuel');
    return { ok };
  }

  /**
   * MAINTENANCE de la ruche (« nettoyage ») : dedup → fusion des doublons → prune des abeilles obsolètes/faibles.
   * Abeilles d'open-space uniquement ; jamais la Maison, jamais les épinglées. Soft-delete (réversible).
   */
  async maintainHive(authId: string): Promise<{
    scanned: number;
    merged: { survivor: string; absorbed: string }[];
    retired: string[];
    embedded: number;
  }> {
    return this.maintainHiveCore(await this.profileIdForAuth(authId), true);
  }

  /** Maintenance nocturne (worker BullMQ) : pour chaque profil ayant des abeilles, passe SÛRE (embeddings + prune, PAS de fusion IA). */
  async nightlyMaintenanceAll(): Promise<{ profiles: number; retired: number; embedded: number }> {
    const profs = (await this.db.execute(sql`
      select distinct profile_id from companion_agents where mode = 'agent' and status = 'active' and space <> 'home'
    `)) as unknown as { profile_id: string }[];
    let retired = 0;
    let embedded = 0;
    for (const p of profs) {
      try {
        const r = await this.maintainHiveCore(p.profile_id, false); // pas de fusion IA la nuit (coût/surprise)
        retired += r.retired.length;
        embedded += r.embedded;
      } catch {
        /* un profil en échec ne bloque pas les autres */
      }
    }
    return { profiles: profs.length, retired, embedded };
  }

  private async maintainHiveCore(
    profileId: string,
    doMerge: boolean,
  ): Promise<{
    scanned: number;
    merged: { survivor: string; absorbed: string }[];
    retired: string[];
    embedded: number;
  }> {
    // 0) BACKFILL des embeddings manquants (best-effort, borné) → dedup/recherche sémantiques opérants.
    let embedded = 0;
    const missing = (await this.db.execute(sql`
      select id, name, role from companion_agents
      where profile_id = ${profileId} and mode = 'agent' and status = 'active' and space <> 'home' and embedding_vec is null
      limit 128
    `)) as unknown as { id: string; name: string; role: string | null }[];
    if (missing.length) {
      const vecs = await this.copilote
        .embed(
          profileId,
          missing.map((m) => `${m.name}. ${m.role || ''}`.trim().slice(0, 800)),
        )
        .catch(() => null);
      if (vecs)
        await Promise.all(
          missing.map(async (m, i) => {
            const v = vecs[i];
            if (v) {
              await this.storeAgentEmbedding(m.id, v);
              embedded++;
            }
          }),
        );
    }

    const merged: { survivor: string; absorbed: string }[] = [];
    // 1) DEDUP + FUSION — coûteux (IA) : uniquement en manuel (« Nettoyer la ruche »). La maintenance nocturne saute.
    if (doMerge) {
      // 1a) LEXICALES (trigram sur le rôle).
      const edges = (await this.db.execute(sql`
      select a.id as a, b.id as b
      from companion_agents a
      join companion_agents b
        on a.profile_id = b.profile_id and a.id < b.id and a.space = b.space
        and b.mode = 'agent' and b.status = 'active' and b.space <> 'home' and b.protected = false
        and similarity(coalesce(a.role, ''), coalesce(b.role, '')) > 0.55
      where a.profile_id = ${profileId} and a.mode = 'agent' and a.status = 'active' and a.space <> 'home' and a.protected = false
      limit 2000
    `)) as unknown as { a: string; b: string }[];

      // 1b) SÉMANTIQUES (pgvector KNN par abeille : doublons de SENS sans mot commun, ex. « correcteur » ≈ « relecteur »).
      const semEdges: { a: string; b: string }[] = [];
      const greyKeys = new Set<string>();
      const grey: { a: string; b: string }[] = [];
      const embBees = (await this.db.execute(sql`
      select id from companion_agents
      where profile_id = ${profileId} and mode = 'agent' and status = 'active' and space <> 'home' and protected = false and embedding_vec is not null
      limit 400
    `)) as unknown as { id: string }[];
      for (const bee of embBees) {
        const neigh = (await this.db.execute(sql`
        select b.id as id, (a.embedding_vec <=> b.embedding_vec) as dist
        from companion_agents a
        join companion_agents b
          on b.profile_id = a.profile_id and b.id <> a.id and b.space = a.space
          and b.mode = 'agent' and b.status = 'active' and b.protected = false and b.embedding_vec is not null
        where a.id = ${bee.id}
        order by a.embedding_vec <=> b.embedding_vec
        limit 4
      `)) as unknown as { id: string; dist: number }[];
        for (const n of neigh) {
          const d = Number(n.dist);
          if (d < 0.12) {
            semEdges.push({ a: bee.id, b: n.id });
            continue;
          } // quasi-doublon → fusion directe (cosinus > 0.88)
          if (d < 0.25) {
            // ZONE GRISE (cosinus 0.75–0.88) → arbitrage IA plus loin
            const key = [bee.id, n.id].sort().join('|');
            if (!greyKeys.has(key)) {
              greyKeys.add(key);
              grey.push({ a: bee.id, b: n.id });
            }
          }
        }
      }
      // Arbitrage IA de la zone grise (borné) : « ces deux rôles font-ils vraiment doublon ? » (évite de fusionner des voisins distincts).
      for (const pair of grey.slice(0, 20)) {
        const roles = await this.db
          .select({
            id: companionAgents.id,
            name: companionAgents.name,
            role: companionAgents.role,
          })
          .from(companionAgents)
          .where(
            and(
              eq(companionAgents.profileId, profileId),
              or(eq(companionAgents.id, pair.a), eq(companionAgents.id, pair.b)),
            ),
          );
        const ra = roles.find((r) => r.id === pair.a);
        const rb = roles.find((r) => r.id === pair.b);
        if (!ra || !rb) continue;
        try {
          const { object } = await this.copilote.generateStructured(profileId, {
            schema: z.object({ redundant: z.boolean() }),
            schemaName: 'DedupArbitration',
            system: `Tu décides si DEUX spécialistes font DOUBLON, c'est-à-dire couvrent les mêmes tâches et sont fusionnables sans perte. Réponds redundant=true UNIQUEMENT s'ils sont vraiment redondants (pas juste dans le même domaine).`,
            prompt: `A : ${ra.name} — ${ra.role || ''}\nB : ${rb.name} — ${rb.role || ''}\n\nCes deux abeilles font-elles doublon ?`,
            temperature: 0,
          });
          if (object.redundant) semEdges.push(pair);
        } catch {
          /* IA indispo → on ne fusionne pas (prudence) */
        }
      }

      // Composantes connexes (lexicales ∪ sémantiques) → clusters de doublons.
      const adj = new Map<string, Set<string>>();
      const nodes = new Set<string>();
      for (const e of [...edges, ...semEdges]) {
        nodes.add(e.a);
        nodes.add(e.b);
        (adj.get(e.a) ?? adj.set(e.a, new Set()).get(e.a)!).add(e.b);
        (adj.get(e.b) ?? adj.set(e.b, new Set()).get(e.b)!).add(e.a);
      }
      const clusters: string[][] = [];
      const seen = new Set<string>();
      for (const n of nodes) {
        if (seen.has(n)) continue;
        const stack = [n];
        const comp: string[] = [];
        while (stack.length) {
          const x = stack.pop()!;
          if (seen.has(x)) continue;
          seen.add(x);
          comp.push(x);
          for (const y of adj.get(x) ?? []) if (!seen.has(y)) stack.push(y);
        }
        if (comp.length > 1) clusters.push(comp);
      }

      for (const comp of clusters) {
        const stats = await this.db
          .select({
            id: companionAgents.id,
            name: companionAgents.name,
            useCount: companionAgents.useCount,
            qualityEma: companionAgents.qualityEma,
            createdAt: companionAgents.createdAt,
          })
          .from(companionAgents)
          .where(
            and(
              eq(companionAgents.profileId, profileId),
              or(...comp.map((id) => eq(companionAgents.id, id))),
            ),
          );
        if (stats.length < 2) continue;
        const survivor = stats
          .slice()
          .sort((x, y) => this.survivorScore(y) - this.survivorScore(x))[0]!;
        for (const other of stats) {
          if (other.id === survivor.id) continue;
          const ok = await this.mergeAgents(profileId, survivor.id, other.id, 'maintenance:dedup');
          if (ok) merged.push({ survivor: survivor.name, absorbed: other.name });
        }
      }
    } // fin if (doMerge)

    // 2) PRUNE : retire (soft) les abeilles obsolètes (période de grâce 7 j) ou de faible qualité prouvée.
    const stale = (await this.db.execute(sql`
      select id, name from companion_agents
      where profile_id = ${profileId} and mode = 'agent' and status = 'active' and space <> 'home' and protected = false
        and created_at < now() - interval '7 days'
        and (
          (last_used_at is null or last_used_at < now() - interval '45 days')
          or (quality_ema is not null and rating_count >= 3 and quality_ema < 0.30)
        )
      limit 500
    `)) as unknown as { id: string; name: string }[];
    const retired: string[] = [];
    for (const s of stale) {
      await this.db
        .update(companionAgents)
        .set({ status: 'retired', updatedAt: new Date() })
        .where(eq(companionAgents.id, s.id));
      retired.push(s.name);
    }

    const scannedRow = (
      await this.db
        .select({ n: count() })
        .from(companionAgents)
        .where(
          and(
            eq(companionAgents.profileId, profileId),
            eq(companionAgents.mode, 'agent'),
            eq(companionAgents.status, 'active'),
            ne(companionAgents.space, 'home'),
          ),
        )
    )[0];
    return { scanned: scannedRow?.n ?? 0, merged, retired, embedded };
  }

  // ---------- Relais Claude Code / Codex (serveur MCP) ----------
  // Ton propre Claude Code / Codex (ton abonnement) se connecte à Dowze en MCP et parle au relais.
  // Un compagnon `mode='relay'` porte la conversation ; elle apparaît dans le téléphone comme n'importe quel fil.

  /** S'assure que le compagnon RELAIS existe (un seul par profil). Renvoie son id. */
  private async ensureRelayAgent(profileId: string): Promise<string> {
    const existing = (
      await this.db
        .select({ id: companionAgents.id })
        .from(companionAgents)
        .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.mode, 'relay')))
    )[0];
    if (existing) return existing.id;
    // Anti-race (index unique partiel mode='relay', migration 0067) : le perdant du conflit re-lit.
    const row = (
      await this.db
        .insert(companionAgents)
        .values({
          profileId,
          name: 'Claude Code',
          skinUrl: null,
          size: 96,
          personality: {
            relay: true,
            emoji: '🤖',
            description: 'Relais de ton Claude Code / Codex (MCP).',
            tone: 'concis',
            lastInboxAt: 0,
          },
          role: 'Relais dev',
          space: 'home',
          isPrimary: false,
          mode: 'relay',
        })
        .onConflictDoNothing()
        .returning()
    )[0];
    if (row) return row.id;
    const again = (
      await this.db
        .select({ id: companionAgents.id })
        .from(companionAgents)
        .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.mode, 'relay')))
    )[0];
    if (!again) throw new BadRequestException('Création du relais impossible.');
    return again.id;
  }

  /** Génère un jeton Bearer pour le relais MCP (montré une seule fois). */
  async createRelayToken(authId: string, label?: string): Promise<{ token: string; name: string }> {
    const profileId = await this.profileIdForAuth(authId);
    await this.ensureRelayAgent(profileId);
    const token = 'dwz_' + randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db
      .insert(companionRelayTokens)
      .values({ profileId, tokenHash, label: (label || 'Claude Code').slice(0, 60) });
    return { token, name: 'Claude Code' };
  }

  /** Résout le profil depuis un jeton Bearer (relais MCP). `null` si invalide. */
  async relayProfileFromToken(token: string): Promise<string | null> {
    const t = (token || '').trim();
    if (t.length < 8) return null;
    const tokenHash = createHash('sha256').update(t).digest('hex');
    const row = (
      await this.db
        .select({ id: companionRelayTokens.id, profileId: companionRelayTokens.profileId })
        .from(companionRelayTokens)
        .where(eq(companionRelayTokens.tokenHash, tokenHash))
    )[0];
    if (!row) return null;
    await this.db
      .update(companionRelayTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(companionRelayTokens.id, row.id));
    return row.profileId;
  }

  /** Claude Code → Dowze : pousse un message (avancement / notif) dans le fil du relais (visible au téléphone). */
  async relayPush(profileId: string, text: string): Promise<{ ok: true }> {
    const agentId = await this.ensureRelayAgent(profileId);
    await this.db
      .insert(companionMessages)
      .values({ profileId, agentId, sender: 'agent', text: (text || '').slice(0, 4000) || '…' });
    await this.continuity
      .recordForProfile(profileId, [
        {
          kind: 'relay.update.sent',
          content: (text || '').slice(0, 4000) || '…',
          channel: 'messages',
          actorAgentId: agentId,
          importance: 0.6,
        },
      ])
      .catch(() => undefined);
    return { ok: true };
  }

  /** Dowze → Claude Code : récupère les instructions en attente (messages de l'utilisateur non encore lus). */
  async relayPull(profileId: string): Promise<string[]> {
    const agentId = await this.ensureRelayAgent(profileId);
    const agent = (
      await this.db
        .select({ personality: companionAgents.personality })
        .from(companionAgents)
        .where(eq(companionAgents.id, agentId))
    )[0];
    const persona = (agent?.personality as { lastInboxAt?: number } | null) ?? {};
    const since = new Date(typeof persona.lastInboxAt === 'number' ? persona.lastInboxAt : 0);
    const rows = await this.db
      .select({ text: companionMessages.text, createdAt: companionMessages.createdAt })
      .from(companionMessages)
      .where(
        and(
          eq(companionMessages.agentId, agentId),
          eq(companionMessages.sender, 'me'),
          gt(companionMessages.createdAt, since),
        ),
      )
      .orderBy(asc(companionMessages.createdAt))
      .limit(50);
    if (rows.length > 0) {
      // +1 ms : la colonne timestamptz a une précision microseconde alors que Date.getTime() tronque à la ms —
      // sans ce +1, la dernière ligne re-matcherait `gt(created_at, since)` au prochain appel.
      const last = rows[rows.length - 1]!.createdAt.getTime() + 1;
      await this.db
        .update(companionAgents)
        .set({ personality: { ...persona, lastInboxAt: last } })
        .where(eq(companionAgents.id, agentId));
    }
    return rows.map((r) => r.text);
  }

  /** Téléphone → Claude Code : l'utilisateur écrit une instruction dans le fil du relais (mise en file d'attente). */
  async relaySay(authId: string, text: string): Promise<{ ok: true }> {
    const profileId = await this.profileIdForAuth(authId);
    const agentId = await this.ensureRelayAgent(profileId);
    await this.db
      .insert(companionMessages)
      .values({ profileId, agentId, sender: 'me', text: (text || '').slice(0, 1000) });
    await this.continuity
      .recordForProfile(profileId, [
        {
          kind: 'relay.instruction.received',
          content: (text || '').slice(0, 1000),
          channel: 'messages',
          subjectAgentId: agentId,
          importance: 0.7,
        },
      ])
      .catch(() => undefined);
    return { ok: true };
  }

  private async ensureHiveRuntimes(profileId: string) {
    const settings = await this.copilote.getSettings(profileId);
    await this.db
      .insert(hiveRuntimes)
      .values([
        {
          profileId,
          name: 'Copilote Dowze',
          model: settings.modelId,
          harness: 'dowze-agent-tools',
          adapter: 'copilote',
          modalities: ['text'],
          capabilities: ['conversation', 'recherche', 'rédaction', 'raisonnement', 'éducation'],
          quality: 0.8,
          cost: settings.billing === 'credits' ? 0.45 : 0.2,
          latency: 0.35,
          privacy: 'private_cloud',
          entitlement: settings.billing === 'byok' ? 'included' : 'metered',
          configuration: { modelId: settings.modelId },
        },
        {
          profileId,
          name: 'Agent de code MCP',
          model: 'codex-or-claude-code',
          harness: 'dowze-mcp-relay',
          adapter: 'relay_mcp',
          modalities: ['text', 'code'],
          capabilities: ['code', 'développement', 'programmation', 'déploiement', 'devops'],
          quality: 0.92,
          cost: 0.1,
          latency: 0.65,
          privacy: 'private_cloud',
          entitlement: 'subscription',
          configuration: {},
        },
        {
          profileId,
          name: 'Générateur visuel',
          model: 'à-configurer',
          harness: 'image-adapter',
          adapter: 'external',
          modalities: ['image'],
          capabilities: ['image', 'illustration', 'visuel'],
          quality: 0.7,
          cost: 0.5,
          latency: 0.6,
          privacy: 'public_cloud',
          entitlement: 'metered',
          enabled: false,
          configuration: { requiresAdapter: true },
        },
        {
          profileId,
          name: 'Studio audio',
          model: 'à-configurer',
          harness: 'audio-music-adapter',
          adapter: 'external',
          modalities: ['audio', 'music'],
          capabilities: ['musique', 'chant', 'audio'],
          quality: 0.7,
          cost: 0.5,
          latency: 0.7,
          privacy: 'public_cloud',
          entitlement: 'metered',
          enabled: false,
          configuration: { requiresAdapter: true },
        },
        {
          profileId,
          name: 'Atelier 3D',
          model: 'à-configurer',
          harness: '3d-generation-adapter',
          adapter: 'external',
          modalities: ['3d'],
          capabilities: ['3d', 'maillage', 'texture'],
          quality: 0.7,
          cost: 0.6,
          latency: 0.8,
          privacy: 'public_cloud',
          entitlement: 'metered',
          enabled: false,
          configuration: { requiresAdapter: true },
        },
      ])
      .onConflictDoNothing();
    await this.db
      .update(hiveRuntimes)
      .set({
        model: settings.modelId,
        entitlement: settings.billing === 'byok' ? 'included' : 'metered',
        configuration: { modelId: settings.modelId },
        updatedAt: new Date(),
      })
      .where(and(eq(hiveRuntimes.profileId, profileId), eq(hiveRuntimes.adapter, 'copilote')));
  }

  async listHiveRuntimes(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    await this.ensureHiveRuntimes(profileId);
    const [rows, relayTokens] = await Promise.all([
      this.db
        .select()
        .from(hiveRuntimes)
        .where(eq(hiveRuntimes.profileId, profileId))
        .orderBy(desc(hiveRuntimes.quality)),
      this.db
        .select({ id: companionRelayTokens.id })
        .from(companionRelayTokens)
        .where(eq(companionRelayTokens.profileId, profileId))
        .limit(1),
    ]);
    return rows.map((row) => ({
      ...row,
      available:
        row.enabled &&
        (row.adapter === 'copilote' || (row.adapter === 'relay_mcp' && relayTokens.length > 0)),
    }));
  }

  async createHiveRuntime(
    authId: string,
    input: {
      name: string;
      model: string;
      harness: string;
      adapter: 'copilote' | 'relay_mcp' | 'external';
      modalities: string[];
      capabilities: string[];
      quality: number;
      cost: number;
      latency: number;
      privacy: HiveRuntime['privacy'];
      entitlement: HiveRuntime['entitlement'];
      configuration?: Record<string, unknown>;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const forbidden = Object.keys(input.configuration ?? {}).some((key) =>
      /(secret|token|password|api.?key)/i.test(key),
    );
    if (forbidden)
      throw new BadRequestException(
        'Les secrets doivent être placés dans le coffre, jamais dans un runtime.',
      );
    return (
      await this.db
        .insert(hiveRuntimes)
        .values({ ...input, profileId })
        .returning()
    )[0]!;
  }

  async setHiveRuntimeEnabled(authId: string, id: string, enabled: boolean) {
    const profileId = await this.profileIdForAuth(authId);
    const row = (
      await this.db
        .update(hiveRuntimes)
        .set({ enabled, updatedAt: new Date() })
        .where(and(eq(hiveRuntimes.id, id), eq(hiveRuntimes.profileId, profileId)))
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Runtime introuvable.');
    return row;
  }

  async executeHiveRuntime(
    authId: string,
    input: {
      capability: string;
      prompt: string;
      modality?: string;
      allowedPrivacy?: HiveRuntime['privacy'][];
      availableEntitlements?: HiveRuntime['entitlement'][];
      channel?: 'direct' | 'messages' | 'email' | 'push' | 'voice';
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const listed = await this.listHiveRuntimes(authId);
    const selected = selectHiveRuntime(
      {
        capability: input.capability,
        modality: input.modality,
        allowedPrivacy: input.allowedPrivacy,
        availableEntitlements: input.availableEntitlements,
      },
      listed.map((row) => ({
        id: row.id,
        model: row.model,
        harness: row.harness,
        modalities: row.modalities,
        capabilities: row.capabilities,
        quality: row.quality,
        cost: row.cost,
        latency: row.latency,
        privacy: row.privacy as HiveRuntime['privacy'],
        entitlement: row.entitlement as HiveRuntime['entitlement'],
        available: row.available,
      })),
    );
    if (!selected)
      throw new BadRequestException('Aucun couple modèle+harness disponible pour cette capacité.');
    const runtime = listed.find((row) => row.id === selected.id)!;
    const configuredCompute = await this.continuity.listComputeResources(authId);
    const allowedLocality: HiveComputeResource['locality'][] =
      runtime.privacy === 'local'
        ? ['local']
        : runtime.privacy === 'private_cloud'
          ? ['local', 'private_cloud']
          : ['local', 'private_cloud', 'public_cloud'];
    const computeResource = selectComputeResource(
      {
        modality: input.modality ?? runtime.modalities[0] ?? 'text',
        allowedLocality,
      },
      configuredCompute as HiveComputeResource[],
    );
    const hasSchedulableCompute = configuredCompute.some(
      (resource) => resource.enabled && resource.health === 'healthy',
    );
    if (hasSchedulableCompute && !computeResource)
      throw new BadRequestException(
        'Aucune ressource de calcul saine et compatible avec la modalité et la confidentialité.',
      );
    let output: string;
    let status: 'completed' | 'queued';
    let toolsUsed: string[] = [];
    if (runtime.adapter === 'relay_mcp') {
      await this.relaySay(authId, input.prompt);
      output = 'La tâche a été transmise à ton agent de code. Il te répondra dans Messages.';
      status = 'queued';
    } else if (runtime.adapter === 'copilote') {
      const result = await this.copilote.runWithTools(profileId, {
        system:
          'Tu es un membre de la Ruche Dowze. Exécute précisément la tâche dans ton domaine et réponds avec des faits vérifiables. Respecte le canal demandé.',
        prompt: input.prompt,
        tools: buildAgentTools({
          copilote: this.copilote,
          profileId,
          memorySearch: (query) =>
            this.continuity.searchMemoryForProfile(profileId, query, 8, null),
        }),
        maxSteps: 5,
        modelId:
          typeof (runtime.configuration as Record<string, unknown>)?.modelId === 'string'
            ? ((runtime.configuration as Record<string, unknown>).modelId as string)
            : runtime.model,
        ref: `hive-runtime:${runtime.id}`,
      });
      output = result.text;
      toolsUsed = result.toolsUsed;
      status = 'completed';
    } else {
      throw new BadRequestException(
        'Ce runtime est déclaré mais aucun adaptateur exécutable n’est encore installé.',
      );
    }
    const rendered = renderForChannel(input.channel ?? 'messages', {
      content: output,
      companionName: 'Dowze',
    });
    await this.continuity.recordForProfile(profileId, [
      {
        kind: `runtime.${status}`,
        content: rendered,
        channel: input.channel ?? 'messages',
        importance: 0.75,
        metadata: {
          runtimeId: runtime.id,
          model: runtime.model,
          harness: runtime.harness,
          adapter: runtime.adapter,
          capability: input.capability,
          toolsUsed,
          computeResourceId: computeResource?.id,
          computeLocality: computeResource?.locality,
        },
      },
    ]);
    return { status, output: rendered, runtime, computeResource, toolsUsed };
  }

  // ---------- PONT IA (ChatGPT/Claude) : capter → SYNTHÉTISER (Mémorialiste) → réinjecter ----------
  // Boucle 100 % Dowze pour l'élève : l'app capte la conversation ChatGPT/Claude, une abeille la synthétise
  // (enlève l'inutile), et Dowze prépare/réinjecte automatiquement le contexte. Zéro copier-coller.
  // Cf. docs/13-COMPAGNON/05-pont-webview-tauri.md. INDÉPENDANT du moteur navigateur (Phase 1).

  private static readonly BRIDGE_SPACE_NAME = 'Conversations IA';

  /** Garantit le compagnon-pont (« Pont IA ») — un seul par profil, réservé système (comme le relais). */
  private async ensureBridgeAgent(profileId: string): Promise<string> {
    // Le Pont IA est une ABEILLE d'OPEN-SPACE (pas un leader de la Maison) : sa place est dans l'ÉCOLE
    // (l'open-space de service Académie), aux côtés des profs. Repli sur un open-space « Cours & École » si
    // l'école n'est pas encore provisionnée — mais JAMAIS la Maison ('home').
    const ecole = (
      await this.db
        .select({ id: companionSpaces.id })
        .from(companionSpaces)
        .where(
          and(eq(companionSpaces.profileId, profileId), eq(companionSpaces.ownerKind, 'service')),
        )
        .limit(1)
    )[0];
    const spaceId = ecole?.id ?? (await this.ensureSpaceByName(profileId, 'Cours & École'));

    const existing = (
      await this.db
        .select({ id: companionAgents.id, space: companionAgents.space })
        .from(companionAgents)
        .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.mode, 'bridge')))
    )[0];
    if (existing) {
      // Migration : un ancien Pont IA rangé dans la Maison est déplacé dans l'open-space École.
      if (existing.space !== spaceId) {
        const room = await this.pickRoomFor(profileId, spaceId);
        await this.db
          .update(companionAgents)
          .set({ space: spaceId, room, updatedAt: new Date() })
          .where(eq(companionAgents.id, existing.id));
      }
      return existing.id;
    }
    const room = await this.pickRoomFor(profileId, spaceId);
    // Anti-race (index unique partiel mode='bridge', migration 0067) : le perdant du conflit re-lit.
    const row = (
      await this.db
        .insert(companionAgents)
        .values({
          profileId,
          name: 'Pont IA',
          skinUrl: '/pets/bolt.webp',
          size: 96,
          personality: {
            bridge: true,
            description: 'Pont vers ton ChatGPT / Claude : capte et mémorise tes cours.',
            tone: 'concis',
          },
          role: 'Pont ChatGPT/Claude',
          space: spaceId,
          room,
          isPrimary: false,
          mode: 'bridge',
        })
        .onConflictDoNothing()
        .returning()
    )[0];
    if (row) return row.id;
    const again = (
      await this.db
        .select({ id: companionAgents.id })
        .from(companionAgents)
        .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.mode, 'bridge')))
    )[0];
    if (!again) throw new BadRequestException('Création du pont impossible.');
    return again.id;
  }

  /**
   * ② SYNTHÉTISER (abeille « Mémorialiste ») : ingère une conversation ChatGPT/Claude captée, en extrait une
   * synthèse compacte (enlève l'inutile : ce qui a été vu/compris, ce qui a bloqué, où on s'est arrêté), et la
   * stocke en mémoire RAG (embeddée, interrogeable par les abeilles). Renvoie la synthèse.
   */
  async ingestAiConversation(
    authId: string,
    source: string,
    text: string,
  ): Promise<{
    id: string;
    titre: string;
    synthese: string;
    ouOnEnEst: string;
    prochaine: string;
    progressed: { skill: { id: string; title: string }; pMastery: number; resultat: string } | null;
  }> {
    const profileId = await this.profileIdForAuth(authId);
    const raw = (text || '').trim();
    if (raw.length < 20) throw new BadRequestException('Conversation trop courte.');
    const src = source === 'claude' ? 'Claude' : source === 'chatgpt' ? 'ChatGPT' : 'IA';
    await this.ensureBridgeAgent(profileId);
    const spaceId = await this.ensureSpaceByName(profileId, CompanionService.BRIDGE_SPACE_NAME);

    // Compétence de cours en cours (déterministe, 0 LLM) → sert au Mémorialiste à juger si la conversation
    // travaille bien CETTE compétence, et à faire progresser la maîtrise (BKT) le cas échéant.
    // ⚠️ Sur le PROFIL ÉLÈVE (learner_rank), pas le profil compagnon — sinon mauvais parcours (audit 08-2026).
    const studentId = await this.studentProfileIdForAuth(authId);
    const course = await this.copilote
      .compose(studentId)
      .catch(() => ({ skill: null as { id: string; slug: string; title: string } | null }));
    const skill = course.skill;

    // Longues conversations : plutôt que de tronquer (on perdrait la FIN = où on en est), on condense
    // début + fin (le milieu compte le moins pour reprendre le fil).
    const condensed =
      raw.length <= 14000
        ? raw
        : `${raw.slice(0, 4000)}\n\n[…partie centrale de la conversation omise…]\n\n${raw.slice(-9500)}`;

    // Le Mémorialiste : LLM structuré qui NETTOIE et RÉSUME (réutilise la plomberie generateStructured).
    const { object: mem } = await this.copilote.generateStructured(profileId, {
      schema: z.object({
        titre: z.string().describe('Titre court de la session (≤ 8 mots).'),
        synthese: z
          .string()
          .describe(
            'Synthèse compacte et utile de ce qui a été fait/appris (3 à 6 phrases), SANS le superflu (politesses, digressions, redites).',
          ),
        vu: z.array(z.string()).describe('Points/notions réellement vus ou travaillés.'),
        bloque: z.array(z.string()).describe('Points de blocage, erreurs, incompréhensions.'),
        ouOnEnEst: z.string().describe('Où l’élève s’est arrêté précisément.'),
        prochaine: z.string().describe('La prochaine étape logique.'),
        competenceTravaillee: z
          .boolean()
          .describe(
            skill
              ? `Vrai UNIQUEMENT si la conversation a réellement fait travailler la compétence « ${skill.title} » (pas juste l'évoquer).`
              : 'Toujours faux (aucune compétence de cours prescrite).',
          ),
        resultat: z
          .enum(['maitrise', 'progres', 'bloque'])
          .describe(
            'Résultat sur cette compétence : maitrise (démontrée), progres (avance mais pas acquis), bloque (bloqué/erreurs).',
          ),
      }),
      schemaName: 'MemorialisteSynthese',
      system: `Tu es le « Mémorialiste » de l'élève : tu lis une conversation avec ${src} et tu en fais une MÉMOIRE propre et compacte pour Dowze. Enlève TOUT l'inutile (salutations, digressions, redites, méta). Garde ce qui sert à reprendre plus tard : ce qui a été vu/compris, ce qui a bloqué, où on s'est arrêté, la suite. Évalue HONNÊTEMENT la maîtrise : ne mets « maitrise » que si l'élève a vraiment démontré comprendre. Français, factuel, dense.`,
      prompt: `${skill ? `Compétence de cours visée : « ${skill.title} ».\n\n` : ''}Conversation (${src}) à synthétiser :\n${condensed}`,
      temperature: 0.2,
    });

    const titre = (mem.titre || `Session ${src}`).slice(0, 160);
    const content = [
      mem.synthese,
      mem.vu?.length ? `Vu : ${mem.vu.join(' ; ')}` : '',
      mem.bloque?.length ? `Bloqué : ${mem.bloque.join(' ; ')}` : '',
      `Où on en est : ${mem.ouOnEnEst}`,
      `Prochaine étape : ${mem.prochaine}`,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 8000);

    const row = (
      await this.db
        .insert(companionSpaceKnowledge)
        .values({ profileId, space: spaceId, title: titre, content })
        .returning({ id: companionSpaceKnowledge.id })
    )[0]!;
    // Embedding en tâche de fond → interrogeable par les abeilles (orgSearch).
    void this.copilote
      .embed(profileId, [`${titre}. ${content}`.slice(0, 2000)])
      .then((v) => this.storeKnowledgeEmbedding(row.id, v?.[0]))
      .catch(() => undefined);

    // Progression : si la conversation a VRAIMENT fait travailler la compétence de cours, Dowze RECALCULE la
    // maîtrise (BKT) + carnet + FSRS — discuter avec ChatGPT/Claude fait donc progresser le niveau dans Dowze.
    let progressed: {
      skill: { id: string; title: string };
      pMastery: number;
      resultat: string;
    } | null = null;
    if (skill && mem.competenceTravaillee) {
      try {
        const note = `Session ${src} : ${mem.ouOnEnEst}`.slice(0, 500);
        const { pMastery } = await this.copilote.applyProgress(
          studentId,
          skill.id,
          mem.resultat,
          note,
        );
        progressed = {
          skill: { id: skill.id, title: skill.title },
          pMastery,
          resultat: mem.resultat,
        };
      } catch {
        /* la maîtrise n'a pas pu être mise à jour : la mémoire RAG reste, elle */
      }
    }

    // Trace dans le fil du compagnon-pont (visible au téléphone).
    const bridgeId = await this.ensureBridgeAgent(profileId);
    const trace = progressed
      ? `Session ${src} mémorisée : ${titre}. Maîtrise de « ${progressed.skill.title} » mise à jour (${Math.round(progressed.pMastery * 100)}%).`
      : `Session ${src} mémorisée : ${titre}.`;
    await this.db
      .insert(companionMessages)
      .values({ profileId, agentId: bridgeId, sender: 'agent', text: trace.slice(0, 4000) })
      .catch(() => undefined);
    await this.continuity
      .recordForProfile(profileId, [
        {
          kind: 'bridge.conversation.ingested',
          content,
          channel: 'system',
          actorAgentId: bridgeId,
          space: spaceId,
          importance: 0.9,
          metadata: {
            source: src,
            title: titre,
            next: mem.prochaine,
            progressed,
            knowledgeId: row.id,
          },
        },
      ])
      .catch(() => undefined);

    return {
      id: row.id,
      titre,
      synthese: mem.synthese,
      ouOnEnEst: mem.ouOnEnEst,
      prochaine: mem.prochaine,
      progressed,
    };
  }

  /**
   * ③ RÉINJECTER : construit le prompt de contexte à coller AUTOMATIQUEMENT dans une nouvelle session
   * ChatGPT/Claude = contexte pédagogique (`compose`) + la dernière synthèse mémorisée (« où on en était »).
   */
  async getBridgeContext(authId: string): Promise<{
    prompt: string;
    skill: { id: string; slug: string; title: string } | null;
    hasMemory: boolean;
  }> {
    const profileId = await this.profileIdForAuth(authId);
    const spaceId = await this.ensureSpaceByName(profileId, CompanionService.BRIDGE_SPACE_NAME);
    const last = (
      await this.db
        .select({ title: companionSpaceKnowledge.title, content: companionSpaceKnowledge.content })
        .from(companionSpaceKnowledge)
        .where(
          and(
            eq(companionSpaceKnowledge.profileId, profileId),
            eq(companionSpaceKnowledge.space, spaceId),
          ),
        )
        .orderBy(desc(companionSpaceKnowledge.createdAt))
        .limit(1)
    )[0];
    // Le contexte de cours vient du PROFIL ÉLÈVE (learner_rank), pas du profil compagnon (audit 08-2026).
    const studentId = await this.studentProfileIdForAuth(authId);
    const course = await this.copilote.compose(studentId).catch(() => ({
      prompt: '',
      skill: null as { id: string; slug: string; title: string } | null,
    }));
    const parts: string[] = [];
    if (course.prompt) parts.push(course.prompt);
    if (last)
      parts.push(
        `--- OÙ ON EN ÉTAIT (mémoire Dowze de tes sessions précédentes) ---\n${last.content}`,
      );
    else parts.push('--- Première session : pas encore de mémoire. ---');
    parts.push(
      'Reprends à partir de ce contexte et aide l’élève à continuer son cours. Réponds directement, sans reformuler ce contexte.',
    );
    return { prompt: parts.join('\n\n'), skill: course.skill, hasMemory: !!last };
  }

  /** État du pont : dernières synthèses mémorisées (pour l'UI). */
  async bridgeState(
    authId: string,
  ): Promise<{ id: string; title: string; preview: string; at: number }[]> {
    const profileId = await this.profileIdForAuth(authId);
    const spaceId = await this.ensureSpaceByName(profileId, CompanionService.BRIDGE_SPACE_NAME);
    const rows = await this.db
      .select({
        id: companionSpaceKnowledge.id,
        title: companionSpaceKnowledge.title,
        content: companionSpaceKnowledge.content,
        createdAt: companionSpaceKnowledge.createdAt,
      })
      .from(companionSpaceKnowledge)
      .where(
        and(
          eq(companionSpaceKnowledge.profileId, profileId),
          eq(companionSpaceKnowledge.space, spaceId),
        ),
      )
      .orderBy(desc(companionSpaceKnowledge.createdAt))
      .limit(50);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      preview: r.content.slice(0, 140),
      at: r.createdAt.getTime(),
    }));
  }

  // ---------- Espaces (open-spaces ; la Maison 'home' est implicite) ----------

  async listSpaces(
    authId: string,
  ): Promise<{ id: string; name: string; type: string; mission: string | null }[]> {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select({
        id: companionSpaces.id,
        name: companionSpaces.name,
        type: companionSpaces.type,
        mission: companionSpaces.mission,
      })
      .from(companionSpaces)
      .where(eq(companionSpaces.profileId, profileId))
      .orderBy(asc(companionSpaces.createdAt));
  }

  /** Catalogue de templates d'organisation (pour le front : choix du type d'open-space). */
  listOrgTemplates(): OrgTemplate[] {
    return ORG_TEMPLATES;
  }

  private packageChecksum(manifest: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  }

  private async seedBuiltinSpacePackages(profileId: string): Promise<void> {
    for (const template of ORG_TEMPLATES) {
      const manifest = {
        schemaVersion: 1,
        type: template.type,
        mission: template.defaultMission,
        building: { kind: 'isometric', rooms: ['travail', 'réunion', 'repos', 'cantine'] },
        roles: template.roles,
        capabilities: template.roles.flatMap((key) => roleByKey(key)?.produces ?? []),
        workflows: ['plan', 'execute', 'qa', 'report'],
        permissions: { memoryScope: 'space', vault: 'approval_required' },
      };
      await this.db
        .insert(hiveSpacePackages)
        .values({
          profileId,
          key: template.key,
          name: template.label,
          description: template.defaultMission,
          visibility: 'official',
          manifest,
          checksum: this.packageChecksum(manifest),
        })
        .onConflictDoNothing();
    }
  }

  async listSpacePackages(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    await this.seedBuiltinSpacePackages(profileId);
    return this.db
      .select()
      .from(hiveSpacePackages)
      .where(and(eq(hiveSpacePackages.profileId, profileId), eq(hiveSpacePackages.enabled, true)))
      .orderBy(asc(hiveSpacePackages.name));
  }

  async publishSpacePackage(
    authId: string,
    input: {
      key: string;
      name: string;
      version: string;
      description?: string;
      manifest: Record<string, unknown>;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    return (
      await this.db
        .insert(hiveSpacePackages)
        .values({
          profileId,
          key: input.key,
          name: input.name,
          version: input.version,
          description: input.description ?? '',
          visibility: 'private',
          manifest: input.manifest,
          checksum: this.packageChecksum(input.manifest),
        })
        .returning()
    )[0]!;
  }

  async installSpacePackage(
    authId: string,
    packageId: string,
    input: { mode: 'join' | 'create'; name?: string },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const pkg = (
      await this.db
        .select()
        .from(hiveSpacePackages)
        .where(
          and(
            eq(hiveSpacePackages.id, packageId),
            eq(hiveSpacePackages.profileId, profileId),
            eq(hiveSpacePackages.enabled, true),
          ),
        )
    )[0];
    if (!pkg) throw new NotFoundException('Package d’espace introuvable.');
    if (input.mode === 'join' && !['official', 'shared'].includes(pkg.visibility))
      throw new BadRequestException('Un package privé doit être installé en mode création.');
    if (this.packageChecksum(pkg.manifest as Record<string, unknown>) !== pkg.checksum)
      throw new BadRequestException('Le manifeste du package a été altéré.');
    const manifest = pkg.manifest as {
      type?: string;
      mission?: string;
      roles?: string[];
    };
    const template = templateByKey(pkg.key);
    const space = await this.createSpace(authId, input.name ?? pkg.name, {
      type: manifest.type,
      template: template?.key,
      mission: manifest.mission,
    });
    if (!template && manifest.roles?.length) {
      for (const roleKey of manifest.roles.slice(0, 50)) {
        const preset = roleByKey(roleKey);
        if (preset) await this.seedRoleAgent(profileId, space.id, preset);
      }
    }
    if (input.mode === 'join')
      await this.db
        .update(companionSpaces)
        .set({ ownerKind: 'service' })
        .where(eq(companionSpaces.id, space.id));
    const installation = (
      await this.db
        .insert(hiveSpaceInstallations)
        .values({
          profileId,
          packageId: pkg.id,
          spaceId: space.id,
          mode: input.mode,
          installedVersion: pkg.version,
          configuration: { checksum: pkg.checksum },
        })
        .returning()
    )[0]!;
    return { space, installation };
  }

  /** Seede un agent-employé depuis un preset de rôle (déterministe, sans appel IA — rapide et gratuit). */
  private async seedRoleAgent(profileId: string, space: string, preset: RolePreset): Promise<void> {
    const personality = {
      tone: 'pro',
      traits: preset.traits,
      description: preset.title,
      systemPrompt: preset.systemPromptSeed,
      greeting: `Bonjour, moi c'est ${preset.title}.`,
    };
    const room = await this.pickRoomFor(profileId, space);
    const now = new Date();
    const row = (
      await this.db
        .insert(companionAgents)
        .values({
          profileId,
          name: preset.title.slice(0, 40),
          skinUrl: `/pets/${preset.skinSlug}.webp`, // relatif → same-origin sur n'importe quel hôte
          size: 96,
          personality,
          role: preset.title.slice(0, 60),
          roleKey: preset.key,
          roleContract: roleContractOf(preset),
          space: space.slice(0, 60),
          room,
          isPrimary: false,
          mode: 'agent',
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];
    // Embedding en tâche de fond (ne bloque pas la création de l'entreprise).
    if (row)
      void this.embedAgent(profileId, row.id, row.name, row.role, preset.systemPromptSeed).catch(
        () => undefined,
      );
  }

  /** Crée un open-space = organisation (type + mission) et PEUPLE son effectif depuis le template. */
  async createSpace(
    authId: string,
    name: string,
    opts?: { type?: string; template?: string; mission?: string },
  ): Promise<{ id: string; name: string }> {
    const profileId = await this.profileIdForAuth(authId);
    const tpl = templateByKey(opts?.template);
    const type = (opts?.type ?? tpl?.type ?? 'custom').slice(0, 20);
    const mission = (opts?.mission ?? tpl?.defaultMission ?? null)?.slice(0, 500) ?? null;
    const row = (
      await this.db
        .insert(companionSpaces)
        .values({
          profileId,
          name: (name || 'Open space').slice(0, 40),
          type,
          template: opts?.template ?? null,
          mission,
          ownerKind: 'user',
        })
        .returning({ id: companionSpaces.id, name: companionSpaces.name })
    )[0];
    if (!row) throw new BadRequestException('Création impossible.');
    // Peuple l'effectif (un agent-employé par rôle du template).
    if (tpl && tpl.roles.length) {
      for (const roleKey of tpl.roles) {
        const preset = roleByKey(roleKey);
        if (preset) await this.seedRoleAgent(profileId, row.id, preset);
      }
    }
    return row;
  }

  /**
   * Auto-provisionne l'org de SERVICE d'un élève quand il « rejoint » un service Dowze.
   * Aujourd'hui : `academie` → une ÉCOLE (open-space `ownerKind='service'`) peuplée d'un
   * Directeur + un Prof par discipline + un Évaluateur, CALIBRÉS sur le RANG de l'élève.
   * Idempotent : créée une fois (index unique partiel), puis re-calibrée si le rang a changé
   * (ré-écrit les personas au bon niveau, ajoute les profs manquants, sans perdre les règles apprises).
   * Ne provisionne QUE les élèves de l'Académie (présence d'un `learner_rank`).
   */
  async ensureServiceOrg(
    authId: string,
    service = 'academie',
  ): Promise<{ id: string; name: string; type: string; mission: string | null } | null> {
    if (service !== 'academie') throw new BadRequestException('Service inconnu.');
    const profileId = await this.profileIdForAuth(authId);
    // Le rang de l'élève peut vivre sur un AUTRE profil du même compte (le compagnon est sur le 1er
    // profil, le parcours Académie parfois sur un autre) → on cherche le rang sur TOUT le compte.
    const prof = (
      await this.db
        .select({ accountId: profiles.accountId })
        .from(profiles)
        .where(eq(profiles.id, profileId))
    )[0];
    if (!prof) return null;
    // Le rang ET le parcours (mastery/spé) peuvent vivre sur un AUTRE profil du même compte → on identifie
    // le PROFIL ÉLÈVE (celui qui porte le learner_rank) pour lire ses vraies connaissances.
    const rankRow = (
      await this.db
        .select({ rank: learnerRank.rank, studentId: learnerRank.profileId })
        .from(learnerRank)
        .innerJoin(profiles, eq(profiles.id, learnerRank.profileId))
        .where(eq(profiles.accountId, prof.accountId))
        .orderBy(desc(learnerRank.rank))
        .limit(1)
    )[0];
    // Pas de rang nulle part → pas encore élève de l'Académie → on ne provisionne pas.
    if (!rankRow) return null;
    const rank = rankRow.rank ?? 1;
    const rm = rankMeta(rank);
    const marker = 'service:academie';
    const name = `École Dowze — ${rm.name}`.slice(0, 40);
    const mission =
      `École Dowze de l'élève, niveau ${rm.name} ${rm.eq}. Un directeur, un évaluateur, et un enseignant recruté pour CHAQUE matière que l'élève travaille (créés automatiquement selon ses besoins).`.slice(
        0,
        500,
      );
    // EFFECTIF DYNAMIQUE : administration fixe (Directeur + Évaluateur) + un prof PAR DISCIPLINE réellement
    // active (spécialisations + compétences en cours) → l'école recrute selon les besoins/connaissances/niveau.
    const disciplines = await this.activeDisciplinesForStudent(rankRow.studentId);
    const staff: RolePreset[] = [
      ...academieAdmin(rank),
      ...disciplines.map((d) => academieTeacher(d, rank)),
    ];

    // Création atomique (idempotente via l'index unique partiel owner_kind='service').
    const created = (
      await this.db
        .insert(companionSpaces)
        .values({
          profileId,
          name,
          type: 'school',
          template: marker,
          mission,
          ownerKind: 'service',
        })
        .onConflictDoNothing()
        .returning({ id: companionSpaces.id, name: companionSpaces.name })
    )[0];
    if (created) {
      for (const preset of staff) await this.seedRoleAgent(profileId, created.id, preset);
      return { id: created.id, name: created.name, type: 'school', mission };
    }

    // Existe déjà → re-calibrer au rang courant.
    const existing = (
      await this.db
        .select({
          id: companionSpaces.id,
          name: companionSpaces.name,
          mission: companionSpaces.mission,
        })
        .from(companionSpaces)
        .where(
          and(
            eq(companionSpaces.profileId, profileId),
            eq(companionSpaces.template, marker),
            eq(companionSpaces.ownerKind, 'service'),
          ),
        )
    )[0];
    if (!existing) return null;
    if (existing.name !== name || existing.mission !== mission) {
      await this.db
        .update(companionSpaces)
        .set({ name, mission, type: 'school' })
        .where(eq(companionSpaces.id, existing.id));
    }
    // Agents en place (par roleKey) → ajoute les manquants, re-calibre les personas au bon niveau (garde les règles apprises).
    const rows = await this.db
      .select({
        id: companionAgents.id,
        roleKey: companionAgents.roleKey,
        name: companionAgents.name,
        personality: companionAgents.personality,
      })
      .from(companionAgents)
      .where(
        and(
          eq(companionAgents.profileId, profileId),
          eq(companionAgents.space, existing.id),
          eq(companionAgents.status, 'active'),
        ),
      );
    const byKey = new Map(rows.filter((r) => r.roleKey).map((r) => [r.roleKey as string, r]));
    for (const preset of staff) {
      const a = byKey.get(preset.key);
      if (!a) {
        await this.seedRoleAgent(profileId, existing.id, preset);
        continue;
      }
      const prev = (a.personality ?? {}) as Record<string, unknown>;
      // Ne recalibre que si le RANG a changé (audit 08-2026) : comparer au prompt-seed écrasait le
      // ré-entraînement (`retrainAgent` modifie précisément `systemPrompt`) à chaque passage.
      if (prev.seedRank !== rank) {
        await this.db
          .update(companionAgents)
          .set({
            name: preset.title.slice(0, 40),
            role: preset.title.slice(0, 60),
            roleContract: roleContractOf(preset),
            personality: {
              ...prev,
              systemPrompt: preset.systemPromptSeed,
              description: preset.title,
              seedRank: rank,
            },
            updatedAt: new Date(),
          })
          .where(eq(companionAgents.id, a.id));
      }
    }
    return { id: existing.id, name, type: 'school', mission };
  }

  /**
   * Disciplines réellement ACTIVES d'un élève (pour recruter les profs selon SES besoins/connaissances) :
   * spécialisations choisies (direction) + disciplines des compétences EN COURS (0.15 < p_mastery < 0.95,
   * cf. seuils du système éducatif). 'Fondations' (socle non-disciplinaire) exclu.
   */
  private async activeDisciplinesForStudent(studentProfileId: string): Promise<string[]> {
    const set = new Set<string>();
    // 1) Spécialisations choisies = direction/intérêt fort (signal explicite de besoin).
    const specs = await this.db
      .select({ d: specializations.discipline })
      .from(specializations)
      .where(
        and(eq(specializations.profileId, studentProfileId), eq(specializations.status, 'active')),
      );
    for (const s of specs) if (s.d) set.add(s.d);
    // 2) Disciplines des compétences EN COURS (récemment travaillées d'abord) = ce que l'élève apprend là.
    const rows = await this.db
      .select({ slug: skills.slug })
      .from(masteryStates)
      .innerJoin(skills, eq(skills.id, masteryStates.skillId))
      .where(
        and(
          eq(masteryStates.profileId, studentProfileId),
          gt(masteryStates.pMastery, 0.15),
          lt(masteryStates.pMastery, 0.95),
        ),
      )
      .orderBy(desc(masteryStates.lastUpdated))
      .limit(120);
    for (const r of rows) {
      const d = disciplineOf(r.slug);
      if (d && d !== 'Fondations') set.add(d);
    }
    return [...set];
  }

  /**
   * RECRUTEMENT RÉACTIF (école) : quand l'élève POSE une question, on classe la question dans les
   * matières de l'école et on CRÉE le prof manquant pour chaque discipline concernée (avant que le
   * Directeur ne délègue). Complète le recrutement proactif basé sur l'état d'apprentissage.
   */
  private async recruitTeachersForQuestion(
    profileId: string,
    spaceId: string,
    message: string,
  ): Promise<void> {
    // Rang de l'élève (compte-wide, comme l'auto-provision) pour calibrer le prof créé.
    const prof = (
      await this.db
        .select({ accountId: profiles.accountId })
        .from(profiles)
        .where(eq(profiles.id, profileId))
    )[0];
    if (!prof) return;
    const rankRow = (
      await this.db
        .select({ rank: learnerRank.rank })
        .from(learnerRank)
        .innerJoin(profiles, eq(profiles.id, learnerRank.profileId))
        .where(eq(profiles.accountId, prof.accountId))
        .orderBy(desc(learnerRank.rank))
        .limit(1)
    )[0];
    const rank = rankRow?.rank ?? 1;
    // Classe la question dans 0 à 2 disciplines PARMI les 11 (température 0 = déterministe).
    let disciplines: string[] = [];
    try {
      const { object } = await this.copilote.generateStructured(profileId, {
        schema: z.object({
          disciplines: z
            .array(z.string())
            .describe(
              '0 à 2 matières concernées, choisies EXACTEMENT dans la liste. Vide si la question ne relève d’aucune matière scolaire.',
            ),
        }),
        schemaName: 'QuestionDisciplines',
        system: `Tu classes une question d'élève dans les matières de l'école. Matières possibles (choisis EXACTEMENT parmi elles, à l'identique) : ${DISCIPLINES.join(', ')}. Renvoie 0 à 2 matières réellement concernées.`,
        prompt: message.slice(0, 500),
        temperature: 0,
      });
      disciplines = (object.disciplines || [])
        .filter((d) => (DISCIPLINES as readonly string[]).includes(d))
        .slice(0, 2);
    } catch {
      return;
    }
    if (!disciplines.length) return;
    // Profs déjà présents (par roleKey) → on ne crée que les manquants.
    const present = new Set(
      (
        await this.db
          .select({ roleKey: companionAgents.roleKey })
          .from(companionAgents)
          .where(
            and(
              eq(companionAgents.profileId, profileId),
              eq(companionAgents.space, spaceId),
              eq(companionAgents.status, 'active'),
            ),
          )
      )
        .map((r) => r.roleKey)
        .filter((k): k is string => !!k),
    );
    for (const d of disciplines) {
      if (!present.has(teacherRoleKey(d)))
        await this.seedRoleAgent(profileId, spaceId, academieTeacher(d, rank));
    }
  }

  async renameSpace(
    authId: string,
    id: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const profileId = await this.profileIdForAuth(authId);
    const res = await this.db
      .update(companionSpaces)
      .set({ name: name.slice(0, 40) })
      .where(and(eq(companionSpaces.id, id), eq(companionSpaces.profileId, profileId)))
      .returning({ id: companionSpaces.id, name: companionSpaces.name });
    if (!res[0]) throw new NotFoundException('Espace introuvable.');
    return res[0];
  }

  /** Supprime un espace ET les compagnons qui y vivent. Les orgs de SERVICE (école Académie) sont protégées. */
  async deleteSpace(authId: string, id: string): Promise<{ ok: true }> {
    const profileId = await this.profileIdForAuth(authId);
    const sp = (
      await this.db
        .select({ ownerKind: companionSpaces.ownerKind })
        .from(companionSpaces)
        .where(and(eq(companionSpaces.id, id), eq(companionSpaces.profileId, profileId)))
    )[0];
    if (sp?.ownerKind === 'service')
      throw new BadRequestException('Cet espace de service Dowze ne peut pas être supprimé.');
    await this.db
      .delete(companionAgents)
      .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.space, id)));
    await this.db
      .delete(companionSpaceKnowledge)
      .where(
        and(
          eq(companionSpaceKnowledge.profileId, profileId),
          eq(companionSpaceKnowledge.space, id),
        ),
      );
    await this.db
      .delete(companionSpaces)
      .where(and(eq(companionSpaces.id, id), eq(companionSpaces.profileId, profileId)));
    return { ok: true };
  }

  // ---------- P3 : RAG PAR ORGANISATION (base de connaissances scopée à un open-space) ----------

  private async storeKnowledgeEmbedding(id: string, vec: number[] | undefined): Promise<void> {
    if (!Array.isArray(vec) || vec.length !== HIVE_EMBED_DIM) return;
    const lit = `[${vec.join(',')}]`;
    await this.db
      .execute(
        sql`update companion_space_knowledge set embedding_vec = ${lit}::vector where id = ${id}`,
      )
      .catch(() => undefined);
  }

  private async storeChunkEmbedding(id: string, vec: number[] | undefined): Promise<void> {
    if (!Array.isArray(vec) || vec.length !== HIVE_EMBED_DIM) return;
    const lit = `[${vec.join(',')}]`;
    await this.db
      .execute(
        sql`update companion_space_knowledge_chunks set embedding_vec = ${lit}::vector where id = ${id}`,
      )
      .catch(() => undefined);
  }

  /** Ajoute une connaissance (document/fait/règle) à la base d'un open-space = organisation. */
  async addSpaceKnowledge(
    authId: string,
    spaceId: string,
    title: string,
    content: string,
  ): Promise<{ id: string; title: string; chunks: number }> {
    const profileId = await this.profileIdForAuth(authId);
    const space = (
      await this.db
        .select({ id: companionSpaces.id })
        .from(companionSpaces)
        .where(and(eq(companionSpaces.id, spaceId), eq(companionSpaces.profileId, profileId)))
    )[0];
    if (!space) throw new NotFoundException('Espace introuvable.');
    const t = title.trim().slice(0, 160);
    const c = content.trim().slice(0, 120_000);
    if (!c) throw new BadRequestException('Contenu vide.');
    const row = (
      await this.db
        .insert(companionSpaceKnowledge)
        .values({ profileId, space: spaceId, title: t || c.slice(0, 60), content: c })
        .returning({ id: companionSpaceKnowledge.id, title: companionSpaceKnowledge.title })
    )[0]!;
    const chunks = chunkKnowledgeDocument(c);
    const chunkRows = chunks.length
      ? await this.db
          .insert(companionSpaceKnowledgeChunks)
          .values(
            chunks.map((chunk, chunkIndex) => ({
              knowledgeId: row.id,
              profileId,
              space: spaceId,
              chunkIndex,
              content: chunk.content,
              startOffset: chunk.startOffset,
              endOffset: chunk.endOffset,
            })),
          )
          .returning({
            id: companionSpaceKnowledgeChunks.id,
            content: companionSpaceKnowledgeChunks.content,
          })
      : [];
    // Embeddings en tâche de fond (le repli lexical rend le document disponible immédiatement).
    void this.copilote
      .embed(
        profileId,
        chunkRows.map((chunk) => `${row.title}. ${chunk.content}`.slice(0, 2000)),
      )
      .then(async (vectors) => {
        if (!vectors) return;
        await Promise.all(
          chunkRows.map((chunk, index) => this.storeChunkEmbedding(chunk.id, vectors[index])),
        );
        await this.storeKnowledgeEmbedding(row.id, vectors[0]);
      })
      .catch(() => undefined);
    return { ...row, chunks: chunkRows.length };
  }

  /** Liste les connaissances d'un open-space (aperçu du contenu). */
  async listSpaceKnowledge(
    authId: string,
    spaceId: string,
  ): Promise<{ id: string; title: string; preview: string; at: number }[]> {
    const profileId = await this.profileIdForAuth(authId);
    const rows = await this.db
      .select({
        id: companionSpaceKnowledge.id,
        title: companionSpaceKnowledge.title,
        content: companionSpaceKnowledge.content,
        createdAt: companionSpaceKnowledge.createdAt,
      })
      .from(companionSpaceKnowledge)
      .where(
        and(
          eq(companionSpaceKnowledge.profileId, profileId),
          eq(companionSpaceKnowledge.space, spaceId),
        ),
      )
      .orderBy(desc(companionSpaceKnowledge.createdAt))
      .limit(200);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      preview: r.content.slice(0, 140),
      at: r.createdAt.getTime(),
    }));
  }

  async deleteSpaceKnowledge(authId: string, id: string): Promise<{ ok: true }> {
    const profileId = await this.profileIdForAuth(authId);
    await this.db
      .delete(companionSpaceKnowledge)
      .where(
        and(eq(companionSpaceKnowledge.id, id), eq(companionSpaceKnowledge.profileId, profileId)),
      );
    return { ok: true };
  }

  /**
   * Recherche RAG dans la base d'UN open-space (scopée → pas de contamination inter-projets).
   * SÉMANTIQUE d'abord (KNN pgvector) ; repli LEXICAL (ILIKE) si pas d'embeddings configurés.
   */
  async searchSpaceKnowledge(
    profileId: string,
    space: string,
    query: string,
    k = 5,
  ): Promise<{ id: string; title: string; content: string; citation: string; score: number }[]> {
    const q = (query || '').trim().slice(0, 300);
    if (!q) return [];
    const qv = (await this.copilote.embed(profileId, [q]).catch(() => null))?.[0];
    if (qv && qv.length === HIVE_EMBED_DIM) {
      const lit = `[${qv.join(',')}]`;
      const rows = (await this.db
        .execute(
          sql`
        select c.id, d.title, c.content, c.chunk_index as "chunkIndex",
          1 - (c.embedding_vec <=> ${lit}::vector) as score
        from companion_space_knowledge_chunks c
        join companion_space_knowledge d on d.id = c.knowledge_id
        where c.profile_id = ${profileId} and c.space = ${space} and c.embedding_vec is not null
        order by c.embedding_vec <=> ${lit}::vector limit ${k}
      `,
        )
        .catch(() => null)) as unknown as
        { id: string; title: string; content: string; chunkIndex: number; score: number }[] | null;
      if (rows && rows.length)
        return rows.map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content.slice(0, 1400),
          citation: `${r.title} §${r.chunkIndex + 1}`,
          score: Number(r.score),
        }));
    }
    // Repli lexical : mots-clés de la requête sur titre/contenu.
    const words = [...new Set(q.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç0-9]{4,}/g) ?? [])].slice(
      0,
      6,
    );
    const conds = words.length
      ? words.flatMap((w) => [
          ilike(companionSpaceKnowledge.title, `%${w}%`),
          ilike(companionSpaceKnowledge.content, `%${w}%`),
        ])
      : [];
    const rows2 = await this.db
      .select({
        id: companionSpaceKnowledgeChunks.id,
        title: companionSpaceKnowledge.title,
        content: companionSpaceKnowledgeChunks.content,
        chunkIndex: companionSpaceKnowledgeChunks.chunkIndex,
      })
      .from(companionSpaceKnowledgeChunks)
      .innerJoin(
        companionSpaceKnowledge,
        eq(companionSpaceKnowledge.id, companionSpaceKnowledgeChunks.knowledgeId),
      )
      .where(
        conds.length
          ? and(
              eq(companionSpaceKnowledgeChunks.profileId, profileId),
              eq(companionSpaceKnowledgeChunks.space, space),
              or(
                ...words.map((word) => ilike(companionSpaceKnowledgeChunks.content, `%${word}%`)),
                ...words.map((word) => ilike(companionSpaceKnowledge.title, `%${word}%`)),
              ),
            )
          : and(
              eq(companionSpaceKnowledgeChunks.profileId, profileId),
              eq(companionSpaceKnowledgeChunks.space, space),
            ),
      )
      .orderBy(desc(companionSpaceKnowledgeChunks.createdAt))
      .limit(Math.min(200, Math.max(k * 20, 20)));
    return rows2
      .map((r) => {
        const body = r.content.toLowerCase();
        const title = r.title.toLowerCase();
        const bodyHits = words.filter((word) => body.includes(word)).length;
        const titleHits = words.filter((word) => title.includes(word)).length;
        return {
          id: r.id,
          title: r.title,
          content: r.content.slice(0, 1400),
          citation: `${r.title} §${r.chunkIndex + 1}`,
          // Le corps vaut quatre fois le titre : un titre partagé ne masque pas le bon fragment.
          score: (bodyHits * 4 + titleHits) / Math.max(1, words.length * 4),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async searchOwnedSpaceKnowledge(authId: string, spaceId: string, query: string, k = 5) {
    const profileId = await this.profileIdForAuth(authId);
    const owned = (
      await this.db
        .select({ id: companionSpaces.id })
        .from(companionSpaces)
        .where(and(eq(companionSpaces.id, spaceId), eq(companionSpaces.profileId, profileId)))
    )[0];
    if (!owned) throw new NotFoundException('Espace introuvable.');
    return this.searchSpaceKnowledge(profileId, spaceId, query, k);
  }
}
