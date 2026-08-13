'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ValidationSubject } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { getCommunityValidation, getPeerValidation } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardDescription } from '@/components/ui/card';
import { TextField, SelectField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { ReviewRow } from '@/components/validation/review-row';

export default function CommunauteValidationPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'level'>('recent');
  const [subjects, setSubjects] = useState<ValidationSubject[]>([]);
  const [canReview, setCanReview] = useState(true);
  const [gate, setGate] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!profileId) return;
    const v = await getPeerValidation(profileId);
    setCanReview(v.canReview);
    setGate(v.reviewGateMessage);
    if (v.canReview) setSubjects(await getCommunityValidation(profileId, q, sort));
  }, [profileId, q, sort]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Les évaluations de la communauté sont réservées aux membres."
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
        title="Évaluer la communauté"
        subtitle="Choisis un sujet à évaluer — en écoutant les autres expliquer, tu apprends toi aussi (inspiré de 42/Epitech)."
      />
      <Link href="/validation" className="text-sm text-accent underline-offset-2 hover:underline">
        ← Retour à mes validations
      </Link>

      {!canReview ? (
        <Note tone="info">{gate}</Note>
      ) : (
        <>
          <Card className="space-y-3">
            <TextField
              label="Rechercher un sujet"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Titre, description, auteur…"
            />
            <SelectField
              label="Trier par"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'level')}
            >
              <option value="recent">Plus récents</option>
              <option value="level">Niveau de l'auteur (élevé d'abord)</option>
            </SelectField>
          </Card>

          {subjects.length === 0 ? (
            <CardDescription>Aucun sujet ne correspond pour l'instant.</CardDescription>
          ) : (
            <div className="space-y-3">
              {subjects.map((s) =>
                profileId ? (
                  <ReviewRow
                    key={s.id}
                    s={s}
                    profileId={profileId}
                    onReviewed={charger}
                    showAuthor
                  />
                ) : null,
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
