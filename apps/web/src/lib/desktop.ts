// Pont vers l'application de bureau (Tauri). En navigateur web, `isDesktop()` est faux et
// aucune de ces fonctions n'est appelée → l'app web reste strictement identique.
// En desktop, on parle aux OUTILS LOCAUX écrits en Rust (recherche web SearXNG/DuckDuckGo, Wikipédia)
// via le pont global Tauri (`window.__TAURI__.core.invoke`).

interface TauriWindow {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  startDragging: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}
type TauriGlobal = {
  core?: { invoke?: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> };
  window?: { getCurrentWindow?: () => TauriWindow };
  event?: {
    listen?: <T>(
      event: string,
      handler: (e: { payload: T }) => void,
    ) => Promise<() => void>;
  };
};

function tauri(): TauriGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
}

/** Vrai uniquement dans l'application de bureau Dowze (Tauri). */
export function isDesktop(): boolean {
  return !!tauri()?.core?.invoke;
}

/** Fenêtre courante (contrôles natifs) — desktop uniquement. */
function currentWindow(): TauriWindow | undefined {
  return tauri()?.window?.getCurrentWindow?.();
}
export const win = {
  minimize: () => currentWindow()?.minimize(),
  toggleMaximize: () => currentWindow()?.toggleMaximize(),
  close: () => currentWindow()?.close(),
  startDragging: () => currentWindow()?.startDragging(),
  isMaximized: async () => (await currentWindow()?.isMaximized()) ?? false,
};

export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = tauri()?.core?.invoke;
  if (!fn) return Promise.reject(new Error('Application de bureau indisponible.'));
  return fn<T>(cmd, args);
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  /** "searxng" | "duckduckgo" | "wikipedia" */
  source: string;
}

/** Recherche web (SearXNG par défaut, repli DuckDuckGo). Desktop uniquement. */
export function webSearch(query: string, engine?: 'searxng' | 'duckduckgo'): Promise<WebResult[]> {
  return invoke<WebResult[]>('web_search', { query, engine });
}

/** Recherche encyclopédique Wikipédia (API officielle). Desktop uniquement. */
export function wikipediaSearch(query: string, lang = 'fr'): Promise<WebResult[]> {
  return invoke<WebResult[]>('wikipedia_search', { query, lang });
}

/** Ouvre une URL dans le navigateur par défaut du système. Desktop uniquement. */
export function openExternal(url: string): Promise<void> {
  return invoke<void>('open_external', { url });
}

// --- Pont IA (ChatGPT/Claude) : panneau navigateur docké à droite, géré 100% par Dowze. Desktop uniquement. ---

/** Ouvre/affiche le panneau IA (webview native ChatGPT/Claude) à droite, largeur `width` px. */
export function aiPanelOpen(url: string, width = 420): Promise<void> {
  return invoke<void>('ai_panel_open', { url, width });
}

/** Cache le panneau IA (la session/login est préservée ; rouvrir restaure tout). */
export function aiPanelClose(): Promise<void> {
  return invoke<void>('ai_panel_close');
}

/** Injecte un prompt de contexte dans le champ de saisie de l'IA (aucun copier-coller pour l'élève). */
export function aiInject(text: string): Promise<void> {
  return invoke<void>('ai_inject', { text });
}

/** Conversation captée dans la webview IA et remontée par le Rust (via l'événement core Tauri). */
export interface AiConversation {
  source: string;
  text: string;
}

/**
 * S'abonne aux conversations captées dans le panneau IA. `cb` reçoit `{ source, text }` à chaque
 * changement significatif. Renvoie une fonction de désabonnement. No-op hors desktop.
 */
export function onAiConversation(cb: (c: AiConversation) => void): () => void {
  const listen = tauri()?.event?.listen;
  if (!listen) return () => {};
  let un: (() => void) | undefined;
  let cancelled = false;
  listen<AiConversation>('dowze://ai-conversation', (e) => cb(e.payload)).then((u) => {
    if (cancelled) u();
    else un = u;
  });
  return () => {
    cancelled = true;
    un?.();
  };
}
