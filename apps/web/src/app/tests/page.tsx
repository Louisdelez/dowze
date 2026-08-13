'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ExerciseItem, TestView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { generateTest, submitTest } from '@/lib/api';
import { ExerciseCard } from '@/components/exercises/exercise-card';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';

export default function TestsPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [test, setTest] = useState<TestView | null>(null);
  const [results, setResults] = useState<Record<number, { skillId: string; correct: boolean }>>({});
  const [score, setScore] = useState<{ total: number; correct: number } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  async function generer(kind: 'weekly' | 'trimestrial') {
    if (!profileId) return;
    setEnCours(true);
    setErreur('');
    setResults({});
    setScore(null);
    try {
      const t = await generateTest(profileId, kind);
      if (t.items.length === 0) {
        setErreur('Rien à réviser pour l’instant — reviens après quelques séances !');
      }
      setTest(t);
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  function onGraded(index: number, item: ExerciseItem, correct: boolean) {
    setResults((r) => ({ ...r, [index]: { skillId: item.competenceId, correct } }));
  }

  async function terminer() {
    if (!profileId || !test) return;
    setEnCours(true);
    setErreur('');
    try {
      const res = await submitTest(test.id, profileId, Object.values(results));
      setScore({ total: res.total, correct: res.correct });
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Les tests de révision sont personnels."
        action={
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        }
      />
    );
  }

  const answered = Object.keys(results).length;
  const allAnswered = test !== null && test.items.length > 0 && answered === test.items.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tests de révision"
        subtitle="On se teste pour APPRENDRE, pas pour être noté. Aucune note ne compte — c'est pour consolider."
      />

      {!test && (
        <Card className="space-y-4">
          <CardDescription>
            Un test reprend ce que tu as vu et ce qui est dû à réviser, thèmes mélangés. Feedback
            immédiat, sans stress, sans chrono.
          </CardDescription>
          {erreur && <Note tone="error">{erreur}</Note>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => generer('weekly')} disabled={enCours}>
              {enCours ? 'Préparation…' : 'Mon test de la semaine'}
            </Button>
            <Button variant="secondary" onClick={() => generer('trimestrial')} disabled={enCours}>
              Grand test trimestriel
            </Button>
          </div>
        </Card>
      )}

      {test && score && (
        <Card className="space-y-3">
          <CardTitle>C'est fait — bravo d'avoir révisé !</CardTitle>
          <Progress
            value={score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}
            label="Réussite"
          />
          <p className="text-sm text-muted-foreground">
            {score.correct}/{score.total} — l'important n'est pas le score, mais de t'être entraîné.
            Ta mémoire en profite déjà, et Dowze sait mieux quoi te faire réviser.
          </p>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setTest(null);
                setScore(null);
              }}
            >
              Refaire un test
            </Button>
          </div>
        </Card>
      )}

      {test && !score && test.items.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {answered}/{test.items.length} question(s) traitée(s)
          </p>
          {test.items.map((item, i) => (
            <ExerciseCard key={i} item={item} onGraded={(c) => onGraded(i, item, c)} />
          ))}
          {erreur && <Note tone="error">{erreur}</Note>}
          <Button onClick={terminer} disabled={enCours || !allAnswered}>
            {enCours
              ? 'Enregistrement…'
              : allAnswered
                ? 'Terminer le test'
                : 'Réponds à toutes les questions'}
          </Button>
        </div>
      )}

      {test && !score && test.items.length === 0 && erreur && <Note tone="info">{erreur}</Note>}
    </div>
  );
}

function lisible(e: unknown): string {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes('402'))
    return 'Il faut des crédits (ou ta propre clé) pour générer un test. Va dans « Mon Copilote ».';
  if (msg.includes('503'))
    return "Le modèle n'a pas répondu. Réessaie, ou choisis un autre modèle dans « Mon Copilote ».";
  return msg;
}
