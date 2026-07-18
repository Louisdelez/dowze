'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProgression, getSkills, type MasteryRow, type SkillRow } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { SkeletonCards } from '@/components/ui/skeleton';
import { IconChart } from '@/components/ui/icons';

interface Ligne {
  skillId: string;
  titre: string;
  pct: number;
}

export default function ProgressionPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [rows, setRows] = useState<Ligne[] | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    let annule = false;
    setCharge(true);
    setErreur(false);
    Promise.all([getProgression(profileId), getSkills()])
      .then(([mastery, skills]: [MasteryRow[], SkillRow[]]) => {
        if (annule) return;
        const titre = new Map(skills.map((s) => [s.id, s.title]));
        setRows(
          mastery
            .map((r) => ({
              skillId: r.skillId,
              titre: titre.get(r.skillId) ?? 'Compétence',
              pct: Math.round(r.pMastery * 100),
            }))
            .sort((a, b) => b.pct - a.pct),
        );
      })
      .catch(() => !annule && setErreur(true))
      .finally(() => !annule && setCharge(false));
    return () => {
      annule = true;
    };
  }, [signedIn, profileId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progression"
        subtitle="Ta maîtrise, compétence par compétence — estimée automatiquement à mesure que tu avances."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconChart />}
          title="Connecte-toi pour voir ta progression"
          description="Ta maîtrise se construit au fil de tes séances. Elle apparaîtra ici une fois connecté·e."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {charge && <SkeletonCards count={4} />}

      {erreur && (
        <Note tone="error">Impossible de charger ta progression. Réessaie dans un instant.</Note>
      )}

      {signedIn && !charge && !erreur && rows?.length === 0 && (
        <EmptyState
          icon={<IconChart />}
          title="Rien à afficher pour l’instant"
          description="Fais ton diagnostic pour démarrer ton parcours — ta progression s’affichera ici."
          action={
            <Link href="/demarrer">
              <Button>Faire le diagnostic</Button>
            </Link>
          }
        />
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.skillId} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-sm font-medium">{r.titre}</CardTitle>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {r.pct}%
                </span>
              </div>
              <Progress value={r.pct} className="mt-2" label={r.titre} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
