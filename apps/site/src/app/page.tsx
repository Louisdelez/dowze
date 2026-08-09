'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/topbar';

type OS = 'mac' | 'windows' | 'linux' | 'other';

// Téléchargements disponibles (Linux réel ; macOS/Windows à venir).
const DOWNLOADS: Record<OS, { label: string; href: string | null }> = {
  linux: { label: 'Télécharger pour Linux', href: '/download/Dowze-Academie.AppImage' },
  mac: { label: 'Bientôt sur macOS', href: null },
  windows: { label: 'Bientôt sur Windows', href: null },
  other: { label: 'Télécharger pour Linux', href: '/download/Dowze-Academie.AppImage' },
};

const OS_LIST: { id: OS; label: string }[] = [
  { id: 'mac', label: 'macOS' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
];

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other';
  const s = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (/mac|iphone|ipad|ipod/.test(s)) return 'mac';
  if (/win/.test(s)) return 'windows';
  if (/linux|x11|android/.test(s)) return 'linux';
  return 'other';
}

export default function Home() {
  const [os, setOs] = useState<OS>('other');
  useEffect(() => {
    setOs(detectOS());
  }, []);

  const dl = DOWNLOADS[os];
  const available = (id: OS) => DOWNLOADS[id].href != null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      <TopBar />

      {/* Héros — centré, sans scroll */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 bg-black px-3 py-1.5 text-xs font-extrabold uppercase italic tracking-wide text-white">
          L’écosystème d’une vie
        </span>

        {/* Phrase d'accroche — la philosophie de Dowze */}
        <h1 className="max-w-4xl text-5xl font-black italic uppercase leading-[0.95] tracking-tight sm:text-7xl">
          Une vie, un compagnon,
          <br />
          <span className="text-dowze-red">aucun plafond.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base font-medium text-black/70 sm:text-lg">
          Apprendre, bouger, se nourrir, progresser. Dowze réunit tes services de vie autour d’un
          seul compagnon qui grandit avec toi.
        </p>

        {/* Bouton télécharger (OS auto-détecté) */}
        <div className="mt-9 flex flex-col items-center gap-4">
          {dl.href ? (
            <a
              href={dl.href}
              className="inline-flex items-center gap-2.5 bg-dowze-red px-8 py-4 text-base font-extrabold uppercase italic tracking-tight text-white transition hover:bg-black"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              {dl.label}
            </a>
          ) : (
            <span className="inline-flex items-center gap-2.5 border-2 border-black/20 px-8 py-4 text-base font-extrabold uppercase italic tracking-tight text-black/50">
              {dl.label}
            </span>
          )}

          {/* OS supportés — juste sous le bouton */}
          <div className="flex items-center gap-2 text-xs font-bold uppercase italic">
            {OS_LIST.map((o) => {
              const ok = available(o.id);
              return (
                <span
                  key={o.id}
                  className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 tracking-tight ${os === o.id ? 'border-dowze-red bg-dowze-red text-white' : 'border-black/15 bg-white text-black/55'}`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? (os === o.id ? 'bg-white' : 'bg-dowze-red') : 'bg-black/25'}`}
                  />
                  {o.label}
                  {!ok && ' · bientôt'}
                </span>
              );
            })}
          </div>
        </div>
      </main>

      {/* Pied de page */}
      <footer className="flex items-center justify-between border-t-2 border-black px-6 py-4 text-xs font-bold uppercase italic tracking-tight text-black/60 sm:px-8">
        <span>© {2026} Dowze</span>
        <div className="flex items-center gap-4">
          <a href="/a-propos" className="transition hover:text-dowze-red">
            À propos
          </a>
          <a href="https://academie.dowze.ch" className="transition hover:text-dowze-red">
            Académie
          </a>
        </div>
      </footer>
    </div>
  );
}
