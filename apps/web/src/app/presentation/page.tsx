'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Dossier } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { generateDossier, getDossier, getMe, updateDossier } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField, TextAreaField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function PresentationPage() {
  const router = useRouter();
  const { profileId, ready, signedIn } = useProfile();

  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [languages, setLanguages] = useState('');
  const [location, setLocation] = useState('');
  const [objectif, setObjectif] = useState('');
  const [presentation, setPresentation] = useState('');

  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [prefilling, setPrefilling] = useState(true);

  const prefill = useCallback(async () => {
    setPrefilling(true);
    try {
      const [me, existing] = await Promise.all([
        getMe().catch(() => null),
        profileId ? getDossier(profileId).catch(() => null) : Promise.resolve(null),
      ]);
      if (me?.profile) {
        setPrenom(me.profile.displayName ?? '');
        setBirthDate(me.profile.birthDate ?? '');
      }
      if (existing?.structured) setDossier(existing.structured);
    } finally {
      setPrefilling(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void prefill();
  }, [signedIn, prefill]);

  async function generer() {
    if (!profileId) return;
    setEnCours(true);
    setErreur('');
    try {
      const res = await generateDossier({
        profileId,
        prenom,
        nom,
        birthDate: birthDate || null,
        languages: languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        location,
        objectif,
        presentation: presentation.trim(),
      });
      setDossier(res.structured);
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  async function valider() {
    if (!profileId || !dossier) return;
    setEnCours(true);
    setErreur('');
    try {
      await updateDossier(profileId, dossier, true);
      router.push('/placement');
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  if (!ready || prefilling) return <Skeleton className="h-48" />;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Cette étape fait partie de ton inscription."
        action={
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        }
      />
    );
  }

  // Étape 2 : le dossier généré, à valider/corriger.
  if (dossier) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Ton dossier"
          subtitle="Voici comment Dowze t'a compris. Corrige ce qui ne va pas, puis valide."
        />
        <Card className="space-y-4">
          <TextField
            label="Prénom"
            value={dossier.prenom}
            onChange={(e) => setDossier({ ...dossier, prenom: e.target.value })}
          />
          <TextField
            label="Ton objectif principal"
            value={dossier.objectifPrincipal.valeur}
            onChange={(e) =>
              setDossier({
                ...dossier,
                objectifPrincipal: {
                  ...dossier.objectifPrincipal,
                  valeur: e.target.value,
                  statut: 'declare',
                },
              })
            }
          />
          <TextAreaField
            label="Comment Dowze te présente"
            value={dossier.resumePedagogique}
            onChange={(e) => setDossier({ ...dossier, resumePedagogique: e.target.value })}
            className="min-h-32"
          />
          {dossier.interets.length > 0 && (
            <Puces titre="Tes intérêts" items={dossier.interets.map((i) => i.theme)} />
          )}
          {dossier.objectifs.length > 0 && (
            <Puces titre="Tes objectifs / rêves" items={dossier.objectifs.map((o) => o.theme)} />
          )}
          {dossier.langues.length > 0 && <Puces titre="Tes langues" items={dossier.langues} />}
          {dossier.aPreciser.length > 0 && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm">
              <p className="mb-1 font-medium">À préciser plus tard</p>
              <ul className="list-inside list-disc text-muted-foreground">
                {dossier.aPreciser.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        {erreur && <Note tone="error">{erreur}</Note>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={valider} disabled={enCours}>
            {enCours ? 'Validation…' : 'Valider mon dossier'}
          </Button>
          <Button variant="secondary" onClick={() => setDossier(null)} disabled={enCours}>
            Modifier ma présentation
          </Button>
        </div>
      </div>
    );
  }

  // Étape 1 : le formulaire de présentation.
  return (
    <div className="space-y-6">
      <PageHeader
        title="Présente-toi"
        subtitle="Dis-nous qui tu es : plus on te connaît, plus on t'accompagne bien. Rien n'est obligatoire à part le dernier champ."
      />
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          <TextField label="Nom (optionnel)" value={nom} onChange={(e) => setNom(e.target.value)} />
          <TextField
            label="Date de naissance"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <TextField
            label="Langues (séparées par des virgules)"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="français, anglais…"
          />
          <TextField
            label="Où tu vis (optionnel)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ville / pays"
          />
          <TextField
            label="Ton objectif en une phrase"
            value={objectif}
            onChange={(e) => setObjectif(e.target.value)}
            placeholder="Pourquoi tu es là ?"
          />
        </div>
        <TextAreaField
          label="Parle-nous de toi"
          value={presentation}
          onChange={(e) => setPresentation(e.target.value)}
          hint="Ce que tu aimes, tes passions, tes hobbies, ce que tu fais de tes journées, tes rêves, ce que tu veux apprendre et devenir."
          className="min-h-40"
        />
      </Card>
      {erreur && <Note tone="error">{erreur}</Note>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={generer} disabled={enCours || presentation.trim().length < 10}>
          {enCours ? 'Dowze te lit…' : 'Créer mon dossier'}
        </Button>
        <Button variant="secondary" onClick={() => router.push('/placement')} disabled={enCours}>
          Passer pour l’instant
        </Button>
      </div>
    </div>
  );
}

function Puces({ titre, items }: { titre: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{titre}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className="rounded-full border border-border bg-muted px-3 py-1 text-sm">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Message d'erreur lisible (masque le 402 crédits / 503 modèle en langage simple). */
function lisible(e: unknown): string {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes('402'))
    return 'Il faut des crédits (ou ta propre clé) pour que Dowze lise ta présentation. Va dans « Mon Copilote ».';
  if (msg.includes('503'))
    return "Le modèle n'a pas répondu. Réessaie, ou choisis un autre modèle dans « Mon Copilote ».";
  return msg;
}
