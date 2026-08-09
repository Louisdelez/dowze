'use client';

import type { ReactNode } from 'react';
import { AppLauncher, type LauncherApp } from '@dowze/ui';
import { ACADEMIE_URL, useFitnessSession } from '@/lib/session';

const APPS: LauncherApp[] = [
  { slug: 'academie', name: 'Académie', url: ACADEMIE_URL, color: 'blue' },
  {
    slug: 'fitness',
    name: 'Fitness',
    url: 'https://fitness.dowze.ch',
    color: 'emerald',
    current: true,
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const { displayName } = useFitnessSession();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <AppLauncher apps={APPS} />
          <a href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              {/* Lucide « dumbbell » */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6.5 6.5 11 11" />
                <path d="m21 21-1-1" />
                <path d="m3 3 1 1" />
                <path d="m18 22 4-4" />
                <path d="m2 6 4-4" />
                <path d="m3 10 7-7" />
                <path d="m14 21 7-7" />
              </svg>
            </span>
            Dowze Fitness
          </a>
          {displayName && (
            <div className="ml-auto text-sm text-muted-foreground">{displayName}</div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
