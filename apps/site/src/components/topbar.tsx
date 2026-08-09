'use client';

import { useState } from 'react';
import { useDowzeProfile, globalLogout } from '@dowze/auth';

const APP = 'https://infra.dowze.ch';        // le store / hub (une fois connecté)
const ACADEMIE = 'https://academie.dowze.ch'; // le service Académie (accès direct)

/** Un service de l'écosystème (le compte Dowze est commun à tous). */
const SERVICES: { name: string; desc: string; href?: string; soon?: boolean }[] = [
  { name: 'Académie', desc: 'Apprendre sans plafond, avec un tuteur IA', href: ACADEMIE },
  { name: 'Fitness', desc: 'La forme régulière, orchestrée avec l’étude', soon: true },
  { name: 'Sport', desc: 'Progresser dans ton sport', soon: true },
  { name: 'Alimentation', desc: 'Mieux manger, simplement', soon: true },
];

export function TopBar() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { signedIn, displayName, ready } = useDowzeProfile();
  const label = (displayName || 'Moi').trim();
  const initial = label.charAt(0).toUpperCase();

  async function logout() {
    try { await globalLogout(); } catch { /* */ }
    window.location.href = '/';
  }

  return (
    <header className="relative z-30 flex items-center justify-between px-5 py-4 sm:px-8">
      {/* Logo « box » rouge façon Supreme */}
      <a href="/" className="box-logo text-xl sm:text-2xl">Dowze</a>

      <nav className="flex items-center gap-1 sm:gap-2">
        {/* Services (menu déroulant) */}
        <div className="relative" onMouseLeave={() => setOpen(false)}>
          <button
            onClick={() => setOpen((v) => !v)}
            onMouseEnter={() => setOpen(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm font-bold uppercase italic tracking-tight text-black transition hover:text-dowze-red"
          >
            Services
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {open && (
            <div className="absolute left-1/2 top-full z-40 mt-1 w-72 -translate-x-1/2 overflow-hidden border-2 border-black bg-white p-1.5">
              {SERVICES.map((s) => {
                const inner = (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold italic uppercase">{s.name}</span>
                      {s.soon && <span className="bg-dowze-red px-1.5 py-0.5 text-[10px] font-extrabold uppercase italic tracking-wide text-white">Bientôt</span>}
                    </div>
                    <div className="text-xs text-black/60">{s.desc}</div>
                  </>
                );
                return s.href ? (
                  <a key={s.name} href={s.href} className="block px-3 py-2 transition hover:bg-black hover:text-white">{inner}</a>
                ) : (
                  <div key={s.name} className="block cursor-default px-3 py-2 opacity-55">{inner}</div>
                );
              })}
            </div>
          )}
        </div>

        <a href="/a-propos" className="px-3 py-2 text-sm font-bold uppercase italic tracking-tight text-black transition hover:text-dowze-red">À propos</a>

        <div className="mx-1 hidden h-5 w-px bg-black/15 sm:block" />

        {/* Connecté → profil ; sinon → connexion / inscription. Rien tant que l'état d'auth n'est pas résolu (évite le flash). */}
        {!ready ? (
          <span className="h-9 w-24" />
        ) : signedIn ? (
          <div className="relative" onMouseLeave={() => setProfileOpen(false)}>
            <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 border-2 border-black bg-white py-1 pl-1 pr-3 transition hover:border-dowze-red">
              <span className="box-logo px-2 py-1 text-sm">{initial}</span>
              <span className="max-w-[8rem] truncate text-sm font-extrabold uppercase italic tracking-tight text-black">{label}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-52 border-2 border-black bg-white p-1.5">
                <div className="px-3 py-2 text-xs font-bold uppercase italic tracking-tight text-black/50">Mon compte</div>
                <a href={APP} className="block px-3 py-2 text-sm font-extrabold uppercase italic transition hover:bg-black hover:text-white">Ouvrir Dowze</a>
                <button onClick={logout} className="block w-full px-3 py-2 text-left text-sm font-extrabold uppercase italic text-dowze-red transition hover:bg-dowze-red hover:text-white">Se déconnecter</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <a href="/connexion" className="px-3 py-2 text-sm font-bold uppercase italic tracking-tight text-black transition hover:text-dowze-red">Se connecter</a>
            <a href="/inscription" className="bg-dowze-red px-4 py-2 text-sm font-extrabold uppercase italic tracking-tight text-white transition hover:bg-black">Créer un compte</a>
          </>
        )}
      </nav>
    </header>
  );
}
