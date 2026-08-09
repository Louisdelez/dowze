'use client';

import Link from 'next/link';
import { useProfile } from '@/lib/use-profile';
import { useAuthGate } from '@/lib/auth-gate';
import {
  IconGraduation,
  IconDumbbell,
  IconTrophy,
  IconUtensils,
  IconLock,
  IconArrowRight,
} from '@/components/ui/icons';

type Status = 'open' | 'soon';
interface Service {
  slug: string;
  name: string;
  tagline: string;
  href?: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  status: Status;
  from: string;
  to: string;
}

// Le compte Dowze est commun à TOUS les services (le compagnon aussi). Académie est prête ; le reste arrive.
const SERVICES: Service[] = [
  {
    slug: 'academie',
    name: 'Académie',
    tagline: 'Apprendre sans plafond, avec un tuteur IA',
    href: 'https://academie.dowze.ch/dashboard',
    Icon: IconGraduation,
    status: 'open',
    from: '#0a84ff',
    to: '#5e5ce6',
  },
  {
    slug: 'fitness',
    name: 'Fitness',
    tagline: 'La forme régulière, orchestrée avec l’étude',
    Icon: IconDumbbell,
    status: 'soon',
    from: '#10b981',
    to: '#059669',
  },
  {
    slug: 'sport',
    name: 'Sport',
    tagline: 'Progresser dans ton sport',
    Icon: IconTrophy,
    status: 'soon',
    from: '#0ea5e9',
    to: '#0284c7',
  },
  {
    slug: 'alimentation',
    name: 'Alimentation',
    tagline: 'Mieux manger, simplement',
    Icon: IconUtensils,
    status: 'soon',
    from: '#f59e0b',
    to: '#d97706',
  },
];

export default function StorePage() {
  const { displayName, signedIn } = useProfile();
  const requestLogin = useAuthGate((s) => s.requestLogin);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <h1 className="text-3xl font-black tracking-tight">Bibliothèque</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Les services Dowze{displayName ? `, ${displayName}` : ''}. Un compte, un compagnon, partout.
      </p>

      {/* Vraies jaquettes de services (miniatures façon store) */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const open = s.status === 'open';
          const Tile = (
            <div
              className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition ${open ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : 'opacity-80'}`}
            >
              {/* Cover / miniature */}
              <div
                className="relative flex h-40 items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
              >
                <s.Icon className="h-16 w-16 text-white/95" />
                {!open && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    <IconLock className="h-3.5 w-3.5" /> Bientôt
                  </span>
                )}
                {open && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 opacity-0 transition group-hover:opacity-100">
                    Ouvrir <IconArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              {/* Infos */}
              <div className="flex flex-1 flex-col p-4">
                <div className="text-lg font-bold">{s.name}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{s.tagline}</div>
                <div className="mt-3">
                  {open ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
                      Ouvrir
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-muted-foreground">
                      Bientôt disponible
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
          // Service ouvert mais NON connecté → clic = demande de connexion (accès verrouillé).
          if (open && !signedIn) {
            return (
              <button key={s.slug} onClick={() => requestLogin(s.href)} className="text-left">
                {Tile}
              </button>
            );
          }
          if (!open) return <div key={s.slug}>{Tile}</div>;
          // Service ouvert : lien vers le service (Académie = son propre domaine, avec sa barre latérale).
          const external = (s.href ?? '').startsWith('http');
          return external ? (
            <a key={s.slug} href={s.href}>
              {Tile}
            </a>
          ) : (
            <Link key={s.slug} href={s.href ?? '#'}>
              {Tile}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
