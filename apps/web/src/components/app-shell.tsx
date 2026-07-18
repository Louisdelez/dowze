'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_PATHS } from '@/lib/nav';
import { SidebarNav } from '@/components/app-sidebar';
import { AuthStatus } from '@/components/auth-status';
import { IconMenu } from '@/components/ui/icons';

/**
 * Coquille de l'application.
 * - Pages publiques (accueil, inscription, connexion) : chrome minimale, contenu centré.
 * - Pages d'app : barre latérale groupée (desktop) + tiroir (mobile).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [open, setOpen] = useState(false);

  if (isPublic) {
    return (
      <div className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Dowze
            </Link>
            <AuthStatus />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      {/* Barre latérale fixe (desktop) */}
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-surface md:block">
        <SidebarNav />
      </aside>

      {/* Tiroir mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[260px] border-r border-border bg-surface">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/* Barre supérieure mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-md p-1.5 hover:bg-muted"
          >
            <IconMenu />
          </button>
          <Link href="/" className="text-base font-bold tracking-tight">
            Dowze
          </Link>
          <AuthStatus />
        </header>

        {/* Barre supérieure desktop (identité à droite) */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-end border-b border-border bg-surface/80 px-8 backdrop-blur md:flex">
          <AuthStatus />
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
