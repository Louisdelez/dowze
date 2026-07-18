'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { generatePlanning, getSkills, type PlanningEntryRow, type SkillRow } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { Skeleton } from '@/components/ui/skeleton';
import { Minuteur } from '@/components/minuteur';
import { IconCalendar } from '@/components/ui/icons';

/** Lundi 00:00 UTC de la semaine courante. */
function mondayThisWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

const KIND_LABEL: Record<string, string> = {
  revision: 'Révision',
  apprentissage: 'Apprentissage',
  new: 'Apprentissage',
  pause: 'Pause',
};
const kindLabel = (k: string) => KIND_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1);

export default function PlanningPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [entries, setEntries] = useState<PlanningEntryRow[] | null>(null);
  const [titres, setTitres] = useState<Map<string, string>>(new Map());
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!signedIn || !profileId) return;
    let annule = false;
    setCharge(true);
    setErreur(false);
    Promise.all([generatePlanning(profileId, mondayThisWeekIso()), getSkills()])
      .then(([res, skills]: [{ entries: PlanningEntryRow[] }, SkillRow[]]) => {
        if (annule) return;
        setTitres(new Map(skills.map((s) => [s.id, s.title])));
        setEntries(res.entries);
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
        title="Planning de la semaine"
        subtitle="Généré pour toi : les révisions dues d’abord, puis ta prochaine compétence. Sans pression."
      />

      <Minuteur />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconCalendar />}
          title="Connecte-toi pour voir ton planning"
          description="Ton emploi du temps se construit automatiquement à partir de ta progression."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {charge && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {erreur && (
        <Note tone="error">Impossible de générer ton planning. Réessaie dans un instant.</Note>
      )}

      {signedIn && !charge && !erreur && entries?.length === 0 && (
        <Note>
          Rien à planifier cette semaine — aucune révision due pour le moment. Profite d’une pause.
        </Note>
      )}

      {entries && entries.length > 0 && (
        <Card className="divide-y divide-border p-0">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-6 py-3">
              <span className="w-36 shrink-0 text-sm tabular-nums text-muted-foreground">
                {new Date(e.dateIso).toLocaleString('fr-CH', {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="flex-1 text-sm">
                {e.skillId ? (titres.get(e.skillId) ?? 'Compétence') : 'Séance libre'}
              </span>
              <Badge>
                {kindLabel(e.kind)} · {e.durationMin} min
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
