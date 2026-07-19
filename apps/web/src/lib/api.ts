import type {
  AiEmbeddingModel,
  AiModel,
  BridgeOperation,
  CopiloteSettingsView,
  SessionSnapshot,
} from '@dowze/schemas';
import { getSupabase } from '@/lib/supabase';

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
  return post('/planning/generate', { profileId, weekStartIso });
}

export interface RubricCriterionRow {
  id: string;
  label: string;
  description: string;
  required: boolean;
}
export interface RubricRow {
  skillId: string;
  criteria: RubricCriterionRow[];
}

export function getRubric(skillId: string): Promise<RubricRow | null> {
  return get(`/validation/rubric/${skillId}`);
}

export interface VerdictInput {
  criterionId: string;
  met: boolean;
}

export function selfValidate(
  profileId: string,
  skillId: string,
  verdicts: VerdictInput[],
): Promise<{ passed: boolean }> {
  return post('/validation/self', { profileId, skillId, verdicts });
}

export interface BadgeSummaryRow {
  badge: string;
  peerPassed: boolean;
  expertEndorsed: boolean;
  reviewerCount: number;
}

export function getBadge(skillId: string, learnerId: string): Promise<BadgeSummaryRow> {
  return get(`/validation/badge/${skillId}/${learnerId}`);
}

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

export interface ParentalSummaryRow {
  profileId: string | null;
  masteredCount: number;
  inProgressCount: number;
  planningCount: number;
}
export function getParentalSummary(minorAccountId: string): Promise<ParentalSummaryRow> {
  return get(`/parental/summary/${minorAccountId}`);
}

export interface RegisterAccountInput {
  email: string;
  authUserId?: string | null;
  isMinor: boolean;
  displayName: string;
  locale: string;
  timezone: string;
  guardianEmail?: string | null;
}
export interface RegisterAccountResult {
  account: { id: string };
  profile: { id: string };
}
export function registerAccount(input: RegisterAccountInput): Promise<RegisterAccountResult> {
  return post('/accounts', input);
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

export interface PlacementResult {
  masteredSkillIds: string[];
  entrySkillId: string | null;
}
export function runDiagnostic(
  profileId: string,
  demonstratedSkillIds: string[],
): Promise<PlacementResult> {
  return post('/diagnostic', { profileId, demonstratedSkillIds });
}

export interface ExpeditionRow {
  id: string;
  slug: string;
  title: string;
  grandeQuestion: string;
  phase: string;
  status: string;
  durationWeeks: number;
}
export function listExpeditions(): Promise<ExpeditionRow[]> {
  return get('/expeditions');
}
export interface CreateExpeditionInput {
  slug: string;
  title: string;
  grandeQuestion: string;
  durationWeeks?: number;
}
export function createExpedition(input: CreateExpeditionInput): Promise<ExpeditionRow> {
  return post('/expeditions', input);
}
export function advanceExpedition(
  id: string,
): Promise<{ id: string; phase: string; status: string }> {
  return post(`/expeditions/${id}/advance`, {});
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
  return post('/copilote/compose', { profileId });
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
  return post('/copilote/ingest', { profileId, skillId, summary, modelId });
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
  billing?: 'credits' | 'byok';
  byokProvider?: AiModel['provider'] | null;
  byokApiKey?: string | null;
  embeddingModelId?: string | null;
  embeddingApiKey?: string | null;
}
export function updateCopiloteSettings(
  input: UpdateCopiloteSettingsInput,
): Promise<CopiloteSettingsView> {
  return post('/copilote/settings', input);
}

export function getCredits(profileId: string): Promise<{ profileId: string; balance: number }> {
  return get(`/copilote/balance/${profileId}`);
}
