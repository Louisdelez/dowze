'use client';

import { useEffect, useState } from 'react';
import {
  listExpeditions,
  createExpedition,
  advanceExpedition,
  type ExpeditionRow,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { Note } from '@/components/ui/note';
import { SkeletonCards } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

const PHASES = [
  { key: 'etincelle', label: 'Étincelle' },
  { key: 'question', label: 'Question' },
  { key: 'defi', label: 'Défi' },
  { key: 'acte', label: 'Acte' },
  { key: 'trace', label: 'Trace' },
];

export default function ExpeditionsPage() {
  const [expeditions, setExpeditions] = useState<ExpeditionRow[] | null>(null);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [erreur, setErreur] = useState(false);

  async function charger() {
    setErreur(false);
    try {
      setExpeditions(await listExpeditions());
    } catch {
      setErreur(true);
      setExpeditions([]);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  async function creer() {
    setErreur(false);
    try {
      const slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'expedition';
      await createExpedition({ slug: `${slug}-${Date.now()}`, title, grandeQuestion: question });
      setTitle('');
      setQuestion('');
      await charger();
    } catch {
      setErreur(true);
    }
  }

  async function avancer(id: string) {
    setErreur(false);
    try {
      await advanceExpedition(id);
      await charger();
    } catch {
      setErreur(true);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expéditions"
        subtitle="L’unité d’apprentissage (2 à 6 semaines) autour d’une grande question : Étincelle → Question → Défi → Acte → Trace."
      />

      <Card className="space-y-3">
        <CardTitle>Lancer une expédition</CardTitle>
        <TextField
          label="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. « Le ciel et la lumière »"
        />
        <TextField
          label="Grande question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex. « Pourquoi le ciel est-il bleu ? »"
        />
        <Button onClick={creer} disabled={!title || !question}>
          Créer
        </Button>
      </Card>

      {erreur && <Note tone="error">Une action n’a pas abouti. Réessaie dans un instant.</Note>}

      {expeditions === null && <SkeletonCards count={2} />}

      {expeditions?.length === 0 && !erreur && (
        <Note>Aucune expédition en cours. Lance-en une avec une question qui t’intrigue.</Note>
      )}

      {expeditions && expeditions.length > 0 && (
        <div className="grid gap-3">
          {expeditions.map((x) => (
            <Card key={x.id} className="space-y-3">
              <div>
                <CardTitle>{x.title}</CardTitle>
                <CardDescription>{x.grandeQuestion}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {PHASES.map((p) => (
                  <span
                    key={p.key}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      p.key === x.phase
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
              <Button
                variant={x.phase === 'trace' ? 'secondary' : 'primary'}
                onClick={() => avancer(x.id)}
                disabled={x.phase === 'trace'}
              >
                {x.phase === 'trace' ? 'Terminée' : 'Avancer'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
