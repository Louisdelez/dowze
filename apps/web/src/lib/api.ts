import type {
  AiEmbeddingModel,
  AiModel,
  BridgeOperation,
  CopiloteSettingsView,
  Dossier,
  ExerciseItem,
  ExpeditionProposal,
  GenerateExercisesRequest,
  LearnerExpedition,
  PhaseGuidance,
  PlacementStep,
  PresentationInput,
  ResultsView,
  RankJumpView,
  SpecializationView,
  SpecializationPlan,
  XpView,
  PeerValidationView,
  ValidationSubject,
  SessionSnapshot,
  TestKind,
  TestResult,
  TestView,
  SocialOverview,
  ConversationSummary,
  ConversationView,
  ChatMessage,
  Friend,
  ModeratorQueue,
  GuardianControls,
  ResetRequest,
  MyClassView,
  AssignResult,
  TranslationResult,
  LanguagesView,
  LanguageCompose,
  LanguageIngestResult,
  LanguageClass,
  ElectiveView,
  ElectiveProposal,
  ElectivePlan,
  DiscoveryDiscipline,
  DailyBudgetView,
  ScheduleView,
  Intensity,
  CourseSheet,
} from '@dowze/schemas';
import { getSupabase } from '@/lib/supabase';
import { aiTask } from '@/lib/companion-bus';

/** Client minimal vers le backend Dowze (l'intra-core). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

/** En-tête d'auth : le jeton d'accès Supabase (l'API le vérifie via SupabaseAuthGuard). */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    return session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...(await authHeaders()) } });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patch2<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface CreateRequestInput {
  operation: BridgeOperation;
  requestId: string;
  seed: string;
  instruction?: string;
}

export function createBridgeRequest(input: CreateRequestInput): Promise<unknown> {
  return post('/bridge/requests', input);
}

export interface ImportResponseInput {
  raw: string;
  expectedRequestId: string;
  expectedOperation: BridgeOperation;
}

export function importBridgeResponse(input: ImportResponseInput): Promise<unknown> {
  return post('/bridge/responses', input);
}

/** Persiste une ossature générée dans le graphe (école générative, validée par clôture). */
export function ingestOssature(skills: unknown): Promise<{ ok: true; added: number }> {
  return post('/skills/ingest', { skills });
}

export interface MasteryRow {
  skillId: string;
  pMastery: number;
  attempts: number;
  correct: number;
}

export function getProgression(profileId: string): Promise<MasteryRow[]> {
  return get(`/progression/${profileId}`);
}

export interface NextSkillRow {
  id: string;
  slug: string;
  title: string;
  depth: number;
}

/** La prochaine compétence prescrite (frontière d'apprentissage), ou null. */
export function getNextSkill(profileId: string): Promise<NextSkillRow | null> {
  return get(`/progression/${profileId}/next`);
}

/** Enregistre une observation (réussite/échec) → met à jour la maîtrise (BKT). */
export function observe(profileId: string, skillId: string, correct: boolean): Promise<MasteryRow> {
  return post('/progression/observe', { profileId, skillId, correct });
}

export interface PlanningEntryRow {
  id: string;
  dateIso: string;
  kind: string;
  skillId: string | null;
  durationMin: number;
  status: string;
}

export interface PlanningResult {
  entries: PlanningEntryRow[];
  unscheduled: unknown[];
}

export function generatePlanning(profileId: string, weekStartIso: string): Promise<PlanningResult> {
  return aiTask({ state: 'organizing', message: 'J’organise ton planning…' }, () =>
    post('/planning/generate', { profileId, weekStartIso }),
  );
}

// --- Niveau & XP ---
export function getXp(profileId: string): Promise<XpView> {
  return get(`/xp/${profileId}`);
}
export function claimDailyXp(profileId: string): Promise<XpView> {
  return post(`/xp/${profileId}/daily`, {});
}
export function heartbeatXp(profileId: string, seconds: number): Promise<XpView> {
  return post(`/xp/${profileId}/active`, { seconds });
}

// --- Validation par les pairs (exposé oral) ---
export function getPeerValidation(profileId: string): Promise<PeerValidationView> {
  return get(`/validation/${profileId}`);
}
export function createValidationSubject(
  profileId: string,
  input: {
    title: string;
    description: string;
    evidenceUrl: string | null;
    format: 'visio' | 'video';
  },
): Promise<PeerValidationView> {
  return post(`/validation/${profileId}/subject`, input);
}
export function reviewValidationSubject(
  profileId: string,
  subjectId: string,
  input: { validated: boolean; stars: number; comment: string },
): Promise<PeerValidationView> {
  return post(`/validation/${profileId}/review/${subjectId}`, input);
}
export function getCommunityValidation(
  profileId: string,
  q: string,
  sort: 'recent' | 'level',
): Promise<ValidationSubject[]> {
  return get(`/validation/${profileId}/community?q=${encodeURIComponent(q)}&sort=${sort}`);
}
export function getValidationSubject(
  profileId: string,
  subjectId: string,
): Promise<ValidationSubject | null> {
  return get(`/validation/${profileId}/subject/${subjectId}`);
}
// Note : aucune fonction pour « devenir prof/modo/staff ». Les rôles staff sont attribués
// manuellement (au cas par cas), jamais via l'application (décision produit).

export interface ClasseRow {
  id: string;
  slug: string;
  name: string;
  locale: string;
  timezone: string;
  type: string;
  status: string;
}
export function listClasses(): Promise<ClasseRow[]> {
  return get('/community/classes');
}

export interface MessageRow {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}
export function listClasseMessages(classeId: string): Promise<MessageRow[]> {
  return get(`/community/classes/${classeId}/messages`);
}
export function postClasseMessage(
  classeId: string,
  authorId: string,
  body: string,
): Promise<MessageRow> {
  return post(`/community/classes/${classeId}/messages`, { authorId, body });
}

export interface RegisterAccountInput {
  email: string;
  authUserId?: string | null;
  isMinor: boolean;
  displayName: string;
  locale: string;
  timezone: string;
  birthDate?: string | null;
  guardianEmail?: string | null;
}
export interface RegisterAccountResult {
  account: { id: string };
  profile: { id: string };
}
export function registerAccount(input: RegisterAccountInput): Promise<RegisterAccountResult> {
  return post('/accounts', input);
}

/** Compagnon perso (« pet ») stocké par compte. */
export interface CompanionConfig {
  url: string | null;
  size: number;
  hidden: boolean;
  /** Mode « cam » (tuile visio avec décor) + décor choisi + taille de la tuile. */
  camMode?: boolean;
  world?: string;
  camSize?: number;
  /** Nom du compagnon (persona), distinct du nom d'un pet importé. */
  name?: string;
}

export interface MeResult {
  account: { id: string; email: string; isMinor: boolean; role: string };
  profile: {
    id: string;
    displayName: string;
    locale: string;
    timezone: string;
    birthDate: string | null;
    photoUrl: string | null;
    companion: CompanionConfig | null;
  } | null;
}
export function getMe(): Promise<MeResult> {
  return get('/accounts/me');
}

export interface UpdateProfileInput {
  displayName?: string;
  birthDate?: string | null;
  photoUrl?: string | null;
  companion?: Partial<CompanionConfig> | null;
}
export function updateMyProfile(patch: UpdateProfileInput): Promise<MeResult['profile']> {
  return patch2('/accounts/me/profile', patch);
}

// --- Compagnon : bibliothèque de pets (import .zip/fichier + gestion) via l'API ---
// L'API extrait/valide côté serveur, stocke et sert chaque planche (contourne hotlink & bug storage).
export interface InstalledPet {
  id: string;
  name: string;
  version: number;
}
export interface CompanionPetItem {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  url: string;
}
/** Ajoute un pet à la bibliothèque (multipart, champ `file`). */
export async function installCompanionPet(form: FormData): Promise<InstalledPet> {
  const res = await fetch(`${API_BASE}/companion/pet`, {
    method: 'POST',
    headers: { ...(await authHeaders()) }, // pas de content-type : le navigateur pose la frontière multipart
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
  return res.json() as Promise<InstalledPet>;
}
/** URL de la planche servie par l'API (avec cache-buster de version). */
export function companionPetUrl(id: string, version: number): string {
  return `${API_BASE}/companion/pet/${id}?v=${version}`;
}
/** Liste la bibliothèque de pets du compte (avec URL servie prête à l'emploi). */
export async function listCompanionPets(): Promise<CompanionPetItem[]> {
  const rows =
    await get<{ id: string; name: string; version: number; createdAt: string }[]>(
      '/companion/pets',
    );
  return rows.map((r) => ({ ...r, url: companionPetUrl(r.id, r.version) }));
}
/** Renomme un pet de la bibliothèque. */
export function renameCompanionPet(
  id: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return patch2(`/companion/pet/${id}`, { name });
}

// --- Tamagotchi : état de soin du compagnon (jauges + humeur + âge) ---
export type PetMood = 'malade' | 'fatigue' | 'affame' | 'sale' | 'triste' | 'heureux' | 'ok';
export interface PetCareState {
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  ageDays: number;
  mood: PetMood;
  gold: number;
  /** Stock possédé PAR matériau, en unités (1 unité = 1 carré). */
  stock: Record<string, number>;
}
export function getPetCare(): Promise<PetCareState> {
  return get('/companion/care');
}
/** action ∈ feed | play | sleep | clean | heal | cuddle */
export function actPetCare(action: string): Promise<PetCareState> {
  return post(`/companion/care/${action}`, {});
}
/** Boutique : achète `qty` unités d'un matériau (renvoie l'état à jour : gold + stock). */
export function buyShopItem(item: string, qty = 1): Promise<PetCareState> {
  return post('/companion/shop/buy', { item, qty });
}

// --- Tamagotchi PAR compagnon (agents/abeilles) : jauges persistées, sans gold/stock (global au profil). ---
export interface AgentCareState {
  agentId: string;
  satiety: number;
  happiness: number;
  energy: number;
  hygiene: number;
  health: number;
  ageDays: number;
  mood: PetMood;
}
/** Care de TOUS les compagnons d'un espace (hors principal & relais). */
export function getSpaceCare(space = 'home'): Promise<AgentCareState[]> {
  return get(`/companion/care/space?space=${encodeURIComponent(space)}`);
}
/** Action de soin sur UN compagnon. */
export function actAgentCare(agentId: string, action: string): Promise<AgentCareState> {
  return post(`/companion/agents/${agentId}/care/${action}`, {});
}

// --- « Maison » : jeu isométrique (pièce + meubles placés) ---
export interface RoomItem {
  item: string;
  c: number;
  r: number;
}
/** Meubles PAR pièce : { [idPièce]: RoomItem[] }. */
export type RoomFurniture = Record<string, RoomItem[]>;
export interface RoomState {
  room: string;
  rooms: RoomFurniture;
}
export function getPetRoom(): Promise<RoomState> {
  return get('/companion/room');
}
export function setPetRoom(room: string, rooms: RoomFurniture): Promise<RoomState> {
  return put('/companion/room', { room, rooms });
}
/** Supprime un pet de la bibliothèque. */
export function deleteCompanionPet(id: string): Promise<{ ok: true }> {
  return del(`/companion/pet/${id}`);
}

// --- Compagnons-agents : plusieurs compagnons par profil (« famille » + open-spaces) ---
export interface AgentPersonality {
  tone?: string;
  traits?: string[];
  description?: string;
  emoji?: string;
  greeting?: string;
  /** Règles apprises par l'utilisateur (mémoire du compagnon). */
  rules?: string[];
}
export interface CompanionMessage {
  sender: 'me' | 'agent' | string;
  text: string;
  at: number;
}
export interface RoleContract {
  responsibilities?: string[];
  capabilities?: string[];
  limitations?: string[];
  delegatesTo?: string[];
  escalationPath?: string[];
  allowedTools?: string[];
}
export interface CompanionAgent {
  id: string;
  name: string;
  skinUrl: string | null;
  size: number;
  personality: AgentPersonality | null;
  role: string | null;
  roleContract: RoleContract;
  space: string; // 'home' | id d'open-space
  room: string; // salle dans l'espace : Maison=chambre|salon|… ; open-space=travail:N|toilettes|cantine|repos|garage
  pos: { c: number; r: number } | null;
  isPrimary: boolean;
  mode: 'pnj' | 'agent' | string;
  useCount?: number;
  lastUsedAt?: number | null;
  quality?: number | null;
  protected?: boolean;
  promptVersions?: number;
}
export interface CompanionAgentInput {
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
/** Liste les compagnons d'un espace (défaut : la Maison). Sème le principal la 1re fois. */
export function getCompanionAgents(space = 'home'): Promise<CompanionAgent[]> {
  return get(`/companion/agents?space=${encodeURIComponent(space)}`);
}
export function createCompanionAgent(input: CompanionAgentInput): Promise<CompanionAgent> {
  return post('/companion/agents', input);
}
export function updateCompanionAgent(
  id: string,
  patch: Partial<CompanionAgentInput>,
): Promise<CompanionAgent> {
  return patch2(`/companion/agents/${id}`, patch);
}
export function deleteCompanionAgent(id: string): Promise<{ ok: true }> {
  return del(`/companion/agents/${id}`);
}
/** Auto-builder IA : « décris ton compagnon en une phrase » → Dowze construit et crée l'agent. */
export function buildCompanionAgent(
  description: string,
  skinUrl?: string | null,
  space?: string,
): Promise<CompanionAgent> {
  return post('/companion/agents/build', { description, skinUrl, space });
}
/** Chat IA avec un compagnon-agent (réponse courte ; mémoire persistante + apprentissage côté serveur). */
export function chatCompanionAgent(
  id: string,
  message: string,
): Promise<{ reply: string; learned?: string; toolsUsed?: string[] }> {
  return post(`/companion/agents/${id}/chat`, { message });
}
/** Historique de conversation persistant d'un compagnon-agent. */
export function getCompanionAgentMessages(id: string): Promise<CompanionMessage[]> {
  return get(`/companion/agents/${id}/messages`);
}

export type VoiceProvider = 'browser' | 'openai' | 'elevenlabs' | 'local';
export interface CompanionVoiceSettings {
  sttProvider: VoiceProvider;
  sttModel: string;
  ttsProvider: VoiceProvider;
  ttsModel: string;
  voiceId: string;
  localSttModel: string;
  localTtsModel: string;
  localVoiceId: string;
  hasOpenaiKey: boolean;
  hasElevenlabsKey: boolean;
}
export type CompanionVoiceSettingsUpdate = Partial<
  Omit<CompanionVoiceSettings, 'hasOpenaiKey' | 'hasElevenlabsKey'>
> & { openaiApiKey?: string | null; elevenlabsApiKey?: string | null };
export function getCompanionVoiceSettings(): Promise<CompanionVoiceSettings> {
  return get('/companion/voice/settings');
}
export function updateCompanionVoiceSettings(
  input: CompanionVoiceSettingsUpdate,
): Promise<CompanionVoiceSettings> {
  return put('/companion/voice/settings', input);
}
export async function transcribeCompanionVoice(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file, `voice.${file.type.includes('ogg') ? 'ogg' : 'webm'}`);
  const res = await fetch(`${API_BASE}/companion/voice/transcribe`, {
    method: 'POST',
    headers: { ...(await authHeaders()) },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
  return ((await res.json()) as { text: string }).text;
}
export async function synthesizeCompanionVoice(text: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/companion/voice/synthesize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
  return res.blob();
}
/** Orchestration « ruche » : le compagnon principal délègue aux spécialistes et synthétise. */
export function orchestrateCompanion(
  message: string,
  leaderId?: string,
  context?: { route?: string; service?: string; page?: string },
): Promise<{
  reply: string;
  delegates: { name: string; role: string | null; said: string }[];
  created: string[];
  toolsUsed?: string[];
}> {
  return post('/companion/orchestrate', {
    message,
    ...(leaderId ? { leaderId } : {}),
    ...(context ? { context } : {}),
  });
}

// --- Jardinage de la ruche (cycle de vie & efficacité des abeilles) ---
export interface HiveMaintainReport {
  scanned: number;
  merged: { survivor: string; absorbed: string }[];
  retired: string[];
  embedded: number;
}
/** Nettoyage de la ruche : dedup → fusion → prune (soft-delete réversible). */
export function maintainHive(): Promise<HiveMaintainReport> {
  return post('/companion/hive/maintain', {});
}
export function mergeCompanionAgents(
  survivorId: string,
  absorbedId: string,
): Promise<{ ok: boolean }> {
  return post('/companion/hive/merge', { survivorId, absorbedId });
}
export function retrainCompanionAgent(id: string): Promise<CompanionAgent> {
  return post(`/companion/agents/${id}/retrain`, {});
}
export function revertCompanionAgentPrompt(id: string): Promise<CompanionAgent> {
  return post(`/companion/agents/${id}/revert-prompt`, {});
}
export function retireCompanionAgent(id: string): Promise<{ ok: true }> {
  return post(`/companion/agents/${id}/retire`, {});
}
export function protectCompanionAgent(id: string, isProtected: boolean): Promise<CompanionAgent> {
  return post(`/companion/agents/${id}/protect`, { protected: isProtected });
}

export type HiveChannel = 'direct' | 'messages' | 'email' | 'push' | 'voice' | 'system';
export interface HiveEvent {
  id: string;
  kind: string;
  content: string;
  channel: HiveChannel;
  actorAgentId: string | null;
  subjectAgentId: string | null;
  space: string | null;
  importance: number;
  metadata: Record<string, unknown>;
  sourceEventIds: string[];
  occurredAt: string;
}
export interface HiveHandoff {
  id: string;
  fromAgentId: string | null;
  toAgentId: string | null;
  targetSpace: string | null;
  originalRequest: string;
  summarizedContext: string;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  status:
    'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'cancelled' | 'failed';
  createdAt: string;
  updatedAt: string;
}
export function getHiveEvents(
  filters: { limit?: number; kind?: string; space?: string } = {},
): Promise<HiveEvent[]> {
  const query = new URLSearchParams();
  if (filters.limit) query.set('limit', String(filters.limit));
  if (filters.kind) query.set('kind', filters.kind);
  if (filters.space) query.set('space', filters.space);
  return get(`/companion/hive/events${query.size ? `?${query}` : ''}`);
}
export function recordHiveEvent(input: {
  kind: string;
  content: string;
  channel?: HiveChannel;
  actorAgentId?: string;
  subjectAgentId?: string;
  space?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  sourceEventIds?: string[];
}): Promise<HiveEvent> {
  return post('/companion/hive/events', input);
}
export function searchHiveMemory(filters: {
  q?: string;
  from?: string;
  to?: string;
  actor?: string;
  space?: string;
  kind?: string;
  limit?: number;
}): Promise<HiveEvent[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return get(`/companion/hive/memory/search?${query}`);
}
export interface HiveProvenanceGraph {
  rootId: string;
  nodes: (HiveEvent & { depth: number })[];
  edges: { from: string; to: string }[];
}
export function getHiveEventProvenance(id: string): Promise<HiveProvenanceGraph> {
  return get(`/companion/hive/events/${id}/provenance`);
}
export function embedHiveMemory(limit = 100): Promise<{ embedded: number }> {
  return post('/companion/hive/memory/embed', { limit });
}
export function getHiveHandoffs(status?: HiveHandoff['status']): Promise<HiveHandoff[]> {
  return get(`/companion/hive/handoffs${status ? `?status=${encodeURIComponent(status)}` : ''}`);
}
export function deliverHiveEvent(input: {
  eventId: string;
  companionId?: string;
  channel: HiveChannel;
}): Promise<{ id: string; status: string; renderedContent: string }> {
  return post('/companion/hive/deliveries', input);
}
export function transitionHiveHandoff(
  id: string,
  status: HiveHandoff['status'],
): Promise<HiveHandoff> {
  return patch2(`/companion/hive/handoffs/${id}`, { status });
}
export interface HiveMemoryPolicy {
  crossSpaceEnabled: boolean;
  personalDataEnabled: boolean;
  proactiveMemoryEnabled: boolean;
  retentionDays: number | null;
}
export function getHiveMemoryPolicy(): Promise<HiveMemoryPolicy> {
  return get('/companion/hive/memory/policy');
}
export interface HiveLibrary {
  memories: {
    id: string;
    category: string;
    content: string;
    memoryKey: string | null;
    confidence: number;
    validFrom: string | null;
    validTo: string | null;
    supersedesId: string | null;
    updatedAt: string;
  }[];
  memoryHistory: HiveLibrary['memories'];
  episodes: {
    id: string;
    title: string;
    summary: string;
    sourceEventIds: string[];
    startedAt: string;
    endedAt: string;
  }[];
  relations: {
    id: string;
    subjectKind: string;
    subjectId: string | null;
    predicate: string;
    objectKind: string;
    objectId: string | null;
    description: string;
    occurredAt: string;
  }[];
}
export function getHiveLibrary(): Promise<HiveLibrary> {
  return get('/companion/hive/memory/library');
}
export function updateHiveMemoryPolicy(
  patch: Partial<HiveMemoryPolicy>,
): Promise<HiveMemoryPolicy> {
  return patch2('/companion/hive/memory/policy', patch);
}
export function consolidateHiveMemory(): Promise<{ created: number; skipped: boolean }> {
  return post('/companion/hive/memory/consolidate', {});
}
export function exportHiveMemory(): Promise<Record<string, unknown>> {
  return get('/companion/hive/memory/export');
}
export function forgetHiveMemory(input: {
  eventIds?: string[];
  before?: string;
}): Promise<{ forgotten: number }> {
  return post('/companion/hive/memory/forget', input);
}
export interface HiveVaultItem {
  id: string;
  label: string;
  kind: string;
  space: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface HiveAccessRequest {
  id: string;
  vaultItemId: string;
  requesterAgentId: string | null;
  purpose: string;
  requestedSeconds: number;
  status: 'pending' | 'approved' | 'denied' | 'revoked' | 'expired' | 'consumed';
  decisionReason: string | null;
  expiresAt: string | null;
  createdAt: string;
}
export function getHiveVaultItems(): Promise<HiveVaultItem[]> {
  return get('/companion/hive/vault/items');
}
export function createHiveVaultItem(input: {
  label: string;
  secret: string;
  kind?: string;
  space?: string;
}): Promise<HiveVaultItem> {
  return post('/companion/hive/vault/items', input);
}
export function getHiveAccessRequests(
  status?: HiveAccessRequest['status'],
): Promise<HiveAccessRequest[]> {
  return get(`/companion/hive/vault/access${status ? `?status=${status}` : ''}`);
}
export function decideHiveAccess(
  id: string,
  decision: 'approve' | 'deny' | 'revoke',
  reason?: string,
): Promise<HiveAccessRequest> {
  return patch2(`/companion/hive/vault/access/${id}`, { decision, reason });
}
export interface HiveRuntimeView {
  id: string;
  name: string;
  model: string;
  harness: string;
  adapter: 'copilote' | 'relay_mcp' | 'external';
  modalities: string[];
  capabilities: string[];
  quality: number;
  cost: number;
  latency: number;
  privacy: 'local' | 'private_cloud' | 'public_cloud';
  entitlement: 'included' | 'subscription' | 'metered';
  enabled: boolean;
  available: boolean;
}
export function getHiveRuntimes(): Promise<HiveRuntimeView[]> {
  return get('/companion/hive/runtimes');
}
export function setHiveRuntimeEnabled(id: string, enabled: boolean): Promise<HiveRuntimeView> {
  return patch2(`/companion/hive/runtimes/${id}/enabled`, { enabled });
}
export function executeHiveRuntime(input: {
  capability: string;
  prompt: string;
  modality?: string;
  allowedPrivacy?: HiveRuntimeView['privacy'][];
  availableEntitlements?: HiveRuntimeView['entitlement'][];
  channel?: Exclude<HiveChannel, 'system'>;
}): Promise<{
  status: 'completed' | 'queued';
  output: string;
  runtime: HiveRuntimeView;
  toolsUsed: string[];
}> {
  return post('/companion/hive/runtimes/execute', input);
}
export interface HiveAttentionItem {
  id: string;
  requesterAgentId: string | null;
  kind: 'approval' | 'decision' | 'blocker' | 'warning' | 'information';
  priority: 'low' | 'normal' | 'high' | 'critical';
  title: string;
  details: string;
  options: { id: string; label: string }[];
  status: 'open' | 'resolved' | 'dismissed' | 'expired';
  dueAt: string | null;
  createdAt: string;
}
export function getHiveAttention(
  status: HiveAttentionItem['status'] | 'all' = 'open',
): Promise<HiveAttentionItem[]> {
  return get(`/companion/hive/attention?status=${status}`);
}
export function resolveHiveAttention(
  id: string,
  action: string,
  note?: string,
  dismiss = false,
): Promise<HiveAttentionItem> {
  return patch2(`/companion/hive/attention/${id}`, { action, note, dismiss });
}
export interface HiveAsset {
  id: string;
  space: string;
  name: string;
  assetType: 'server' | 'database' | 'firewall' | 'vps' | 'service' | 'device' | 'other';
  visualKey: string;
  endpoint: string | null;
  purpose: string;
  environment: 'development' | 'staging' | 'production' | 'personal';
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  vaultItemId: string | null;
  updatedAt: string;
}
export function getHiveAssets(space?: string): Promise<HiveAsset[]> {
  return get(`/companion/hive/assets${space ? `?space=${encodeURIComponent(space)}` : ''}`);
}
export function createHiveAsset(input: {
  space: string;
  name: string;
  assetType: HiveAsset['assetType'];
  purpose?: string;
  endpoint?: string;
  environment?: HiveAsset['environment'];
  vaultItemId?: string;
}): Promise<HiveAsset> {
  return post('/companion/hive/assets', input);
}
export function updateHiveAssetStatus(id: string, status: HiveAsset['status']): Promise<HiveAsset> {
  return patch2(`/companion/hive/assets/${id}/status`, { status });
}

export interface HiveRun {
  id: string;
  objective: string;
  status: 'planning' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  maxDepth: number;
  maxFanout: number;
  maxTasks: number;
  maxRuntimeSeconds: number;
  maxCredits: number;
  usedCredits: number;
  deadlineAt: string | null;
  usedTasks: number;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
export interface HiveTask {
  id: string;
  runId: string;
  parentTaskId: string | null;
  assignedAgentId: string | null;
  depth: number;
  sequence: number;
  objective: string;
  status: string;
  output: string | null;
  error: string | null;
}
export function getHiveRuns(limit = 50): Promise<HiveRun[]> {
  return get(`/companion/hive/runs?limit=${limit}`);
}
export function getHiveRun(id: string): Promise<HiveRun & { tasks: HiveTask[] }> {
  return get(`/companion/hive/runs/${id}`);
}
export interface HiveSpacePackage {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string;
  visibility: 'private' | 'shared' | 'official';
  manifest: {
    type?: string;
    mission?: string;
    building?: Record<string, unknown>;
    roles?: string[];
    capabilities?: string[];
    workflows?: string[];
    permissions?: Record<string, unknown>;
  };
}
export function getHiveSpacePackages(): Promise<HiveSpacePackage[]> {
  return get('/companion/spaces/packages');
}
export interface HiveCompanionState {
  agentId: string;
  availability: 'available' | 'busy' | 'away' | 'sleeping' | 'offline';
  activity: string;
  relationshipState: string;
  currentTaskId: string | null;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  visualMood: string;
  location: string | null;
  updatedAt: string;
}
export function getHiveCompanionStates(): Promise<HiveCompanionState[]> {
  return get('/companion/hive/companion-states');
}
export interface HiveComputeResource {
  id: string;
  name: string;
  kind: 'cpu' | 'gpu' | 'npu' | 'remote_api';
  locality: 'local' | 'private_cloud' | 'public_cloud';
  modalities: string[];
  memoryMb: number;
  acceleratorMemoryMb: number;
  maxConcurrency: number;
  activeAllocations: number;
  costPerHour: number;
  health: 'healthy' | 'degraded' | 'offline' | 'unknown';
  enabled: boolean;
}
export function getHiveComputeResources(): Promise<HiveComputeResource[]> {
  return get('/companion/hive/compute-resources');
}
export function createHiveComputeResource(input: {
  name: string;
  kind: HiveComputeResource['kind'];
  locality: HiveComputeResource['locality'];
  modalities: string[];
  memoryMb?: number;
  acceleratorMemoryMb?: number;
  maxConcurrency?: number;
  costPerHour?: number;
  assetId?: string;
}): Promise<HiveComputeResource> {
  return post('/companion/hive/compute-resources', input);
}
export function updateHiveComputeResource(
  id: string,
  patch: {
    health?: HiveComputeResource['health'];
    enabled?: boolean;
    maxConcurrency?: number;
  },
): Promise<HiveComputeResource> {
  return patch2(`/companion/hive/compute-resources/${id}`, patch);
}
export function installHiveSpacePackage(
  id: string,
  mode: 'join' | 'create',
  name?: string,
): Promise<{ space: { id: string; name: string } }> {
  return post(`/companion/spaces/packages/${id}/install`, { mode, name });
}

// --- Relais Claude Code / Codex (serveur MCP) ---
/** Génère un jeton Bearer à coller dans SON Claude Code / Codex (montré une seule fois). */
export function createRelayToken(label?: string): Promise<{ token: string; name: string }> {
  return post('/companion/relay/token', label ? { label } : {});
}
/** Téléphone → Claude Code : envoie une instruction dans le fil du relais (mise en file d'attente). */
export function relaySayCompanion(text: string): Promise<{ ok: true }> {
  return post('/companion/relay/say', { text });
}

// --- Espaces de travail (la Maison 'home' est implicite ; les open-spaces sont nommables) ---
// Chaque open-space = une organisation (entreprise / SaaS / école) peuplée d'agents-employés.
export interface CompanionSpace {
  id: string;
  name: string;
  type?: string; // company | saas | school | custom
  mission?: string | null;
}
export interface OrgTemplate {
  key: string;
  label: string;
  type: string;
  defaultMission: string;
  roles: string[];
}
export function getCompanionSpaces(): Promise<CompanionSpace[]> {
  return get('/companion/spaces');
}
export function getOrgTemplates(): Promise<OrgTemplate[]> {
  return get('/companion/spaces/templates');
}
export function createCompanionSpace(
  name: string,
  opts?: { type?: string; template?: string; mission?: string },
): Promise<CompanionSpace> {
  return post('/companion/spaces', { name, ...(opts ?? {}) });
}
// Auto-provisionne l'org de service (Académie → école calibrée sur le rang de l'élève). Idempotent ; null si pas encore élève.
export function ensureServiceOrg(service: 'academie' = 'academie'): Promise<CompanionSpace | null> {
  return post('/companion/service-org', { service });
}
export function renameCompanionSpace(id: string, name: string): Promise<CompanionSpace> {
  return patch2(`/companion/spaces/${id}`, { name });
}
// P2 — le leader de l'open-space (Directeur/CEO) délègue à l'équipe selon le rôle, puis synthétise.
export interface SpaceOrchestration {
  leadId: string;
  leadName: string;
  reply: string;
  delegates: { id: string; name: string; role: string | null; said: string }[];
  qa?: { id: string; name: string; ok: boolean; note: string };
  toolsUsed: string[];
}
export function orchestrateSpace(spaceId: string, message: string): Promise<SpaceOrchestration> {
  return post(`/companion/spaces/${spaceId}/orchestrate`, { message });
}
// P3 — base de connaissances propre à un open-space (organisation) : les agents la consultent (RAG scopé).
export interface SpaceKnowledge {
  id: string;
  title: string;
  preview: string;
  at: number;
}
export function getSpaceKnowledge(spaceId: string): Promise<SpaceKnowledge[]> {
  return get(`/companion/spaces/${spaceId}/knowledge`);
}
export interface SpaceKnowledgeHit {
  id: string;
  title: string;
  content: string;
  citation: string;
  score: number;
}
export function searchSpaceKnowledge(
  spaceId: string,
  query: string,
  limit = 5,
): Promise<SpaceKnowledgeHit[]> {
  return get(
    `/companion/spaces/${spaceId}/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
}
export function addSpaceKnowledge(
  spaceId: string,
  title: string,
  content: string,
): Promise<{ id: string; title: string; chunks: number }> {
  return post(`/companion/spaces/${spaceId}/knowledge`, { title, content });
}
export function deleteSpaceKnowledge(id: string): Promise<{ ok: true }> {
  return del(`/companion/knowledge/${id}`);
}
// P4 — chantier : le leader découpe un objectif, l'équipe produit, on assemble un livrable archivé.
export interface ProjectResult {
  deliverable: string;
  steps: { id: string; name: string; role: string | null; produces: string; said: string }[];
  qa?: { name: string; ok: boolean; note: string };
  knowledgeId?: string;
  toolsUsed: string[];
}
export function runSpaceProject(spaceId: string, goal: string): Promise<ProjectResult> {
  return post(`/companion/spaces/${spaceId}/project`, { goal });
}
// Pont IA (ChatGPT/Claude) : capter → synthétiser (Mémorialiste) → réinjecter. Zéro copier-coller.
export interface BridgeSynthese {
  id: string;
  titre: string;
  synthese: string;
  ouOnEnEst: string;
  prochaine: string;
  progressed: { skill: { id: string; title: string }; pMastery: number; resultat: string } | null;
}
export interface BridgeContext {
  prompt: string;
  skill: { id: string; slug: string; title: string } | null;
  hasMemory: boolean;
}
export function bridgeIngest(
  source: 'chatgpt' | 'claude' | 'ia',
  text: string,
): Promise<BridgeSynthese> {
  return post('/companion/bridge/ingest', { source, text });
}
export function getBridgeContext(): Promise<BridgeContext> {
  return get('/companion/bridge/context');
}
export function getBridgeState(): Promise<
  { id: string; title: string; preview: string; at: number }[]
> {
  return get('/companion/bridge/state');
}
export function deleteCompanionSpace(id: string): Promise<{ ok: true }> {
  return del(`/companion/spaces/${id}`);
}

// --- Onboarding : présentation → dossier élève (IA) ---
export interface DossierResult {
  profileId: string;
  structured: Dossier;
  validated: boolean;
  creditsSpent?: number;
}
export function generateDossier(input: PresentationInput): Promise<DossierResult> {
  return aiTask({ state: 'preparing', message: 'Je prépare ton profil…' }, () =>
    post('/onboarding/presentation', input),
  );
}
export function getDossier(profileId: string): Promise<DossierResult | null> {
  return get(`/onboarding/dossier/${profileId}`);
}
export function updateDossier(
  profileId: string,
  structured: Dossier,
  validated: boolean,
): Promise<DossierResult> {
  return patch2('/onboarding/dossier', { profileId, structured, validated });
}

export interface SkillRow {
  id: string;
  slug: string;
  title: string;
  depth: number;
  isRoot: boolean;
}
export function getSkills(): Promise<SkillRow[]> {
  return get('/skills');
}

// --- Exercices (générateur IA) ---
export function generateExercises(
  input: GenerateExercisesRequest,
): Promise<{ items: ExerciseItem[]; creditsSpent: number }> {
  return aiTask({ state: 'preparing', message: 'Je prépare tes exercices…' }, () =>
    post('/exercises/generate', input),
  );
}

// --- Expéditions guidées par l'IA ---
export function proposeExpeditions(
  profileId: string,
): Promise<{ propositions: ExpeditionProposal[]; creditsSpent: number }> {
  return post('/expeditions/guided/propose', { profileId });
}
export function chooseExpedition(
  profileId: string,
  proposal: ExpeditionProposal,
): Promise<LearnerExpedition> {
  return post('/expeditions/guided/choose', { profileId, proposal });
}
export function myExpeditions(profileId: string): Promise<LearnerExpedition[]> {
  return get(`/expeditions/guided/mine/${profileId}`);
}
export function expeditionPhaseGuide(
  id: string,
): Promise<{ phase: string; guidance: PhaseGuidance; creditsSpent: number }> {
  return post(`/expeditions/guided/${id}/phase-guide`, {});
}
export function advanceGuidedExpedition(id: string, bilan?: string): Promise<LearnerExpedition> {
  return post(`/expeditions/guided/${id}/advance`, bilan ? { bilan } : {});
}

// --- Tests de révision (hebdo / trimestriel) ---
export function generateTest(profileId: string, kind: TestKind = 'weekly'): Promise<TestView> {
  return post('/tests/generate', { profileId, kind });
}
export function submitTest(
  testId: string,
  profileId: string,
  results: { skillId: string; correct: boolean }[],
): Promise<TestResult> {
  return post('/tests/submit', { testId, profileId, results });
}

// --- Mes résultats / suivi (maîtrise & croissance, sans note) ---
export function getMyResults(profileId: string): Promise<ResultsView> {
  return get(`/results/me/${profileId}`);
}
export function getChildResults(accountId: string): Promise<ResultsView> {
  return get(`/results/child/${accountId}`);
}
export function voteRank(
  profileId: string,
  choice: 'accept' | 'consolidate',
): Promise<ResultsView> {
  return post(`/results/rank/vote/${profileId}`, { choice });
}
export function parentVoteRank(
  accountId: string,
  choice: 'accept' | 'consolidate',
): Promise<ResultsView> {
  return post(`/results/rank/child/${accountId}/vote`, { choice });
}

// --- Saut de Rang (mois intensif) ---
export function getRankJump(profileId: string): Promise<RankJumpView> {
  return get(`/rank-jump/${profileId}`);
}
export function startRankJump(profileId: string): Promise<RankJumpView> {
  return post(`/rank-jump/${profileId}/start`, {});
}
export function submitRankJumpDay(profileId: string, score: number): Promise<RankJumpView> {
  return post(`/rank-jump/${profileId}/day`, { score });
}
export function abandonRankJump(profileId: string): Promise<RankJumpView> {
  return post(`/rank-jump/${profileId}/abandon`, {});
}
export function getChildRankJump(accountId: string): Promise<RankJumpView> {
  return get(`/rank-jump/child/${accountId}`);
}
export function consentRankJump(accountId: string): Promise<RankJumpView> {
  return post(`/rank-jump/child/${accountId}/consent`, {});
}
export function doRetention(profileId: string, id: string, score: number): Promise<RankJumpView> {
  return post(`/rank-jump/${profileId}/retention/${id}`, { score });
}
export function generatePretest(profileId: string): Promise<{ items: ExerciseItem[] }> {
  return post(`/rank-jump/${profileId}/pretest/generate`, {});
}
export function submitPretest(profileId: string, score: number): Promise<RankJumpView> {
  return post(`/rank-jump/${profileId}/pretest`, { score });
}
export function moodCheckin(profileId: string, mood: number): Promise<RankJumpView> {
  return post(`/rank-jump/${profileId}/mood`, { mood });
}

// --- Spécialisation ---
export function getSpecialization(profileId: string): Promise<SpecializationView> {
  return get(`/specialization/${profileId}`);
}
export function chooseSpecialization(
  profileId: string,
  discipline: string,
): Promise<SpecializationView> {
  return post(`/specialization/${profileId}/choose`, { discipline });
}
export function dropSpecialization(
  profileId: string,
  discipline: string,
): Promise<SpecializationView> {
  return post(`/specialization/${profileId}/drop`, { discipline });
}
export function getSpecPlan(
  profileId: string,
  discipline: string,
): Promise<SpecializationPlan | null> {
  return get(`/specialization/${profileId}/plan/${encodeURIComponent(discipline)}`);
}
export function generateSpecPlan(
  profileId: string,
  discipline: string,
): Promise<SpecializationPlan> {
  return post(`/specialization/${profileId}/plan/${encodeURIComponent(discipline)}/generate`, {});
}
export function completeMilestone(
  profileId: string,
  discipline: string,
  milestoneId: string,
): Promise<SpecializationPlan> {
  return post(`/specialization/${profileId}/milestone/done`, { discipline, milestoneId });
}

// --- Placement adaptatif (IA) ---
export function placementStart(profileId: string): Promise<PlacementStep> {
  return post('/placement/start', { profileId });
}
export function placementAnswer(
  sessionId: string,
  answer: string,
  responseTimeMs?: number,
  timedOut?: boolean,
): Promise<PlacementStep> {
  return post('/placement/answer', { sessionId, answer, responseTimeMs, timedOut });
}

export interface CarnetEntryRow {
  id: string;
  note: string;
  skillId: string | null;
  createdAt: string;
}
export function listCarnet(profileId: string): Promise<CarnetEntryRow[]> {
  return get(`/carnet/${profileId}`);
}
export function addCarnetEntry(profileId: string, note: string): Promise<CarnetEntryRow> {
  return post('/carnet', { profileId, note });
}
export function getResumePrompt(profileId: string): Promise<{ prompt: string }> {
  return get(`/carnet/${profileId}/prompt`);
}

// ── Le Copilote (IA interne orchestratrice) ──

export interface ComposeResult {
  prompt: string;
  closingPrompt: string;
  skill: { id: string; slug: string; title: string } | null;
}
/** Compose le prompt LISIBLE du jour (déterministe, sans coût). */
export function composeSession(profileId: string): Promise<ComposeResult> {
  return aiTask({ state: 'preparing', message: 'Je prépare ton prompt…' }, () =>
    post('/copilote/compose', { profileId }),
  );
}

export interface CourseResult {
  sheet: CourseSheet;
  skill: { id: string; slug: string; title: string };
  creditsSpent: number;
}
/** Cours NATIF Dowze : l'IA génère la feuille A4 à modules (rendue en app). `null` si tout maîtrisé. */
export function generateCourseSheet(profileId: string): Promise<CourseResult | null> {
  return aiTask({ state: 'preparing', message: 'Je prépare ton cours…' }, () =>
    post('/copilote/cours', { profileId }),
  );
}

/** Clôture du cours natif : l'app a dérivé l'outcome des réponses → BKT + carnet + FSRS (sans LLM). */
export function closeCourse(
  profileId: string,
  skillId: string,
  outcome: 'maitrise' | 'progres' | 'bloque',
  note: string,
): Promise<{ pMastery: number }> {
  return post('/copilote/cours/cloture', { profileId, skillId, outcome, note });
}

export interface IngestResult {
  snapshot: SessionSnapshot;
  pMastery: number;
  creditsSpent: number;
}
/** Ingère le résumé de séance (texte libre) → snapshot → BKT + carnet. */
export function ingestSummary(
  profileId: string,
  skillId: string,
  summary: string,
  modelId?: string,
): Promise<IngestResult> {
  return aiTask({ state: 'reading', message: 'Je lis ce que tu as écrit…' }, () =>
    post('/copilote/ingest', { profileId, skillId, summary, modelId }),
  );
}

/** Catalogue des modèles disponibles (multi-fournisseurs). */
export function getModels(): Promise<AiModel[]> {
  return get('/copilote/models');
}

/** Catalogue des modèles d'embedding (mémoire sémantique). */
export function getEmbeddingModels(): Promise<AiEmbeddingModel[]> {
  return get('/copilote/embedding-models');
}

export function getCopiloteSettings(profileId: string): Promise<CopiloteSettingsView> {
  return get(`/copilote/settings/${profileId}`);
}

export interface UpdateCopiloteSettingsInput {
  profileId: string;
  modelId?: string;
  billing?: 'credits' | 'byok' | 'ollama';
  byokProvider?: AiModel['provider'] | null;
  byokApiKey?: string | null;
  embeddingModelId?: string | null;
  embeddingApiKey?: string | null;
  lowcostModelId?: string | null;
  ollamaModel?: string | null;
}
export function updateCopiloteSettings(
  input: UpdateCopiloteSettingsInput,
): Promise<CopiloteSettingsView> {
  return post('/copilote/settings', input);
}

export function getCredits(profileId: string): Promise<{ profileId: string; balance: number }> {
  return get(`/copilote/balance/${profileId}`);
}

// ---------------- Système ÉCHANGER — Phase A : amis + messagerie ----------------
export function getFriends(profileId: string): Promise<SocialOverview> {
  return get(`/social/${profileId}/friends`);
}
export function searchProfiles(profileId: string, q: string): Promise<Friend[]> {
  return get(`/social/${profileId}/search?q=${encodeURIComponent(q)}`);
}
export function requestFriend(profileId: string, targetProfileId: string): Promise<SocialOverview> {
  return post(`/social/${profileId}/friends/request`, { targetProfileId });
}
export function acceptFriend(profileId: string, targetProfileId: string): Promise<SocialOverview> {
  return post(`/social/${profileId}/friends/accept`, { targetProfileId });
}
export function removeFriend(profileId: string, targetProfileId: string): Promise<SocialOverview> {
  return post(`/social/${profileId}/friends/remove`, { targetProfileId });
}
export function getInbox(profileId: string): Promise<ConversationSummary[]> {
  return get(`/social/${profileId}/inbox`);
}
export function getConversation(
  profileId: string,
  conversationId: string,
): Promise<ConversationView> {
  return get(`/social/${profileId}/conversation/${conversationId}`);
}
export function sendMessage(
  profileId: string,
  conversationId: string,
  body: string,
): Promise<ChatMessage> {
  return post(`/social/${profileId}/conversation/${conversationId}/send`, {
    body,
    kind: 'text',
    meta: null,
  });
}
export function startDirect(
  profileId: string,
  friendProfileId: string,
): Promise<{ conversationId: string }> {
  return post(`/social/${profileId}/direct`, { friendProfileId });
}
export function createGroup(
  profileId: string,
  name: string,
  memberIds: string[],
): Promise<{ conversationId: string }> {
  return post(`/social/${profileId}/group`, { name, memberIds });
}
export function shareSubjectInApp(
  profileId: string,
  conversationId: string,
  subjectId: string,
): Promise<ChatMessage> {
  return post(`/social/${profileId}/share-subject`, { conversationId, subjectId });
}

// ---------------- Système ÉCHANGER — Phase D : protections ----------------
export function blockUser(profileId: string, targetProfileId: string): Promise<{ ok: true }> {
  return post(`/social/${profileId}/block`, { targetProfileId });
}
export function unblockUser(profileId: string, targetProfileId: string): Promise<{ ok: true }> {
  return post(`/social/${profileId}/unblock`, { targetProfileId });
}
export function reportUser(
  profileId: string,
  reportedProfileId: string,
  reason: string,
  conversationId: string | null,
): Promise<{ ok: true }> {
  return post(`/social/${profileId}/report`, { reportedProfileId, reason, conversationId });
}
// Élève : remise à 0 (messages + amis)
export function requestReset(
  profileId: string,
  scope: 'messages' | 'account' = 'messages',
): Promise<ResetRequest> {
  return post(`/protections/reset/${profileId}/request`, { scope });
}
// Modérateur
export function getModeratorQueue(profileId: string): Promise<ModeratorQueue> {
  return get(`/protections/moderator/${profileId}/queue`);
}
export function resolveReport(profileId: string, reportId: string): Promise<{ ok: true }> {
  return post(`/protections/moderator/${profileId}/report/${reportId}/resolve`, {});
}
export function decideReset(
  profileId: string,
  resetId: string,
  approve: boolean,
): Promise<{ ok: true }> {
  return post(`/protections/moderator/${profileId}/reset/${resetId}/decide`, { approve });
}
export function resolveAiFlag(profileId: string, flagId: string): Promise<{ ok: true }> {
  return post(`/protections/moderator/${profileId}/ai-flag/${flagId}/resolve`, {});
}
// Parent (Espace responsable)
export function getGuardianControls(childAccountId: string): Promise<GuardianControls> {
  return get(`/protections/parent/${childAccountId}/controls`);
}
export function setSupervised(
  childAccountId: string,
  on: boolean,
  guardianEmail = '',
): Promise<{ supervised: boolean }> {
  return post(`/protections/parent/${childAccountId}/supervised`, { on, guardianEmail });
}
export function decideSupervision(
  childAccountId: string,
  itemId: string,
  approve: boolean,
): Promise<{ ok: true }> {
  return post(`/protections/parent/${childAccountId}/supervision/${itemId}/decide`, { approve });
}
export function decideChildReset(
  childAccountId: string,
  resetId: string,
  approve: boolean,
): Promise<{ ok: true }> {
  return post(`/protections/parent/${childAccountId}/child-reset/${resetId}/decide`, { approve });
}
export function parentReset(
  childAccountId: string,
  scope: 'messages' | 'account' = 'messages',
): Promise<ResetRequest> {
  return post(`/protections/parent/${childAccountId}/reset`, { scope });
}

// ---------------- Système ÉCHANGER — Phase B : Ma Classe ----------------
export function getMyClass(profileId: string): Promise<MyClassView> {
  return get(`/classes/mine/${profileId}`);
}
export function assignClasses(profileId: string, schoolYear = 2026): Promise<AssignResult> {
  return post(`/classes/assign/${profileId}`, { schoolYear });
}

// ---------------- Système ÉCHANGER — Phase C : traduction temps réel ----------------
export function translateMessage(
  profileId: string,
  text: string,
  targetLang: string,
): Promise<TranslationResult> {
  return post(`/translate/${profileId}`, { text, targetLang });
}

// ---------------- Système ÉCHANGER — Temps réel (SSE + présence) ----------------
export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session?.access_token ?? '';
}
export function realtimeStreamUrl(profileId: string, token: string): string {
  return `${API_BASE}/realtime/${profileId}/stream?token=${encodeURIComponent(token)}`;
}
export function heartbeatPresence(profileId: string): Promise<{ ok: true }> {
  return post(`/realtime/${profileId}/heartbeat`, {});
}
export function getPresence(profileId: string, ids: string[]): Promise<Record<string, boolean>> {
  return get(`/realtime/${profileId}/presence?ids=${ids.join(',')}`);
}
export function sendTyping(profileId: string, conversationId: string): Promise<{ ok: true }> {
  return post(`/social/${profileId}/conversation/${conversationId}/typing`, {});
}

// ---------------- Comptes parent/enfant liés ----------------
export interface ChildLink {
  childAccountId: string;
  name: string;
  tier: 'enfant' | 'mineur' | 'majeur';
  activationStatus: string;
  needsParentConfirmation: boolean;
}
export function getMyChildren(): Promise<ChildLink[]> {
  return get('/accounts/me/children');
}
export function confirmChildAccount(childAccountId: string): Promise<{ ok: boolean }> {
  return post(`/accounts/me/confirm-child/${childAccountId}`, {});
}

// ---------------- Cours de langue « Parler » ----------------
export function getLanguages(profileId: string): Promise<LanguagesView> {
  return get(`/languages/${profileId}`);
}
export function chooseLanguage(profileId: string, lang: string): Promise<LanguagesView> {
  return post(`/languages/${profileId}/choose`, { lang });
}
export function composeLanguageSession(profileId: string, lang: string): Promise<LanguageCompose> {
  return aiTask({ state: 'preparing', message: 'Je prépare ta séance…' }, () =>
    post(`/languages/${profileId}/session/compose`, { lang }),
  );
}
export function ingestLanguageSession(
  profileId: string,
  lang: string,
  summary: string,
): Promise<LanguageIngestResult> {
  return aiTask({ state: 'reading', message: 'Je lis ce que tu as fait…' }, () =>
    post(`/languages/${profileId}/session/ingest`, { lang, summary }),
  );
}
export interface LanguageCourseResult {
  sheet: CourseSheet;
  name: string;
  cefr: string;
  creditsSpent: number;
}
/** Cours de langue NATIF (AUTO) : l'IA de Dowze génère la feuille A4 (rendue en app). */
export function generateLanguageCourse(
  profileId: string,
  lang: string,
): Promise<LanguageCourseResult> {
  return aiTask({ state: 'preparing', message: 'Je prépare ton cours…' }, () =>
    post(`/languages/${profileId}/course`, { lang }),
  );
}
/** Clôture du cours natif de langue : l'app a dérivé l'outcome → Dowze recalcule le niveau. */
export function closeLanguageCourse(
  profileId: string,
  lang: string,
  outcome: 'solide' | 'progres' | 'faible',
): Promise<{ levelBefore: number; levelAfter: number; cefr: string; streak: number }> {
  return post(`/languages/${profileId}/course/close`, { lang, outcome });
}
export function getLanguageClasses(profileId: string): Promise<LanguageClass[]> {
  return get(`/languages/${profileId}/classes`);
}
export function languageChatbot(
  profileId: string,
  conversationId: string,
  lang: string,
  userText: string,
): Promise<{ ok: true }> {
  return post(`/languages/${profileId}/chatbot`, { conversationId, lang, userText });
}

// ---------------- Cours secondaire « Ma passion » ----------------
export function getElective(profileId: string): Promise<ElectiveView> {
  return get(`/electives/${profileId}`);
}
export function startDiscovery(
  profileId: string,
  disciplines: DiscoveryDiscipline[],
  round = 1,
): Promise<ElectiveView> {
  return post(`/electives/${profileId}/discovery/start`, { disciplines, round });
}
export function nextDiscipline(profileId: string): Promise<ElectiveView> {
  return post(`/electives/${profileId}/discovery/next`, {});
}
export function addElectiveJournal(
  profileId: string,
  entry: { discipline: string; did: string; liked: string; disliked: string; intensity: number },
): Promise<ElectiveView> {
  return post(`/electives/${profileId}/journal`, entry);
}
export function analyzeElective(profileId: string): Promise<ElectiveProposal[]> {
  return post(`/electives/${profileId}/analyze`, {});
}
export function chooseElective(
  profileId: string,
  input: { label: string; disciplineHint?: string; mode?: 'plaisir' | 'pro' },
): Promise<ElectiveView> {
  return post(`/electives/${profileId}/choose`, input);
}
export function setElectiveMode(profileId: string, mode: 'plaisir' | 'pro'): Promise<ElectiveView> {
  return post(`/electives/${profileId}/mode`, { mode });
}
export function proposeElectiveChange(profileId: string, target: string): Promise<ElectiveView> {
  return post(`/electives/${profileId}/change/propose`, { target });
}
export function confirmElectiveChange(profileId: string): Promise<ElectiveView> {
  return post(`/electives/${profileId}/change/confirm`, {});
}
export function cancelElectiveChange(profileId: string): Promise<ElectiveView> {
  return post(`/electives/${profileId}/change/cancel`, {});
}
export function exitElective(profileId: string): Promise<ElectiveView> {
  return post(`/electives/${profileId}/exit`, {});
}
export function generateElectivePlan(profileId: string): Promise<ElectivePlan> {
  return post(`/electives/${profileId}/plan/generate`, {});
}
export function completeElectiveMilestone(
  profileId: string,
  milestoneId: string,
): Promise<ElectivePlan> {
  return post(`/electives/${profileId}/milestone/done`, { milestoneId });
}

// ---------------- Budget temps quotidien ----------------
export function getDailyBudget(profileId: string): Promise<DailyBudgetView> {
  return get(`/planning/${profileId}/budget`);
}

// ---------------- Planning / calendrier (profil de disponibilité + emploi du temps généré) ----------------
export function getSchedule(profileId: string): Promise<ScheduleView> {
  return get(`/schedule/${profileId}`);
}
export function setSchedulePreset(profileId: string, preset: string): Promise<ScheduleView> {
  return post(`/schedule/${profileId}/preset`, { preset });
}
export function setScheduleConfig(
  profileId: string,
  config: { activeDays: number[]; dayStartMin: number; dayEndMin: number; intensity: Intensity },
): Promise<ScheduleView> {
  return post(`/schedule/${profileId}/config`, config);
}
export function addVacation(
  profileId: string,
  startDate: string,
  endDate: string,
  label: string,
): Promise<ScheduleView> {
  return post(`/schedule/${profileId}/vacation`, { startDate, endDate, label });
}
export function removeVacation(profileId: string, id: string): Promise<ScheduleView> {
  return post(`/schedule/${profileId}/vacation/${id}/remove`, {});
}
