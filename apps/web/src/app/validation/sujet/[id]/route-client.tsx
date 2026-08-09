'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ValidationSubject } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { getPeerValidation, getValidationSubject } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { ReviewRow } from '@/components/validation/review-row';

export function SujetPartageClient() {
  const params = useParams<{ id: string }>();
  const subjectId = params?.id ?? '';
  const { profileId, ready, signedIn } = useProfile();
  const [subject, setSubject] = useState<ValidationSubject | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [gate, setGate] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const charger = useCallback(async () => {
    if (!profileId) return;
    const [s, v] = await Promise.all([getValidationSubject(profileId, subjectId), getPeerValidation(profileId)]);
    if (!s) setNotFound(true);
    setSubject(s);
    setCanReview(v.canReview);
    setGate(v.reviewGateMessage);
  }, [profileId, subjectId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi pour évaluer ce sujet"
        description="Il faut un compte (et un niveau suffisant) pour évaluer une prestation."
        action={<Link href="/connexion" className="text-accent underline-offset-2 hover:underline">Se connecter</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Évaluer un sujet partagé" subtitle="Quelqu'un t'a partagé ce sujet à évaluer." />
      <Link href="/validation" className="text-sm text-accent underline-offset-2 hover:underline">← Mes validations</Link>

      {notFound && <Note tone="error">Ce sujet n'existe pas (ou plus).</Note>}

      {subject && subject.status === 'validated' && (
        <Card className="space-y-1">
          <CardTitle>{subject.title}</CardTitle>
          <CardDescription>Ce sujet est déjà validé ({subject.avgStars}/5). Merci !</CardDescription>
        </Card>
      )}

      {subject && subject.status === 'open' && subject.mine && (
        <Note tone="info">C'est ton propre sujet — tu ne peux pas l'auto-évaluer. Partage-le à d'autres.</Note>
      )}

      {subject && subject.status === 'open' && !subject.mine && (
        !canReview ? (
          <Note tone="info">{gate}</Note>
        ) : profileId ? (
          <ReviewRow s={subject} profileId={profileId} onReviewed={charger} showAuthor />
        ) : null
      )}
    </div>
  );
}
