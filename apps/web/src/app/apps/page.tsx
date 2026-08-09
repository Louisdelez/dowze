import type { ComponentType, SVGProps } from 'react';
import Link from 'next/link';
import {
  IconArrowRight,
  IconDumbbell,
  IconGraduation,
  IconTrophy,
  IconUtensils,
} from '@/components/ui/icons';

/**
 * « Mes apps » — l'écosystème Dowze : l'académie + les apps satellites (plugins). Une seule identité
 * (session partagée `.dowze.ch`), un planning commun. Clic → ouvre l'app (sous-domaine).
 */
interface EcosystemApp {
  slug: string;
  name: string;
  description: string;
  url: string;
  external: boolean;
  current?: boolean;
  badge: string; // classes du carré coloré (safelistées)
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const APPS: EcosystemApp[] = [
  {
    slug: 'academie',
    name: 'Académie',
    description: 'Ton parcours d’apprentissage : cours, séances, expéditions, progression.',
    url: '/dashboard',
    external: false,
    current: true,
    badge: 'bg-blue-500/10 text-blue-700',
    Icon: IconGraduation,
  },
  {
    slug: 'fitness',
    name: 'Fitness',
    description: 'La forme physique régulière — des séances inscrites dans ton planning.',
    url: 'https://fitness.dowze.ch',
    external: true,
    badge: 'bg-emerald-500/10 text-emerald-700',
    Icon: IconDumbbell,
  },
  {
    slug: 'sports',
    name: 'Sports',
    description: 'Entraînements et matchs de ta discipline, orchestrés avec l’étude.',
    url: 'https://sports.dowze.ch',
    external: true,
    badge: 'bg-sky-500/10 text-sky-700',
    Icon: IconTrophy,
  },
  {
    slug: 'alimentations',
    name: 'Alimentation',
    description:
      'Repas réguliers et meal-prep planifiés. Jamais de comptage, juste de la régularité.',
    url: 'https://alimentations.dowze.ch',
    external: true,
    badge: 'bg-amber-500/10 text-amber-700',
    Icon: IconUtensils,
  },
];

export default function AppsPage() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Mes apps</h1>
        <p className="mt-1 text-muted-foreground">
          L’écosystème Dowze — une seule identité, un planning commun. Ouvre une app en un clic.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {APPS.map((app) => {
          const inner = (
            <>
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${app.badge}`}
                >
                  <app.Icon width={22} height={22} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{app.name}</span>
                    {app.current && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Tu es ici
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-accent">
                {app.current ? 'Aller au tableau de bord' : `Ouvrir ${app.name}`}
                <IconArrowRight width={16} height={16} />
              </div>
            </>
          );

          const cls =
            'block rounded-2xl border border-border bg-surface p-5 transition hover:border-ink-faint hover:shadow-sm';

          return app.external ? (
            <a key={app.slug} href={app.url} className={cls}>
              {inner}
            </a>
          ) : (
            <Link key={app.slug} href={app.url} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Les apps satellites partagent ton compte Dowze — aucune reconnexion. Leurs séances
        s’inscrivent dans ton planning, orchestrées avec ton étude.
      </p>
    </div>
  );
}
