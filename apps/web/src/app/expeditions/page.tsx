'use client';

import { useState } from 'react';
import {
  listExpeditions,
  createExpedition,
  advanceExpedition,
  type ExpeditionRow,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

const PHASES = ['etincelle', 'question', 'defi', 'acte', 'trace'];

export default function ExpeditionsPage() {
  const [expeditions, setExpeditions] = useState<ExpeditionRow[]>([]);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [erreur, setErreur] = useState('');

  async function charger() {
    setErreur('');
    try {
      setExpeditions(await listExpeditions());
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function creer() {
    setErreur('');
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'expedition';
      await createExpedition({ slug: `${slug}-${Date.now()}`, title, grandeQuestion: question });
      setTitle('');
      setQuestion('');
      await charger();
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function avancer(id: string) {
    setErreur('');
    try {
      await advanceExpedition(id);
      await charger();
    } catch (e) {
      setErreur(String(e));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Expéditions</h1>
        <p className="mt-1 text-muted-foreground">
          L’unité d’apprentissage (2-6 semaines) autour d’une grande question :
          Étincelle → Question → Défi → Acte → Trace.
        </p>
      </header>

      <Card className="space-y-3">
        <CardTitle>Lancer une expédition</CardTitle>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="titre"
        />
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="grande question (ex. « Pourquoi le ciel est-il bleu ? »)"
        />
        <div className="flex gap-2">
          <Button onClick={creer} disabled={!title || !question}>
            Créer
          </Button>
          <Button variant="ghost" onClick={charger}>
            Rafraîchir
          </Button>
        </div>
      </Card>

      <div className="grid gap-3">
        {expeditions.map((x) => (
          <Card key={x.id}>
            <CardTitle>{x.title}</CardTitle>
            <CardDescription>{x.grandeQuestion}</CardDescription>
            <div className="mt-3 flex items-center gap-2">
              {PHASES.map((p) => (
                <span
                  key={p}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    p === x.phase ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <Button onClick={() => avancer(x.id)} disabled={x.phase === 'trace'}>
                {x.phase === 'trace' ? 'Terminée' : 'Avancer'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}
    </div>
  );
}
