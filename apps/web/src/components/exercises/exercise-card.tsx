'use client';

import { useState } from 'react';
import type { ExerciseItem } from '@dowze/schemas';
import { matchesAccepted, gradeCloze } from '@dowze/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

/**
 * Prise d'un item d'exercice (flashcard, QCM, réponse courte, cloze). Formatif :
 * feedback immédiat, jamais une note. `onGraded` remonte la réussite (pour FSRS/mémoire).
 */
export function ExerciseCard({
  item,
  onGraded,
}: {
  item: ExerciseItem;
  onGraded?: (correct: boolean) => void;
}) {
  const [done, setDone] = useState(false);

  function grade(correct: boolean) {
    if (done) return;
    setDone(true);
    onGraded?.(correct);
  }

  return (
    <Card className="space-y-4">
      {item.type === 'flashcard' && <Flashcard item={item} onGraded={grade} done={done} />}
      {item.type === 'qcm' && <Qcm item={item} onGraded={grade} done={done} />}
      {item.type === 'short' && <Short item={item} onGraded={grade} done={done} />}
      {item.type === 'cloze' && <Cloze item={item} onGraded={grade} done={done} />}
    </Card>
  );
}

function Flashcard({
  item,
  onGraded,
  done,
}: {
  item: Extract<ExerciseItem, { type: 'flashcard' }>;
  onGraded: (c: boolean) => void;
  done: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-base font-medium">{item.recto}</p>
      {flipped ? (
        <p className="rounded-md bg-muted p-3 text-sm">{item.verso}</p>
      ) : (
        <Button variant="secondary" onClick={() => setFlipped(true)}>
          Retourner la carte
        </Button>
      )}
      {flipped && !done && (
        <div className="flex gap-3">
          <Button onClick={() => onGraded(true)}>Je savais</Button>
          <Button variant="secondary" onClick={() => onGraded(false)}>
            Je ne savais pas
          </Button>
        </div>
      )}
    </div>
  );
}

function Qcm({
  item,
  onGraded,
  done,
}: {
  item: Extract<ExerciseItem, { type: 'qcm' }>;
  onGraded: (c: boolean) => void;
  done: boolean;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  function pick(i: number) {
    if (done) return;
    setChosen(i);
    onGraded(i === item.correctIndex);
  }
  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{item.stem}</p>
      <div className="space-y-2">
        {item.options.map((opt, i) => {
          const isCorrect = i === item.correctIndex;
          const isChosen = i === chosen;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={done}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-sm transition',
                !done && 'border-border hover:bg-muted',
                done && isCorrect && 'border-green-300 bg-green-50 text-green-800',
                done && isChosen && !isCorrect && 'border-red-300 bg-red-50 text-red-800',
                done && !isChosen && !isCorrect && 'border-border opacity-60',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {done && <Feedback text={item.feedback} correct={chosen === item.correctIndex} />}
    </div>
  );
}

function Short({
  item,
  onGraded,
  done,
}: {
  item: Extract<ExerciseItem, { type: 'short' }>;
  onGraded: (c: boolean) => void;
  done: boolean;
}) {
  const [val, setVal] = useState('');
  const [correct, setCorrect] = useState(false);
  function check() {
    if (done) return;
    const ok = matchesAccepted(val, item.acceptedAnswers);
    setCorrect(ok);
    onGraded(ok);
  }
  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{item.prompt}</p>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={done}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        placeholder="Ta réponse"
      />
      {!done && (
        <Button onClick={check} disabled={val.trim().length === 0}>
          Vérifier
        </Button>
      )}
      {done && (
        <>
          {!correct && (
            <p className="text-sm text-muted-foreground">
              Réponse attendue : <strong>{item.acceptedAnswers[0]}</strong>
            </p>
          )}
          <Feedback text={item.feedback} correct={correct} />
        </>
      )}
    </div>
  );
}

function Cloze({
  item,
  onGraded,
  done,
}: {
  item: Extract<ExerciseItem, { type: 'cloze' }>;
  onGraded: (c: boolean) => void;
  done: boolean;
}) {
  const parts = item.textWithGaps.split('___');
  const [vals, setVals] = useState<string[]>(() => item.gaps.map(() => ''));
  const [result, setResult] = useState<boolean[] | null>(null);
  function check() {
    if (done) return;
    const g = gradeCloze(vals, item.gaps);
    setResult(g.perGap);
    onGraded(g.correct === g.total);
  }
  return (
    <div className="space-y-3">
      <p className="text-base leading-8">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < item.gaps.length && (
              <input
                value={vals[i] ?? ''}
                onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                disabled={done}
                className={cn(
                  'mx-1 inline-block w-28 rounded border px-2 py-0.5 text-sm outline-none',
                  result == null && 'border-border',
                  result?.[i] === true && 'border-green-300 bg-green-50',
                  result?.[i] === false && 'border-red-300 bg-red-50',
                )}
              />
            )}
          </span>
        ))}
      </p>
      {!done && (
        <Button onClick={check} disabled={vals.some((v) => v.trim().length === 0)}>
          Vérifier
        </Button>
      )}
      {done && result && <Feedback text={item.feedback} correct={result.every(Boolean)} />}
    </div>
  );
}

function Feedback({ text, correct }: { text: string; correct: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm',
        correct
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      <p className="mb-1 font-medium">{correct ? 'Bien joué !' : 'Pas tout à fait.'}</p>
      <p>{text}</p>
    </div>
  );
}
