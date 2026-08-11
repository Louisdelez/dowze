/**
 * @dowze/api-client — SDK typé du cœur Dowze (skeleton).
 *
 * En P1/P3, les méthodes scopées (`/v1/plugins`, `/v1/calendar/recurring`,
 * `/v1/ai/compose`…) seront **générées depuis l'OpenAPI** du cœur. Pour l'instant
 * on expose seulement le socle : base URL, jeton porteur (JWT de la session
 * partagée) et un `request()` typé. Les plugins consommeront ce client.
 */

export interface DowzeClientOptions {
  /** URL de la gateway (ex. https://api.dowze.ch). */
  baseUrl: string;
  /** Fournit le JWT courant (depuis la session partagée `.dowze.ch`). */
  getAccessToken: () => string | null | Promise<string | null>;
}

export class DowzeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DowzeApiError';
  }
}

export class DowzeClient {
  constructor(private readonly opts: DowzeClientOptions) {}

  /**
   * Requête authentifiée vers le cœur. `path` est relatif à la version d'API
   * (préfixe `/v1/` ajouté par la gateway côté serveur en P1).
   */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.opts.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${this.opts.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new DowzeApiError(res.status, body || res.statusText);
    }
    return (await res.json()) as T;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compagnon — le cœur commun à TOUTES les apps Dowze (agents, mémoire, ruche,
// relais MCP). Rattaché au profil (pas à l'académie) : n'importe quelle app peut
// l'appeler. Endpoints réels : `/companion/*` (pas de préfixe /v1).
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentPersonality {
  tone?: string;
  traits?: string[];
  description?: string;
  emoji?: string;
  greeting?: string;
  rules?: string[];
}
export interface CompanionAgent {
  id: string;
  name: string;
  skinUrl: string | null;
  size: number;
  personality: AgentPersonality | null;
  role: string | null;
  roleContract: {
    responsibilities?: string[];
    capabilities?: string[];
    limitations?: string[];
    delegatesTo?: string[];
    escalationPath?: string[];
    allowedTools?: string[];
  };
  space: string;
  room: string;
  pos: { c: number; r: number } | null;
  isPrimary: boolean;
  /** 'pnj' (scripté) | 'agent' (IA) | 'relay' (pont Claude Code/Codex). */
  mode: 'pnj' | 'agent' | 'relay' | string;
}
export interface CompanionMessage {
  sender: string;
  text: string;
  at: number;
}
export interface CompanionSpace {
  id: string;
  name: string;
}
export interface CompanionDelegate {
  name: string;
  role: string | null;
  said: string;
}
export interface OrchestrateResult {
  reply: string;
  delegates: CompanionDelegate[];
  /** Abeilles créées à la volée pour répondre (la ruche s'agrandit). */
  created: string[];
  /** Outils (boucle ReAct) mobilisés par le leader/les abeilles : `calculatrice`, `date_heure`, `chercher_connaissances`. */
  toolsUsed?: string[];
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
  expiresAt: string | null;
  createdAt: string;
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
export interface HiveAttentionItem {
  id: string;
  kind: 'approval' | 'decision' | 'blocker' | 'warning' | 'information';
  priority: 'low' | 'normal' | 'high' | 'critical';
  title: string;
  details: string;
  options: { id: string; label: string }[];
  status: 'open' | 'resolved' | 'dismissed' | 'expired';
  createdAt: string;
}
export interface HiveCompanionRelationship {
  agentId: string;
  affinity: number;
  trust: number;
  familiarity: number;
  interactionCount: number;
  lastInteractionAt: string | null;
  updatedAt: string;
}
export interface HiveAsset {
  id: string;
  space: string;
  name: string;
  assetType: 'server' | 'database' | 'firewall' | 'vps' | 'service' | 'device' | 'other';
  visualKey: string;
  room: string | null;
  position: { c?: number; r?: number } | null;
  endpoint: string | null;
  purpose: string;
  environment: 'development' | 'staging' | 'production' | 'personal';
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  vaultItemId: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
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
export interface HiveCapability {
  id: string;
  key: string;
  label: string;
  description: string;
  modality: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}
export interface HiveSpacePackage {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string;
  visibility: 'private' | 'shared' | 'official';
  manifest: Record<string, unknown>;
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

/**
 * Client du compagnon commun. Construit depuis un `DowzeClient` :
 * `const companion = new CompanionApi(new DowzeClient({ baseUrl, getAccessToken }))`.
 * Utilisable tel quel par n'importe quelle app de l'écosystème.
 */
export class CompanionApi {
  constructor(private readonly client: DowzeClient) {}

  /** Compagnons d'un espace (défaut : la Maison). Sème le principal au besoin. */
  listAgents(space = 'home'): Promise<CompanionAgent[]> {
    return this.client.request<CompanionAgent[]>(
      `/companion/agents?space=${encodeURIComponent(space)}`,
    );
  }
  /** Auto-builder IA : « décris ton compagnon en une phrase » → Dowze le construit. Tout domaine. */
  buildAgent(
    description: string,
    skinUrl?: string | null,
    space?: string,
  ): Promise<CompanionAgent> {
    return this.client.request<CompanionAgent>('/companion/agents/build', {
      method: 'POST',
      body: JSON.stringify({ description, skinUrl, space }),
    });
  }
  deleteAgent(id: string): Promise<{ ok: true }> {
    return this.client.request<{ ok: true }>(`/companion/agents/${id}`, { method: 'DELETE' });
  }
  /** Chat IA avec un compagnon-agent (mémoire + apprentissage côté serveur). */
  chat(
    id: string,
    message: string,
  ): Promise<{ reply: string; learned?: string; toolsUsed?: string[] }> {
    return this.client.request(`/companion/agents/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }
  messages(id: string): Promise<CompanionMessage[]> {
    return this.client.request<CompanionMessage[]>(`/companion/agents/${id}/messages`);
  }
  /**
   * Ruche : un LEADER (le principal ou un compagnon de la Maison via `leaderId`) décompose, délègue aux
   * abeilles des open-spaces et synthétise dans sa voix.
   */
  orchestrate(message: string, leaderId?: string): Promise<OrchestrateResult> {
    return this.client.request<OrchestrateResult>('/companion/orchestrate', {
      method: 'POST',
      body: JSON.stringify(leaderId ? { message, leaderId } : { message }),
    });
  }
  /** Mémoire universelle : événements significatifs, indépendants des sessions de modèles. */
  events(filters: { limit?: number; kind?: string; space?: string } = {}): Promise<HiveEvent[]> {
    const query = new URLSearchParams();
    if (filters.limit) query.set('limit', String(filters.limit));
    if (filters.kind) query.set('kind', filters.kind);
    if (filters.space) query.set('space', filters.space);
    return this.client.request(`/companion/hive/events${query.size ? `?${query}` : ''}`);
  }
  searchMemory(filters: {
    q?: string;
    from?: string;
    to?: string;
    actor?: string;
    space?: string;
    kind?: string;
    limit?: number;
  }): Promise<HiveEvent[]> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== '') query.set(key, String(value));
    return this.client.request(`/companion/hive/memory/search?${query}`);
  }
  eventProvenance(
    id: string,
  ): Promise<{ rootId: string; nodes: HiveEvent[]; edges: { from: string; to: string }[] }> {
    return this.client.request(`/companion/hive/events/${id}/provenance`);
  }
  vaultItems(): Promise<HiveVaultItem[]> {
    return this.client.request('/companion/hive/vault/items');
  }
  createVaultItem(input: {
    label: string;
    secret: string;
    kind?: string;
    space?: string;
  }): Promise<HiveVaultItem> {
    return this.client.request('/companion/hive/vault/items', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  accessRequests(status?: HiveAccessRequest['status']): Promise<HiveAccessRequest[]> {
    return this.client.request(`/companion/hive/vault/access${status ? `?status=${status}` : ''}`);
  }
  requestVaultAccess(input: {
    vaultItemId: string;
    requesterAgentId?: string;
    purpose: string;
    seconds: number;
  }): Promise<HiveAccessRequest & { claimToken: string }> {
    return this.client.request('/companion/hive/vault/access', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  decideVaultAccess(
    id: string,
    decision: 'approve' | 'deny' | 'revoke',
    reason?: string,
  ): Promise<HiveAccessRequest> {
    return this.client.request(`/companion/hive/vault/access/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason }),
    });
  }
  consumeVaultAccess(
    id: string,
    grantToken: string,
  ): Promise<{ id: string; label: string; kind: string; secret: string }> {
    return this.client.request(`/companion/hive/vault/access/${id}/consume`, {
      method: 'POST',
      body: JSON.stringify({ grantToken }),
    });
  }
  runtimes(): Promise<HiveRuntimeView[]> {
    return this.client.request('/companion/hive/runtimes');
  }
  setRuntimeEnabled(id: string, enabled: boolean): Promise<HiveRuntimeView> {
    return this.client.request(`/companion/hive/runtimes/${id}/enabled`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  }
  executeRuntime(input: {
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
    return this.client.request('/companion/hive/runtimes/execute', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  attention(status: HiveAttentionItem['status'] | 'all' = 'open'): Promise<HiveAttentionItem[]> {
    return this.client.request(`/companion/hive/attention?status=${status}`);
  }
  resolveAttention(
    id: string,
    action: string,
    note?: string,
    dismiss = false,
  ): Promise<HiveAttentionItem> {
    return this.client.request(`/companion/hive/attention/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, note, dismiss }),
    });
  }
  relationships(): Promise<HiveCompanionRelationship[]> {
    return this.client.request('/companion/hive/relationships');
  }
  assets(space?: string): Promise<HiveAsset[]> {
    return this.client.request(
      `/companion/hive/assets${space ? `?space=${encodeURIComponent(space)}` : ''}`,
    );
  }
  createAsset(input: {
    space: string;
    name: string;
    assetType: HiveAsset['assetType'];
    purpose?: string;
    endpoint?: string;
    environment?: HiveAsset['environment'];
    vaultItemId?: string;
  }): Promise<HiveAsset> {
    return this.client.request('/companion/hive/assets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  updateAssetStatus(id: string, status: HiveAsset['status']): Promise<HiveAsset> {
    return this.client.request(`/companion/hive/assets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
  runs(limit = 50): Promise<HiveRun[]> {
    return this.client.request(`/companion/hive/runs?limit=${limit}`);
  }
  run(id: string): Promise<HiveRun & { tasks: HiveTask[] }> {
    return this.client.request(`/companion/hive/runs/${id}`);
  }
  capabilities(): Promise<HiveCapability[]> {
    return this.client.request('/companion/hive/capabilities');
  }
  companionStates(): Promise<HiveCompanionState[]> {
    return this.client.request('/companion/hive/companion-states');
  }
  computeResources(): Promise<HiveComputeResource[]> {
    return this.client.request('/companion/hive/compute-resources');
  }
  createComputeResource(input: {
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
    return this.client.request('/companion/hive/compute-resources', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  updateComputeResource(
    id: string,
    patch: {
      health?: HiveComputeResource['health'];
      enabled?: boolean;
      maxConcurrency?: number;
    },
  ): Promise<HiveComputeResource> {
    return this.client.request(`/companion/hive/compute-resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
  /** Passages de relais organisationnels avec provenance et état. */
  handoffs(status?: HiveHandoff['status']): Promise<HiveHandoff[]> {
    return this.client.request(
      `/companion/hive/handoffs${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
  }
  transitionHandoff(id: string, status: HiveHandoff['status']): Promise<HiveHandoff> {
    return this.client.request(`/companion/hive/handoffs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }
  deliverEvent(input: {
    eventId: string;
    companionId?: string;
    channel: HiveChannel;
  }): Promise<{ id: string; status: string; renderedContent: string }> {
    return this.client.request('/companion/hive/deliveries', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
  spaces(): Promise<CompanionSpace[]> {
    return this.client.request<CompanionSpace[]>('/companion/spaces');
  }
  spacePackages(): Promise<HiveSpacePackage[]> {
    return this.client.request('/companion/spaces/packages');
  }
  installSpacePackage(
    id: string,
    mode: 'join' | 'create',
    name?: string,
  ): Promise<{ space: CompanionSpace }> {
    return this.client.request(`/companion/spaces/packages/${id}/install`, {
      method: 'POST',
      body: JSON.stringify({ mode, name }),
    });
  }
  /** Relais Claude Code / Codex : génère un jeton MCP (montré une seule fois). */
  createRelayToken(label?: string): Promise<{ token: string; name: string }> {
    return this.client.request('/companion/relay/token', {
      method: 'POST',
      body: JSON.stringify(label ? { label } : {}),
    });
  }
  /** Téléphone → Claude Code : met une instruction en file d'attente. */
  relaySay(text: string): Promise<{ ok: true }> {
    return this.client.request('/companion/relay/say', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }
}
