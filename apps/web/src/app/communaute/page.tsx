'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listClasses, type ClasseRow } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { LiveClasse } from '@/components/live-classe';
import { IconUsers } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export default function CommunautePage() {
  const { profileId, displayName, ready, signedIn } = useProfile();
  const [classes, setClasses] = useState<ClasseRow[]>([]);
  const [active, setActive] = useState<ClasseRow | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    listClasses()
      .then((cs) => {
        setClasses(cs);
        if (cs[0]) setActive(cs[0]);
      })
      .catch(() => setErreur(true));
  }, [signedIn]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma classe"
        subtitle="Une classe d’entraide (~24 élèves, niveaux mêlés). Tout fonctionne aussi seul·e."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconUsers />}
          title="Connecte-toi pour rejoindre ta classe"
          description="Discussions, entraide et présence en direct t’attendent une fois connecté·e."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {signedIn && erreur && (
        <Note tone="error">
          Impossible de charger tes classes pour le moment. Réessaie dans un instant.
        </Note>
      )}

      {signedIn && !erreur && classes.length === 0 && (
        <Note>
          Tu n’es rattaché·e à aucune classe pour l’instant. Elle se formera à mesure que la
          communauté grandit.
        </Note>
      )}

      {signedIn && classes.length > 0 && (
        <>
          {classes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition',
                    active?.id === c.id
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-surface hover:bg-muted',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {active && (
            <LiveClasse
              classeId={active.id}
              profileId={profileId ?? ''}
              authorName={displayName ?? 'Élève'}
            />
          )}
        </>
      )}
    </div>
  );
}
