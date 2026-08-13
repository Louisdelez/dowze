'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProgression, getNextSkill, ensureServiceOrg } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Note } from '@/components/ui/note';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyBudgetCard } from '@/components/daily-budget-card';
import { IconArrowRight, IconSparkles } from '@/components/ui/icons';

// Aperçu montré aux visiteurs non connectés (clairement étiqueté « exemple »).
const APERCU = [
  { fil: 'Fondations', pct: 72 },
  { fil: 'Aptitudes durables', pct: 41 },
  { fil: 'Concepts-clés', pct: 28 },
];

interface Vue {
  mastered: number;
  inProgress: number;
  next?: { title: string };
}

export default function DashboardPage() {
  const { displayName, profileId, ready, signedIn } = useProfile();
  const [vue, setVue] = useState<Vue | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Entrer dans l'Académie provisionne (idempotent) l'ÉCOLE de l'élève : open-space de service
  // peuplé d'un directeur + un prof par matière + un évaluateur, calibrés sur son rang.
  useEffect(() => {
    if (!signedIn || !profileId) return;
    ensureServiceOrg('academie').catch(() => {});
  }, [signedIn, profileId]);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    let annule = false;
    setCharge(true);
    setErreur(false);
    Promise.all([getProgression(profileId), getNextSkill(profileId)])
      .then(([rows, next]) => {
        if (annule) return;
        const mastered = rows.filter((r) => r.pMastery >= 0.95).length;
        const enCours = rows.filter((r) => r.pMastery > 0 && r.pMastery < 0.95);
        setVue({
          mastered,
          inProgress: enCours.length,
          next: next ? { title: next.title } : undefined,
        });
      })
      .catch(() => !annule && setErreur(true))
      .finally(() => !annule && setCharge(false));
    return () => {
      annule = true;
    };
  }, [signedIn, profileId]);

  const bonjour = displayName ? `Bonjour ${displayName}` : 'Aujourd’hui';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{bonjour}</h1>
        <p className="mt-1 text-muted-foreground">
          Ta prochaine étape, ta progression. Sans pression.
        </p>
      </header>

      {/* Carte primaire : une seule action évidente. */}
      <ContinuerCard ready={ready} signedIn={signedIn} charge={charge} next={vue?.next} />

      {erreur && (
        <Note tone="error">
          Impossible de récupérer ta progression pour le moment. Réessaie dans un instant.
        </Note>
      )}

      {signedIn ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <StatCard charge={charge} value={vue?.mastered} label="compétences maîtrisées" />
            <StatCard charge={charge} value={vue?.inProgress} label="en cours d’acquisition" />
          </section>
          {profileId && <DailyBudgetCard profileId={profileId} />}
        </>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Ta progression</h2>
            <Badge>aperçu</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {APERCU.map((p) => (
              <Card key={p.fil}>
                <CardTitle>{p.fil}</CardTitle>
                <Progress value={p.pct} className="mt-3" label={p.fil} />
                <CardDescription>{p.pct}% maîtrisé</CardDescription>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContinuerCard({
  ready,
  signedIn,
  charge,
  next,
}: {
  ready: boolean;
  signedIn: boolean;
  charge: boolean;
  next?: { title: string };
}) {
  let titre = 'Crée ton compte pour commencer';
  let desc = 'Un test d’entrée te place au bon niveau, puis l’IA t’accompagne pas à pas.';
  let href = '/inscription';
  let cta = 'Commencer';

  if (ready && signedIn) {
    if (next) {
      titre = `Reprendre : ${next.title}`;
      desc = 'Continue là où tu t’es arrêté·e.';
      href = '/seance';
      cta = 'Continuer';
    } else {
      titre = 'Situe ton niveau';
      desc = 'Passe ton test d’évaluation d’entrée : l’IA te place au bon endroit du parcours.';
      href = '/placement';
      cta = 'Commencer';
    }
  }

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <IconSparkles />
        </div>
        <div>
          <CardTitle>{charge ? 'Chargement…' : titre}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
      </div>
      <Link href={href} className="shrink-0">
        <Button className="gap-2">
          {cta}
          <IconArrowRight />
        </Button>
      </Link>
    </Card>
  );
}

function StatCard({ charge, value, label }: { charge: boolean; value?: number; label: string }) {
  return (
    <Card>
      {charge ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <p className="text-3xl font-bold tracking-tight">{value ?? 0}</p>
      )}
      <CardDescription>{label}</CardDescription>
    </Card>
  );
}
