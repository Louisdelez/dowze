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

/**
 * Client du compagnon commun. Construit depuis un `DowzeClient` :
 * `const companion = new CompanionApi(new DowzeClient({ baseUrl, getAccessToken }))`.
 * Utilisable tel quel par n'importe quelle app de l'écosystème.
 */
export class CompanionApi {
  constructor(private readonly client: DowzeClient) {}

  /** Compagnons d'un espace (défaut : la Maison). Sème le principal au besoin. */
  listAgents(space = 'home'): Promise<CompanionAgent[]> {
    return this.client.request<CompanionAgent[]>(`/companion/agents?space=${encodeURIComponent(space)}`);
  }
  /** Auto-builder IA : « décris ton compagnon en une phrase » → Dowze le construit. Tout domaine. */
  buildAgent(description: string, skinUrl?: string | null, space?: string): Promise<CompanionAgent> {
    return this.client.request<CompanionAgent>('/companion/agents/build', {
      method: 'POST',
      body: JSON.stringify({ description, skinUrl, space }),
    });
  }
  deleteAgent(id: string): Promise<{ ok: true }> {
    return this.client.request<{ ok: true }>(`/companion/agents/${id}`, { method: 'DELETE' });
  }
  /** Chat IA avec un compagnon-agent (mémoire + apprentissage côté serveur). */
  chat(id: string, message: string): Promise<{ reply: string; learned?: string; toolsUsed?: string[] }> {
    return this.client.request(`/companion/agents/${id}/chat`, { method: 'POST', body: JSON.stringify({ message }) });
  }
  messages(id: string): Promise<CompanionMessage[]> {
    return this.client.request<CompanionMessage[]>(`/companion/agents/${id}/messages`);
  }
  /**
   * Ruche : un LEADER (le principal ou un compagnon de la Maison via `leaderId`) décompose, délègue aux
   * abeilles des open-spaces et synthétise dans sa voix.
   */
  orchestrate(message: string, leaderId?: string): Promise<OrchestrateResult> {
    return this.client.request<OrchestrateResult>('/companion/orchestrate', { method: 'POST', body: JSON.stringify(leaderId ? { message, leaderId } : { message }) });
  }
  spaces(): Promise<CompanionSpace[]> {
    return this.client.request<CompanionSpace[]>('/companion/spaces');
  }
  /** Relais Claude Code / Codex : génère un jeton MCP (montré une seule fois). */
  createRelayToken(label?: string): Promise<{ token: string; name: string }> {
    return this.client.request('/companion/relay/token', { method: 'POST', body: JSON.stringify(label ? { label } : {}) });
  }
  /** Téléphone → Claude Code : met une instruction en file d'attente. */
  relaySay(text: string): Promise<{ ok: true }> {
    return this.client.request('/companion/relay/say', { method: 'POST', body: JSON.stringify({ text }) });
  }
}
