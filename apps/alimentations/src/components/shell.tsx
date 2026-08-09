'use client';

import type { ReactNode } from 'react';
import { AppLauncher, type LauncherApp } from '@dowze/ui';
import { useDowzeProfile } from '@dowze/auth';

const APPS: LauncherApp[] = [
  { slug: 'academie', name: 'Académie', url: 'https://academie.dowze.ch', color: 'blue' },
  { slug: 'fitness', name: 'Fitness', url: 'https://fitness.dowze.ch', color: 'emerald' },
  { slug: 'sports', name: 'Sports', url: 'https://sports.dowze.ch', color: 'sky' },
  {
    slug: 'alimentations',
    name: 'Alimentation',
    url: 'https://alimentations.dowze.ch',
    color: 'amber',
    current: true,
  },
];

export function Shell({ children }: { children: ReactNode }) {
  const { displayName } = useDowzeProfile();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <AppLauncher apps={APPS} />
          <a href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              {/* Lucide « utensils » */}
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
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
            </span>
            Dowze Alimentation
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
