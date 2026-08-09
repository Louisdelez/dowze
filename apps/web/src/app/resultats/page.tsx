'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ResultsView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { getMyResults, voteRank } from '@/lib/api';
import type { RankChoice } from '@dowze/schemas';
import { IconLock } from '@/components/ui/icons';
import { PageHeader } from '@/components/page-header';
import { ResultsBoard } from '@/components/results/results-board';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { SkeletonCards } from '@/components/ui/skeleton';

export default function ResultatsPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [data, setData] = useState<ResultsView | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    setErreur('');
    try {
      setData(await getMyResults(profileId));
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setCharge(false);
    }
  }, [profileId]);

  const onVote = useCallback(
    async (choice: RankChoice) => {
      if (!profileId) return;
      setData(await voteRank(profileId, choice));
    },
    [profileId],
  );

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi pour voir tes résultats"
        description="Ta maîtrise et ta progression apparaîtront ici."
        action={
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes résultats"
        subtitle={
          data
            ? `Voici où tu en es, ${data.displayName}. Pas de note, pas de classement — ta maîtrise et tes progrès.`
            : 'Ta maîtrise et tes progrès, sans note ni classement.'
        }
      />
      {charge && <SkeletonCards count={4} />}
      {erreur && <Note tone="error">Impossible de charger tes résultats pour l’instant.</Note>}
      {data && !charge && <ResultsBoard data={data} variant="student" onVote={onVote} />}
      {data && !charge && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <IconLock width={14} height={14} className="mt-0.5 shrink-0" />
          <span>
            Ton responsable peut consulter ce suivi de progression (jamais tes échanges privés) avec
            ton
            <strong> code de suivi</strong>, que tu retrouves dans{' '}
            <Link href="/profil" className="text-accent underline-offset-2 hover:underline">
              ton profil
            </Link>
            .
          </span>
        </p>
      )}
    </div>
  );
}
