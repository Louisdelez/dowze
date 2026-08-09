'use client';

import { useEffect, useState } from 'react';
import { isDesktop, win } from '@/lib/desktop';

/**
 * Barre de titre custom (thème Dowze) — remplace la barre native (décorations désactivées côté Tauri).
 * Ne s'affiche QUE dans l'application de bureau. Zone glissable pour déplacer la fenêtre + contrôles.
 */
export function DesktopTitlebar() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(isDesktop());
  }, []);
  if (!desktop) return null;

  return (
    <div
      data-tauri-drag-region
      onMouseDown={(e) => {
        if (e.button === 0 && (e.target as HTMLElement).dataset.tauriDragRegion !== undefined)
          win.startDragging();
      }}
      onDoubleClick={() => win.toggleMaximize()}
      className="flex h-9 shrink-0 select-none items-center justify-between border-b border-border bg-surface px-3"
    >
      {/* Marque */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 text-sm font-black tracking-tight text-foreground"
      >
        <span className="grid h-5 w-5 place-items-center rounded-md bg-accent text-[11px] font-black text-accent-foreground">
          D
        </span>
        Dowze
      </div>

      {/* Contrôles fenêtre */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => win.minimize()}
          aria-label="Réduire"
          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M5 12h14" />
          </svg>
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          aria-label="Agrandir"
          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <button
          onClick={() => win.close()}
          aria-label="Fermer"
          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-[#ef4444] hover:text-white"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
