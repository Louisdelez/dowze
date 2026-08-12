'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PUBLIC_PATHS } from '@/lib/nav';
import { SidebarNav } from '@/components/app-sidebar';
import { StoreRail } from '@/components/store-rail';
import { AuthStatus } from '@/components/auth-status';
import { SessionTimer } from '@/components/session-timer';
import { XpBar } from '@/components/xp-bar';
import { IconMenu } from '@/components/ui/icons';
import { AiBridge } from '@/components/desktop/ai-dock';
import { isDesktop } from '@/lib/desktop';

const DEVICE_ONLY_APPS: Record<string, string> = {
  '/dashboard': 'academie',
  '/seance': 'seance',
  '/langues': 'langues',
  '/expeditions': 'expeditions',
  '/tests': 'tests',
  '/resultats': 'resultats',
  '/planning': 'planning',
  '/communaute': 'classe',
  '/carnet': 'carnet',
  '/validation': 'validation',
};

/**
 * Coquille de l'application.
 * - Application de BUREAU : le lanceur Dowze (rail store/favoris/compagnon) entoure TOUT, en permanence ;
 *   chaque service (Académie…) s'ouvre à l'intérieur.
 * - Web : inchangé (pages publiques centrées, pages d'app avec barre latérale).
 */
export function AppShell({
  children,
  initialHost = '',
  forceHub = false,
}: {
  children: ReactNode;
  initialHost?: string;
  forceHub?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [desktop, setDesktop] = useState(false);
  const [host, setHost] = useState(initialHost);
  useEffect(() => {
    setDesktop(isDesktop());
    if (!host) setHost(window.location.host);
  }, [host]);

  const p = pathname.replace(/\/+$/, '') || '/';
  useEffect(() => {
    const app = DEVICE_ONLY_APPS[p];
    if (app && window.self === window.top) router.replace(`/compagnon?app=${app}`);
  }, [p, router]);
  // CHROME PAR DOMAINE = quel service t'affiche la page. Le compagnon est le MÊME partout mais s'intègre
  // dans le chrome du contexte où tu es :
  //  - hub DOWZE / infra (infra.dowze.ch, ou l'app de bureau) → rail Dowze. La racine = le STORE.
  //  - service ACADÉMIE (academie.dowze.ch)                   → barre latérale d'Académie. Compagnon « dans Académie ».
  //  (dowze.ch = le SITE VITRINE, servi par une autre app — n'atteint jamais cette coquille.)
  const hubContext = forceHub || desktop || host === 'infra.dowze.ch';
  const isStore = hubContext && (p === '/store' || p === '/'); // le store n'existe QUE dans le hub Dowze
  const isPublic = !isStore && PUBLIC_PATHS.includes(pathname);
  const isFull =
    pathname.startsWith('/messages') ||
    pathname === '/communaute' ||
    pathname === '/planning' ||
    pathname === '/compagnon';
  const [open, setOpen] = useState(false);

  const withRail = hubContext && !isPublic && p !== '/compagnon'; // la Maison est le bureau racine, sans chrome concurrent

  // Contenu « intérieur » (sans le rail du lanceur).
  let inner: ReactNode;

  if (p === '/compagnon') {
    // Le compagnon est le système principal, plein écran, quel que soit le domaine d'entrée.
    inner = <div className="min-w-0 flex-1 overflow-hidden bg-surface">{children}</div>;
  } else if (isStore) {
    inner = <div className="min-w-0 flex-1 overflow-y-auto bg-surface">{children}</div>; // store = lanceur, rail Dowze
  } else if (hubContext && !isPublic) {
    // HUB DOWZE (compagnon, profil, …) : rail Dowze + contenu, JAMAIS la barre d'Académie.
    inner = (
      <div className="min-w-0 flex-1 overflow-y-auto bg-surface">
        <main className="mx-auto w-full max-w-3xl px-6 py-10">{children}</main>
      </div>
    );
  } else if (isPublic) {
    inner = (
      <div className="min-h-dvh w-full">
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
  } else {
    // SERVICE ACADÉMIE (/dashboard, /langues, /tests…) : sa propre barre latérale.
    // En desktop, le service scrolle À L'INTÉRIEUR (la fenêtre a déjà la barre de titre) ; sur web, scroll de la fenêtre.
    const svcHeight = isFull
      ? `${desktop ? 'h-full' : 'h-dvh'} overflow-hidden`
      : desktop
        ? 'h-full min-h-0'
        : 'min-h-dvh';
    inner = (
      <div className={`w-full md:grid md:grid-cols-[260px_1fr] ${svcHeight}`}>
        {/* Barre latérale du SERVICE (Académie) */}
        <aside
          className={`sticky top-0 hidden ${desktop ? 'h-full' : 'h-dvh'} border-r border-border bg-surface md:block`}
        >
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

        <div
          className={`flex min-w-0 flex-col ${isFull ? `${desktop ? 'h-full' : 'h-dvh'} overflow-hidden` : desktop ? 'h-full min-h-0 overflow-y-auto' : ''}`}
        >
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
            <button
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
              className="rounded-md p-1.5 hover:bg-muted"
            >
              <IconMenu />
            </button>
            <SessionTimer />
            <div className="flex items-center gap-3">
              <XpBar />
              <AuthStatus />
            </div>
          </header>
          <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-border bg-surface/80 px-8 backdrop-blur md:flex">
            <SessionTimer />
            <div className="flex items-center gap-4">
              <XpBar />
              <AuthStatus />
            </div>
          </header>
          {isFull ? (
            <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          ) : (
            <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8 md:py-10">
              {children}
            </main>
          )}
        </div>
      </div>
    );
  }

  if (withRail) {
    return (
      <div className={`flex ${desktop ? 'h-full' : 'h-dvh'} overflow-hidden bg-surface`}>
        <StoreRail />
        <div className="flex min-w-0 flex-1 overflow-hidden">{inner}</div>
        {/* Pont IA (desktop) : lanceur + panneau navigateur ChatGPT/Claude docké à droite (self-guard desktop). */}
        <AiBridge />
      </div>
    );
  }
  return inner;
}
