'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from './cn';

export interface LauncherApp {
  slug: string;
  name: string;
  url: string; // https://academie.dowze.ch, https://fitness.dowze.ch…
  color?: string; // pastille (emerald, sky, blue…)
  current?: boolean;
}

const DOT: Record<string, string> = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  violet: 'bg-violet-500',
};

/**
 * AppLauncher — grille des apps de l'écosystème Dowze activées par l'utilisateur (academie + plugins).
 * Commun à toutes les apps (`@dowze/ui`), icônes Lucide inline (jamais d'emoji). Navigation inter-apps
 * en pleine page (sous-domaines `.dowze.ch`, session partagée).
 */
export function AppLauncher({ apps }: { apps: LauncherApp[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Mes apps Dowze"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        {/* Lucide « layout-grid » */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Mes apps Dowze
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            {apps.map((a) => (
              <a
                key={a.slug}
                href={a.current ? undefined : a.url}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition',
                  a.current ? 'cursor-default bg-slate-50 font-medium text-slate-800' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[a.color ?? 'blue'] ?? DOT.blue)} />
                <span className="min-w-0 truncate">{a.name}</span>
                {a.current && <span className="ml-auto text-[11px] text-slate-400">ici</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
