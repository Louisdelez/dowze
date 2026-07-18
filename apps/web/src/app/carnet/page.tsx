'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listCarnet, addCarnetEntry, getResumePrompt, type CarnetEntryRow } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextAreaField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { IconNotebook } from '@/components/ui/icons';

export default function CarnetPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [entries, setEntries] = useState<CarnetEntryRow[]>([]);
  const [note, setNote] = useState('');
  const [prompt, setPrompt] = useState('');
  const [erreur, setErreur] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    if (!profileId) return;
    setErreur(false);
    try {
      setEntries(await listCarnet(profileId));
    } catch {
      setErreur(true);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) charger();
  }, [signedIn, charger]);

  async function ajouter() {
    if (!profileId || !note) return;
    setEnvoi(true);
    setErreur(false);
    try {
      await addCarnetEntry(profileId, note);
      setNote('');
      await charger();
    } catch {
      setErreur(true);
    } finally {
      setEnvoi(false);
    }
  }

  async function obtenirPrompt() {
    if (!profileId) return;
    setErreur(false);
    try {
      setPrompt((await getResumePrompt(profileId)).prompt);
    } catch {
      setErreur(true);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carnet de bord"
        subtitle="Ton IA n’a pas de mémoire d’une fois à l’autre. Ton carnet lui rend le contexte à chaque séance."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconNotebook />}
          title="Connecte-toi pour tenir ton carnet"
          description="Tes notes de bord et le prompt de reprise apparaîtront ici."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {signedIn && (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Prompt de reprise</CardTitle>
              <Button variant="utility" onClick={obtenirPrompt}>
                Générer
              </Button>
            </div>
            <CardDescription>
              À coller dans ton IA en début de séance pour lui rendre le contexte.
            </CardDescription>
            {prompt && (
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                {prompt}
              </pre>
            )}
          </Card>

          <Card className="space-y-3">
            <TextAreaField
              label="Nouvelle note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Où j’en suis, ce que j’ai compris, ce qui bloque…"
            />
            <Button onClick={ajouter} disabled={!note || envoi}>
              {envoi ? 'Ajout…' : 'Ajouter au carnet'}
            </Button>
          </Card>

          {erreur && <Note tone="error">Une action n’a pas abouti. Réessaie dans un instant.</Note>}

          {entries.length === 0 && !erreur ? (
            <Note>
              Ton carnet est vide. Ta première note t’aidera à reprendre plus vite la prochaine
              fois.
            </Note>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <Card key={e.id} className="p-4">
                  <CardDescription>{new Date(e.createdAt).toLocaleString('fr-CH')}</CardDescription>
                  <p className="mt-1 text-sm">{e.note}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
