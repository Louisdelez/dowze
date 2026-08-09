'use client';

import { useEffect, useState } from 'react';
import { countdownAt } from '@dowze/core';
import { useSessionTimer } from '@/lib/session-timer';
import { IconBell, IconClock } from '@/components/ui/icons';
import { playBell } from '@/lib/bell';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Minuteur de séance dans la barre du haut. Démarre au lancement d'une séance,
 * décompte 45 min (adaptable), sonne une alarme douce à la fin → bilan + pause.
 * Coach de rythme, jamais un chrono de pression.
 */
export function SessionTimer() {
  const { startedAt, durationMin, rang, markRang, stop } = useSessionTimer();
  const [now, setNow] = useState<number>(() => Date.now());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const state = startedAt ? countdownAt(startedAt, durationMin, now) : null;

  // Alarme à 0 (une seule fois).
  useEffect(() => {
    if (state?.done && !rang) {
      playBell();
      markRang();
    }
  }, [state?.done, rang, markRang]);

  if (!mounted || !startedAt || !state) return null;

  if (state.done) {
    return (
      <span className="flex items-center gap-2 text-sm font-medium text-accent">
        <IconBell width={16} height={16} aria-hidden />
        Séance terminée
        <button
          onClick={stop}
          className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          title="Effacer le minuteur"
        >
          Terminer
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <IconClock className="h-4 w-4" aria-hidden />
      <span className="tabular-nums font-medium">{fmt(state.remainingSec)}</span>
      <button
        onClick={stop}
        className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        title="Arrêter la séance"
      >
        Arrêter
      </button>
    </span>
  );
}
