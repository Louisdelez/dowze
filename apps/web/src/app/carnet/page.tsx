'use client';

import { useEffect, useState } from 'react';
import {
  listCarnet,
  addCarnetEntry,
  getResumePrompt,
  type CarnetEntryRow,
} from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export default function CarnetPage() {
  const sessionProfileId = useSession((s) => s.profileId);
  const [profileId, setProfileId] = useState('');
  const [entries, setEntries] = useState<CarnetEntryRow[]>([]);
  const [note, setNote] = useState('');
  const [prompt, setPrompt] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (sessionProfileId) setProfileId(sessionProfileId);
  }, [sessionProfileId]);

  async function charger() {
    setErreur('');
    try {
      setEntries(await listCarnet(profileId));
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function ajouter() {
    setErreur('');
    try {
      await addCarnetEntry(profileId, note);
      setNote('');
      await charger();
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function obtenirPrompt() {
    setErreur('');
    try {
      setPrompt((await getResumePrompt(profileId)).prompt);
    } catch (e) {
      setErreur(String(e));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Carnet de bord</h1>
        <p className="mt-1 text-muted-foreground">
          L’IA est sans mémoire d’une fois à l’autre. Ton carnet + le prompt de reprise lui rendent le
          contexte à chaque session.
        </p>
      </header>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="ton identifiant de profil (rempli si connecté)"
        />
        <Button variant="ghost" onClick={charger} disabled={!profileId}>
          Charger
        </Button>
        <Button onClick={obtenirPrompt} disabled={!profileId}>
          Prompt de reprise
        </Button>
      </div>

      {prompt && (
        <Card>
          <CardTitle>À coller dans ton IA</CardTitle>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{prompt}</pre>
        </Card>
      )}

      <Card className="space-y-3">
        <CardTitle>Nouvelle note</CardTitle>
        <textarea
          className="h-24 w-full rounded-md border border-border p-3 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="où j’en suis, ce que j’ai compris, ce qui bloque…"
        />
        <Button onClick={ajouter} disabled={!profileId || !note}>
          Ajouter au carnet
        </Button>
      </Card>

      <div className="space-y-2">
        {entries.map((e) => (
          <Card key={e.id} className="p-4">
            <CardDescription>{new Date(e.createdAt).toLocaleString('fr-CH')}</CardDescription>
            <p className="text-sm">{e.note}</p>
          </Card>
        ))}
      </div>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}
    </div>
  );
}
