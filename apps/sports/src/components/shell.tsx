'use client';

import type { ReactNode } from 'react';
import { AppLauncher, CompanionDock, type LauncherApp } from '@dowze/ui';
import { useDowzeProfile } from '@dowze/auth';
import { core } from '@/lib/core';

const APPS: LauncherApp[] = [
  { slug: 'academie', name: 'Académie', url: 'https://academie.dowze.ch', color: 'blue' },
  { slug: 'fitness', name: 'Fitness', url: 'https://fitness.dowze.ch', color: 'emerald' },
  { slug: 'sports', name: 'Sports', url: 'https://sports.dowze.ch', color: 'sky', current: true },
  {
    slug: 'alimentations',
    name: 'Alimentation',
    url: 'https://alimentations.dowze.ch',
    color: 'amber',
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
              {/* Lucide « trophy » */}
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
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </span>
            Dowze Sports
          </a>
          {displayName && (
            <div className="ml-auto text-sm text-muted-foreground">{displayName}</div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <CompanionDock client={core} service="sports" />
    </div>
  );
}
