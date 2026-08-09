'use client';

// Rendu du COURS NATIF Dowze : une « feuille A4 » = une pile de MODULES pédagogiques générés par l'IA de
// Dowze (fiche, exemple résolu, QCM, exercices…), rendus EN APP. Les modules interactifs se corrigent seuls
// (réutilise ExerciseCard) ; à la clôture, l'app dérive l'outcome des réponses → BKT.
// Cf. docs/10-APP-WEB/30-cours-natif-feuille-modules.md.

import { memo, useCallback, useMemo, useState } from 'react';
import type { CourseSheet, CourseModule, CourseExercise, ExerciseItem } from '@dowze/schemas';
import dynamic from 'next/dynamic';
import { ExerciseCard } from '@/components/exercises/exercise-card';
import { Button } from '@/components/ui/button';

// KaTeX (~100 Ko gzip + fonts) chargé À LA DEMANDE : il ne pèse plus sur /seance et /langues tant
// qu'aucune fiche n'est affichée (audit perf 08-2026).
const Markdown = dynamic(() => import('@/components/ui/markdown').then((m) => m.Markdown), {
  ssr: false,
  loading: () => <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />,
});
import { IconTarget, IconBook, IconSparkles, IconCheck } from '@/components/ui/icons';

type Outcome = 'maitrise' | 'progres' | 'bloque';

/** Un item de cours (schéma « gen », sans méta) → item d'exercice complet attendu par ExerciseCard. */
function toItem(ex: CourseExercise, skillId: string): ExerciseItem {
  return { ...ex, competenceId: skillId, bloomLevel: 'comprendre', sourceRef: '' } as ExerciseItem;
}

/** En-tête de module : petite étiquette bordée (titres courts, icône Lucide, zéro emoji). */
function ModuleLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

export function CourseSheetView({
  sheet,
  onComplete,
  busy,
}: {
  sheet: CourseSheet;
  /** Doit LANCER (throw) en cas d'échec : la feuille ne se verrouille qu'après un enregistrement réussi. */
  onComplete: (outcome: Outcome, note: string) => void | Promise<void>;
  busy?: boolean;
}) {
  // Résultats des modules interactifs (qcm/exercice/rappel/flashcards) → dérivation de l'outcome.
  const [results, setResults] = useState<boolean[]>([]);
  const [closed, setClosed] = useState(false);
  // Stable (`useCallback`) : sinon le `memo` des ModuleView est défait à chaque réponse.
  const record = useCallback((correct: boolean) => setResults((r) => [...r, correct]), []);

  const total = results.length;
  const correct = results.filter(Boolean).length;

  // Nombre d'items interactifs attendus (pour n'autoriser la clôture qu'une fois répondu).
  const expected = useMemo(() => countInteractive(sheet.modules), [sheet.modules]);

  async function terminer() {
    if (closed || busy) return;
    const score = total > 0 ? correct / total : 1;
    const outcome: Outcome = score >= 0.8 ? 'maitrise' : score >= 0.5 ? 'progres' : 'bloque';
    const note =
      total > 0
        ? `Cours natif « ${sheet.title} » : ${correct}/${total} réussis.`
        : `Cours natif « ${sheet.title} » lu.`;
    try {
      await onComplete(outcome, note);
      // Verrouillé UNIQUEMENT après enregistrement réussi (sinon : travail perdu sur échec réseau).
      setClosed(true);
    } catch {
      /* le parent affiche l'erreur ; le bouton reste ré-essayable */
    }
  }

  return (
    <div className="space-y-6">
      {/* La FEUILLE : surface blanche « papier » sur le canvas. */}
      <article className="mx-auto max-w-3xl space-y-8 rounded-xl border border-border bg-surface p-6 shadow-sm md:p-10">
        <header className="border-b border-border pb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
            <IconSparkles className="h-4 w-4" /> Cours Dowze
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{sheet.title}</h2>
        </header>

        {sheet.modules.map((mod, i) => (
          <section key={i} className="space-y-3">
            <ModuleView module={mod} skillId={sheet.skillId} onGraded={record} />
          </section>
        ))}
      </article>

      {/* Barre de clôture : progrès + « Terminer ». */}
      <div className="mx-auto flex max-w-3xl items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {expected > 0
            ? `${total} / ${expected} répondu${total > 1 ? 's' : ''}`
            : 'Lis la feuille'}
          {total > 0 && ` · ${correct} réussi${correct > 1 ? 's' : ''}`}
        </span>
        <Button onClick={terminer} disabled={busy || closed || (expected > 0 && total < expected)}>
          {closed ? 'Séance clôturée' : 'Terminer la séance'}
        </Button>
      </div>
    </div>
  );
}

// `memo` : chaque réponse d'exercice fait un setState dans CourseSheetView → sans memo, TOUTE la feuille
// (Markdown + KaTeX de chaque module) était re-rendue à chaque clic (audit perf 08-2026).
const ModuleView = memo(function ModuleView({
  module: mod,
  skillId,
  onGraded,
}: {
  module: CourseModule;
  skillId: string;
  onGraded: (correct: boolean) => void;
}) {
  switch (mod.kind) {
    case 'objectif':
      return (
        <>
          <ModuleLabel icon={<IconTarget className="h-3.5 w-3.5" />}>Objectifs</ModuleLabel>
          <ul className="list-disc space-y-1 rounded-lg border border-border bg-muted/40 p-4 pl-8 text-sm">
            {mod.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </>
      );

    case 'rappel':
      return (
        <>
          <ModuleLabel icon={<IconCheck className="h-3.5 w-3.5" />}>Rappel</ModuleLabel>
          {mod.intro && <p className="text-sm text-muted-foreground">{mod.intro}</p>}
          <div className="space-y-3">
            {mod.items.map((ex, i) => (
              <ExerciseCard key={i} item={toItem(ex, skillId)} onGraded={onGraded} />
            ))}
          </div>
        </>
      );

    case 'fiche':
      return (
        <>
          <ModuleLabel icon={<IconBook className="h-3.5 w-3.5" />}>Cours</ModuleLabel>
          <div className="space-y-4">
            {mod.sections.map((s, i) => (
              <div key={i} className="space-y-1">
                <h3 className="text-base font-semibold">{s.heading}</h3>
                <Markdown text={s.body} />
              </div>
            ))}
          </div>
        </>
      );

    case 'exemple':
      return <ExempleView title={mod.title} steps={mod.steps} />;

    case 'guide':
      return (
        <GuideView
          prompt={mod.prompt}
          hints={mod.hints}
          answer={mod.answer}
          explanation={mod.explanation}
        />
      );

    case 'qcm':
      return (
        <>
          <ModuleLabel>Vérifie</ModuleLabel>
          <div className="space-y-3">
            {mod.items.map((ex, i) => (
              <ExerciseCard key={i} item={toItem(ex, skillId)} onGraded={onGraded} />
            ))}
          </div>
        </>
      );

    case 'exercice':
      return (
        <>
          <ModuleLabel>À toi</ModuleLabel>
          <div className="space-y-3">
            {mod.items.map((ex, i) => (
              <ExerciseCard key={i} item={toItem(ex, skillId)} onGraded={onGraded} />
            ))}
          </div>
        </>
      );

    case 'elaboration':
      return (
        <>
          <ModuleLabel>Explique</ModuleLabel>
          <ul className="space-y-2 rounded-lg border border-border p-4 text-sm">
            {mod.questions.map((q, i) => (
              <li key={i} className="font-medium">
                {q}
              </li>
            ))}
          </ul>
        </>
      );

    case 'schema':
      return (
        <>
          <ModuleLabel>Schéma</ModuleLabel>
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {mod.mermaid ? (
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {mod.mermaid}
              </pre>
            ) : null}
            <p className="mt-2 text-muted-foreground">{mod.caption}</p>
          </div>
        </>
      );

    case 'synthese':
      return (
        <>
          <ModuleLabel icon={<IconCheck className="h-3.5 w-3.5" />}>Synthèse</ModuleLabel>
          <ul className="list-disc space-y-1 rounded-lg border border-border bg-accent/5 p-4 pl-8 text-sm">
            {mod.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
          {mod.flashcards.length > 0 && (
            <div className="space-y-3">
              {mod.flashcards.map((fc, i) => (
                <ExerciseCard
                  key={i}
                  item={
                    {
                      ...fc,
                      type: 'flashcard',
                      competenceId: skillId,
                      bloomLevel: 'comprendre',
                      sourceRef: '',
                    } as ExerciseItem
                  }
                  onGraded={onGraded}
                />
              ))}
            </div>
          )}
        </>
      );
  }
});

function ExempleView({
  title,
  steps,
}: {
  title: string;
  steps: { text: string; reveal: boolean }[];
}) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <ModuleLabel icon={<IconSparkles className="h-3.5 w-3.5" />}>Exemple</ModuleLabel>
      <div className="rounded-lg border border-border p-4">
        <p className="mb-2 font-semibold">{title}</p>
        <ol className="list-decimal space-y-1 pl-6 text-sm">
          {steps.map((s, i) =>
            // La 1re étape est TOUJOURS visible (le LLM peut marquer toutes les étapes `reveal` → liste vide).
            s.reveal && !shown && i > 0 ? null : <li key={i}>{s.text}</li>,
          )}
        </ol>
        {steps.some((s) => s.reveal) && !shown && (
          <Button variant="secondary" className="mt-3" onClick={() => setShown(true)}>
            Voir la suite
          </Button>
        )}
      </div>
    </>
  );
}

function GuideView({
  prompt,
  hints,
  answer,
  explanation,
}: {
  prompt: string;
  hints: string[];
  answer: string;
  explanation: string;
}) {
  const [revealed, setRevealed] = useState(0); // nb d'indices révélés
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <>
      <ModuleLabel>Ensemble</ModuleLabel>
      <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
        <p className="font-medium">{prompt}</p>
        {hints.slice(0, revealed).map((h, i) => (
          <p key={i} className="text-muted-foreground">
            Indice {i + 1} : {h}
          </p>
        ))}
        <div className="flex flex-wrap gap-2">
          {revealed < hints.length && (
            <Button variant="secondary" onClick={() => setRevealed((r) => r + 1)}>
              Un indice
            </Button>
          )}
          {!showAnswer && (
            <Button variant="secondary" onClick={() => setShowAnswer(true)}>
              Voir la réponse
            </Button>
          )}
        </div>
        {showAnswer && (
          <div className="rounded-md bg-muted p-3">
            <p className="font-medium">{answer}</p>
            {explanation && <p className="mt-1 text-muted-foreground">{explanation}</p>}
          </div>
        )}
      </div>
    </>
  );
}

function countInteractive(modules: CourseModule[]): number {
  let n = 0;
  for (const m of modules) {
    if (m.kind === 'rappel' || m.kind === 'qcm' || m.kind === 'exercice') n += m.items.length;
    if (m.kind === 'synthese') n += m.flashcards.length;
  }
  return n;
}
