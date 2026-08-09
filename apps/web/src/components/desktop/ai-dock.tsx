'use client';

// Pont IA (ChatGPT/Claude) de l'application de bureau Dowze — cf. docs/13-COMPAGNON/05-pont-webview-tauri.md.
//
// La VRAIE webview IA est un onglet navigateur natif (WebKitGTK/WebView2/WKWebView) docké À DROITE par le
// Rust (pur Tauri multiwebview). GTK réduit tout seul le panneau Dowze pour lui laisser la place : ce
// composant ne réserve donc AUCUN espace, il fournit juste (1) le lanceur + le sélecteur d'IA, (2) l'injection
// automatique du prompt de contexte à l'ouverture (aucun copier-coller pour l'élève), et (3) l'écoute des
// conversations captées → Mémorialiste (POST /companion/bridge/ingest).

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isDesktop, aiPanelOpen, aiPanelClose, aiInject, onAiConversation } from '@/lib/desktop';
import { getBridgeContext, bridgeIngest } from '@/lib/api';
import { IconSparkles, IconX } from '@/components/ui/icons';

export type AiProvider = 'claude' | 'chatgpt';
const PROVIDERS: { id: AiProvider; label: string; url: string }[] = [
  { id: 'claude', label: 'Claude', url: 'https://claude.ai' },
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com' },
];

/** Injecte le prompt de contexte Dowze dans l'IA (si l'élève a un compte + un contexte de cours). */
async function injectContext() {
  try {
    const ctx = await getBridgeContext();
    if (ctx?.prompt) await aiInject(ctx.prompt);
  } catch {
    /* pas connecté ou pas de contexte : l'élève utilise l'IA telle quelle */
  }
}

export function AiBridge() {
  const [desktop, setDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('claude');
  const lastSent = useRef('');
  const ingestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setDesktop(isDesktop()), []);

  // Ouvre/affiche la bonne IA + injecte le contexte. (Re)joué à l'ouverture et au changement d'IA.
  useEffect(() => {
    if (!desktop || !open) return;
    const p = PROVIDERS.find((x) => x.id === provider)!;
    aiPanelOpen(p.url).then(injectContext).catch(() => {});
  }, [desktop, open, provider]);

  // Écoute les conversations captées dans la webview IA → Mémorialiste (débounce + dédup).
  useEffect(() => {
    if (!desktop) return;
    const unsub = onAiConversation(({ source, text }) => {
      // On ne synthétise que les vraies conversations (pas les pings de diagnostic __ready__/__inject__).
      if (source !== 'chatgpt' && source !== 'claude') return;
      if (!text || text === lastSent.current) return;
      if (ingestTimer.current) clearTimeout(ingestTimer.current);
      ingestTimer.current = setTimeout(() => {
        lastSent.current = text;
        bridgeIngest(source, text).catch(() => {});
      }, 4000);
    });
    return () => {
      unsub();
      // Annule le débounce en attente : sinon un ingest peut partir jusqu'à 4 s après le démontage.
      if (ingestTimer.current) clearTimeout(ingestTimer.current);
    };
  }, [desktop]);

  const close = useCallback(() => {
    setOpen(false);
    aiPanelClose().catch(() => {});
  }, []);

  if (!desktop || typeof document === 'undefined') return null;

  // Lanceur (fermé) ou barre de contrôle (ouvert). ⚠️ On PORTALISE dans <body> : un ancêtre avec `transform`
  // (rail/lanceur Dowze) casserait le `position:fixed` (il deviendrait relatif à l'ancêtre) → bouton hors écran.
  const node = !open ? (
    <button
      onClick={() => setOpen(true)}
      aria-label="Ouvrir l'assistant IA"
      className="fixed right-3 top-12 z-[60] flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-md transition hover:bg-muted"
    >
      <IconSparkles className="h-4 w-4" /> IA
    </button>
  ) : (
    <div className="fixed right-2 top-12 z-[60] flex items-center gap-1 rounded-full border border-border bg-surface/95 px-1.5 py-1 shadow-md backdrop-blur">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => setProvider(p.id)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            provider === p.id ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={close}
        aria-label="Fermer l'assistant IA"
        className="rounded-full p-1 text-muted-foreground transition hover:bg-muted"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );

  return createPortal(node, document.body);
}
