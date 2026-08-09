'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { PeerValidationView, ValidationSubject } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  createValidationSubject,
  getFriends,
  getPeerValidation,
  shareSubjectInApp,
  startDirect,
} from '@/lib/api';
import type { Friend } from '@dowze/schemas';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextField, TextAreaField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { IconCheck } from '@/components/ui/icons';
import { ReviewRow } from '@/components/validation/review-row';

export default function ValidationPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [view, setView] = useState<PeerValidationView | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    if (!profileId) return;
    try {
      setView(await getPeerValidation(profileId));
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi pour valider un sujet"
        description="Explique ce que tu as appris à d'autres — ils t'évaluent."
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
        title="Validation"
        subtitle="Explique ce que tu as appris à d'autres. Des pairs t'évaluent — une validation tierce, plus objective, qui travaille aussi ton aisance à l'oral."
      />

      {erreur && <Note tone="error">Une erreur est survenue. Réessaie.</Note>}

      {profileId && <CreateForm profileId={profileId} onCreated={setView} />}

      {view && view.badges.length > 0 && (
        <Card className="space-y-2">
          <CardTitle>Tes sujets validés</CardTitle>
          <div className="flex flex-wrap gap-2">
            {view.badges.map((b) => (
              <span
                key={b.id}
                title={b.criteria}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800"
              >
                <IconCheck width={14} height={14} className="text-amber-600" />
                {b.name}
              </span>
            ))}
          </div>
        </Card>
      )}

      {view && view.mySubjects.length > 0 && (
        <Card className="space-y-3">
          <CardTitle>Mes sujets</CardTitle>
          <CardDescription>
            Fais-les évaluer : partage le lien (à mettre en description d'une vidéo, ou à envoyer à
            quelqu'un), ou laisse la communauté les évaluer.
          </CardDescription>
          {view.mySubjects.map((s) => (
            <MySubjectRow key={s.id} s={s} required={view.requiredReviews} profileId={profileId!} />
          ))}
        </Card>
      )}

      {view && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Sujets à évaluer</CardTitle>
            <Link
              href="/validation/communaute"
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Toute la communauté →
            </Link>
          </div>
          {view.isTeacher && (
            <Note tone="info">
              Tu es prof agréé : ta validation compte pour une validation complète (en une fois).
            </Note>
          )}
          {!view.canReview ? (
            <Note tone="info">{view.reviewGateMessage}</Note>
          ) : view.toReview.length === 0 ? (
            <CardDescription>
              Aucun sujet à évaluer pour l'instant — vois la page communauté.
            </CardDescription>
          ) : (
            view.toReview.map((s) =>
              profileId ? (
                <ReviewRow key={s.id} s={s} profileId={profileId} onReviewed={charger} />
              ) : null,
            )
          )}
        </Card>
      )}
    </div>
  );
}
function CreateForm({
  profileId,
  onCreated,
}: {
  profileId: string;
  onCreated: (v: PeerValidationView) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function creer() {
    if (!title.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const v = await createValidationSubject(profileId, {
        title: title.trim(),
        description: description.trim(),
        evidenceUrl: null,
        format: 'visio',
      });
      onCreated(v);
      setTitle('');
      setDescription('');
    } catch {
      setErr('Impossible de créer le sujet. Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <CardTitle>Créer un sujet à valider</CardTitle>
        <CardDescription>
          Tu vas l'expliquer à d'autres, comme un petit exposé. Si tu sais l'expliquer et qu'on te
          comprend, c'est que tu l'as compris.
        </CardDescription>
      </div>
      <TextField
        label="Titre du sujet"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ex. Les fonctions affines"
      />
      <TextAreaField
        label="Courte description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Ce que tu vas expliquer, en 1-2 phrases."
      />
      {err && <Note tone="error">{err}</Note>}
      <Button onClick={creer} disabled={busy || !title.trim()}>
        {busy ? 'Création…' : 'Créer mon sujet'}
      </Button>
    </Card>
  );
}

function MySubjectRow({
  s,
  required,
  profileId,
}: {
  s: ValidationSubject;
  required: number;
  profileId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function partager() {
    const url = `${window.location.origin}/validation/sujet/${s.id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function ouvrirEnvoi() {
    setPicking((p) => !p);
    if (friends.length === 0) setFriends((await getFriends(profileId)).friends);
  }

  async function envoyerA(f: Friend) {
    const { conversationId } = await startDirect(profileId, f.profileId);
    await shareSubjectInApp(profileId, conversationId, s.id);
    setSentTo(f.name);
    setPicking(false);
  }

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{s.title}</p>
          {s.description ? <p className="text-xs text-muted-foreground">{s.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {s.status === 'validated' ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <IconCheck width={16} height={16} /> Validé · {s.avgStars}/5
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {s.reviewCount}/{required} évaluations{s.reviewCount > 0 ? ` · ${s.avgStars}/5` : ''}
            </span>
          )}
          {s.status !== 'validated' && (
            <>
              <button
                type="button"
                onClick={partager}
                className="text-xs text-accent underline-offset-2 hover:underline"
              >
                {copied ? 'Lien copié !' : 'Partager'}
              </button>
              <button
                type="button"
                onClick={ouvrirEnvoi}
                className="text-xs text-accent underline-offset-2 hover:underline"
              >
                Envoyer à un ami
              </button>
            </>
          )}
        </div>
      </div>
      {sentTo && <p className="mt-2 text-xs text-emerald-700">Envoyé à {sentTo}.</p>}
      {picking && (
        <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
          {friends.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun ami — ajoute-en dans « Mes amis ».
            </p>
          ) : (
            friends.map((f) => (
              <button
                key={f.profileId}
                type="button"
                onClick={() => envoyerA(f)}
                className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              >
                {f.name} <span className="text-xs text-muted-foreground">· niveau {f.level}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
