'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlacementStep } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { placementAnswer, placementStart } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { IconRocket, IconStar } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextAreaField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';

export default function PlacementPage() {
  const router = useRouter();
  const { profileId, ready, signedIn } = useProfile();

  const [step, setStep] = useState<PlacementStep | null>(null);
  const [answer, setAnswer] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [remaining, setRemaining] = useState(0);

  const answerRef = useRef('');
  const startMsRef = useRef(0);
  const submittingRef = useRef(false);
  answerRef.current = answer;

  async function commencer() {
    if (!profileId) return;
    setEnCours(true);
    setErreur('');
    try {
      setStep(await placementStart(profileId));
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  const soumettre = useCallback(
    async (timedOut: boolean) => {
      if (submittingRef.current) return;
      const cur = step;
      if (!cur || cur.done) return;
      submittingRef.current = true;
      setEnCours(true);
      setErreur('');
      try {
        const responseTimeMs = Date.now() - startMsRef.current;
        const next = await placementAnswer(cur.sessionId, answerRef.current.trim(), responseTimeMs, timedOut);
        setAnswer('');
        setStep(next);
      } catch (e) {
        setErreur(lisible(e));
      } finally {
        setEnCours(false);
        submittingRef.current = false;
      }
    },
    [step],
  );

  // Minuteur par question : généreux, analogique, NON-PUNITIF. À 0 → on passe en douceur.
  useEffect(() => {
    if (!step || step.done || !step.timeLimitSec) return;
    startMsRef.current = Date.now();
    setRemaining(step.timeLimitSec);
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          void soumettre(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // On redémarre le minuteur à chaque nouvelle question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.sessionId, step?.askedCount, step?.done]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Le test d'évaluation d'entrée fait partie de ton arrivée à Dowze."
        action={<Link href="/connexion" className="text-accent underline-offset-2 hover:underline">Se connecter</Link>}
      />
    );
  }

  // Résultat final.
  if (step?.done) {
    return (
      <div className="space-y-6">
        <PageHeader title="C'est fait !" subtitle="On t'a situé au bon endroit." />
        <Card className="space-y-3">
          <CardTitle>Ton point de départ</CardTitle>
          {step.masteredCount > 0 && (
            <p className="text-sm text-muted-foreground">
              Tu maîtrises déjà <strong>{step.masteredCount}</strong> compétence(s) — pas besoin de les refaire.
            </p>
          )}
          {step.entrySkill ? (
            <p className="text-sm">
              Tu vas commencer par : <strong>{step.entrySkill.title}</strong>.
            </p>
          ) : (
            <p className="text-sm">Tu as tout maîtrisé sur le parcours actuel — impressionnant !</p>
          )}
          {step.potentialNote && (
            <Note tone="info">
              <span className="inline-flex items-start gap-1.5">
                <IconStar width={16} height={16} className="mt-0.5 shrink-0 text-amber-500" />
                <span>{step.potentialNote}</span>
              </span>
            </Note>
          )}
          {step.paceNote && <p className="text-sm text-muted-foreground">{step.paceNote}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => router.push('/seance')}>Commencer ma première séance</Button>
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Voir mon tableau de bord
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Question en cours.
  if (step) {
    const pct = step.timeLimitSec ? Math.max(0, (remaining / step.timeLimitSec) * 100) : 100;
    const low = pct < 25;
    return (
      <div className="space-y-6">
        <PageHeader
          title="Test d'évaluation d'entrée"
          subtitle="Pour te situer, pas pour te juger. Aucune mauvaise réponse ne te pénalise — prends le temps qu'il te faut."
        />

        {/* Progression globale */}
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Question {step.askedCount}</span>
            <span>≈ {step.maxQuestions} max</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min(100, (step.askedCount / step.maxQuestions) * 100)}%` }}
            />
          </div>
        </div>

        {step.feedback && <Note tone="info">{step.feedback}</Note>}

        <Card className="space-y-4">
          {step.aboveLevel && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              <IconRocket width={14} height={14} /> Défi bonus — on monte plus haut !
            </span>
          )}
          <CardTitle>{step.question}</CardTitle>

          {/* Minuteur par question : barre analogique douce, non-punitive (pas de gros compte à rebours) */}
          {step.timeLimitSec && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${low ? 'bg-amber-400' : 'bg-accent/60'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Prends ton temps — quand la barre se vide, on passe simplement à la suite.
              </p>
            </div>
          )}

          <TextAreaField
            label="Ta réponse"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Réponds avec tes mots. Si tu ne sais pas, dis-le simplement."
          />
          {erreur && <Note tone="error">{erreur}</Note>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => soumettre(false)} disabled={enCours || answer.trim().length === 0}>
              {enCours ? 'Dowze réfléchit…' : 'Valider ma réponse'}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/dashboard')} disabled={enCours}>
              Arrêter
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Écran d'accueil.
  return (
    <div className="space-y-6">
      <PageHeader title="Situons ton niveau" subtitle="Entre 15 et 30 questions, sans stress, qui s'adaptent à toi." />
      <Card className="space-y-4">
        <CardDescription>
          On te pose des questions ouvertes qui s'adaptent à tes réponses : si tu réussis, elles montent ;
          si tu bloques, elles redescendent — jusqu'à trouver précisément ton niveau. Un adulte ne recommence
          pas la maternelle, et si tu es très à l'aise, on te proposera même des défis au-dessus de ton âge.
          Chaque question a un temps conseillé, généreux : c'est un repère, jamais un couperet.
        </CardDescription>
        {erreur && <Note tone="error">{erreur}</Note>}
        <div className="flex flex-wrap gap-3">
          <Button onClick={commencer} disabled={enCours}>
            {enCours ? 'Préparation…' : 'Commencer le test'}
          </Button>
          <Button variant="secondary" onClick={() => router.push('/dashboard')} disabled={enCours}>
            Sauter pour l’instant
          </Button>
        </div>
      </Card>
    </div>
  );
}

function lisible(e: unknown): string {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes('402')) return 'Il faut des crédits (ou ta propre clé) pour le placement par l’IA. Va dans « Mon Copilote ».';
  if (msg.includes('503')) return "Le modèle n'a pas répondu. Réessaie, ou choisis un autre modèle dans « Mon Copilote ».";
  return msg;
}
