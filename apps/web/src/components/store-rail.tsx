'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile } from '@/lib/use-profile';
import { getMe } from '@/lib/api';
import { globalLogout } from '@dowze/auth';
import { DowzeAuthModal } from '@/components/dowze-auth-modal';
import { useAuthGate } from '@/lib/auth-gate';
import { CodexPet } from '@/components/companion/codex-pet';
import { useCompanionPet, curatedSheetUrl } from '@/lib/companion-pet';
import { IconGrid, IconGraduation } from '@/components/ui/icons';

const ROBOT = curatedSheetUrl('super-nono-v2');

/** Un service épinglé (favori) dans le rail. */
const FAVORITES = [
  {
    slug: 'academie',
    name: 'Académie',
    href: 'https://academie.dowze.ch/dashboard',
    Icon: IconGraduation,
    accent: '#0a84ff',
  },
];

/**
 * Rail permanent du lanceur Dowze (façon Steam) : bibliothèque (haut), services favoris,
 * PHOTO DE PROFIL (bas). L'avatar sert de connexion (si déconnecté) et d'accès aux réglages.
 */
export function StoreRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { signedIn, displayName } = useProfile();
  const petUrl = useCompanionPet((s) => s.url);
  const [photo, setPhoto] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const gateOpen = useAuthGate((s) => s.open);
  const gateIntended = useAuthGate((s) => s.intended);
  const gateClose = useAuthGate((s) => s.close);
  const requestLogin = useAuthGate((s) => s.requestLogin);
  const showAuth = authOpen || gateOpen;

  // Photo de profil (choisie dans les réglages) — chargée quand connecté.
  useEffect(() => {
    if (!signedIn) {
      setPhoto(null);
      return;
    }
    let active = true;
    getMe()
      .then((me) => {
        if (active) setPhoto(me.profile?.photoUrl ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [signedIn]);

  const onStore = pathname === '/store' || pathname === '/store/';
  const initial = (displayName || '?').trim().charAt(0).toUpperCase();

  async function logout() {
    setMenu(false);
    try {
      await globalLogout();
    } catch {
      /* */
    }
    router.replace('/store');
  }

  return (
    <aside className="relative flex h-full w-[68px] shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-3">
      {/* Haut : la bibliothèque / store */}
      <Link
        href="/store"
        title="Bibliothèque"
        className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${onStore ? 'bg-accent text-accent-foreground shadow-sm' : 'border border-border text-foreground hover:border-accent'}`}
      >
        <IconGrid className="h-5 w-5" />
      </Link>
      <div className="my-1 h-px w-8 bg-border" />

      {/* Favoris : les services épinglés */}
      <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {FAVORITES.map((s) => {
          const cls = `group flex h-11 w-11 items-center justify-center rounded-2xl border border-border transition hover:border-transparent`;
          const icon = (
            <span className="transition group-hover:text-[var(--a)]">
              <s.Icon className="h-5 w-5" />
            </span>
          );
          // Déconnecté → clic = demande de connexion ; sinon → ouvre le SERVICE (Académie sur son propre domaine).
          if (!signedIn)
            return (
              <button
                key={s.slug}
                onClick={() => requestLogin(s.href)}
                title={`${s.name} — connexion requise`}
                className={cls}
                style={{ ['--a' as string]: s.accent }}
              >
                {icon}
              </button>
            );
          return (
            <a
              key={s.slug}
              href={s.href}
              title={s.name}
              className={cls}
              style={{ ['--a' as string]: s.accent }}
            >
              {icon}
            </a>
          );
        })}
      </div>

      {/* Compagnon (commun à TOUS les services) — juste au-dessus du profil. */}
      {signedIn ? (
        <Link
          href="/compagnon"
          title="Mon compagnon"
          className={`mt-auto grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border transition ${pathname.startsWith('/compagnon') ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'}`}
        >
          <span className="translate-y-1 scale-[0.62]">
            <CodexPet url={petUrl || ROBOT} animId="idle" size={64} />
          </span>
        </Link>
      ) : (
        <button
          onClick={() => requestLogin('/compagnon')}
          title="Mon compagnon — connexion requise"
          className="mt-auto grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-border opacity-60 transition hover:border-accent hover:opacity-100"
        >
          <span className="translate-y-1 scale-[0.62]">
            <CodexPet url={ROBOT} animId="idle" size={64} />
          </span>
        </button>
      )}

      {/* Bas : PHOTO DE PROFIL (= connexion + réglages) */}
      <div className="relative mt-2">
        <button
          onClick={() => (signedIn ? setMenu((v) => !v) : setAuthOpen(true))}
          title={signedIn ? displayName || 'Mon profil' : 'Se connecter'}
          className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border-2 border-border bg-muted transition hover:border-accent"
        >
          {photo ? (
            <img src={photo} alt="Profil" className="h-full w-full object-cover" />
          ) : signedIn ? (
            <span className="text-sm font-bold text-foreground">{initial}</span>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
            </svg>
          )}
        </button>

        {/* Menu profil (connecté) */}
        {signedIn && menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="absolute bottom-0 left-full z-50 ml-2 w-52 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
              <div className="px-3 py-2 text-xs font-bold text-muted-foreground">
                {displayName || 'Mon compte'}
              </div>
              <Link
                href="/profil"
                onClick={() => setMenu(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Mon profil
              </Link>
              <button
                onClick={logout}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#ef4444] transition hover:bg-rose-50"
              >
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>

      {/* Connexion / inscription GLOBALE Dowze (reste dans le lanceur). Ouverte par l'avatar OU une demande d'accès service. */}
      {showAuth && (
        <DowzeAuthModal
          onClose={() => {
            setAuthOpen(false);
            gateClose();
          }}
          onDone={() => {
            setAuthOpen(false);
            const dest = gateIntended;
            gateClose();
            if (dest) {
              if (/^https?:\/\//.test(dest)) window.location.assign(dest);
              else router.push(dest);
            }
          }}
        />
      )}
    </aside>
  );
}
