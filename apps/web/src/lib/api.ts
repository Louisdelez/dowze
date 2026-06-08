import type { BridgeOperation } from '@dowze/schemas';

/** Client minimal vers le backend Dowze (l'intra-core). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} — ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
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

export interface MasteryRow {
  skillId: string;
  pMastery: number;
  attempts: number;
  correct: number;
}

export function getProgression(profileId: string): Promise<MasteryRow[]> {
  return get(`/progression/${profileId}`);
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
