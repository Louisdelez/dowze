'use client';

import { useEffect, useRef, useState } from 'react';
import { segmentAt, isBoundary } from '@dowze/core';
import { Button } from './ui/button';

const CONFIG = { focusMin: 25, breakMin: 5 };

/** Sonnerie douce à résonance décroissante (cloche de pleine conscience). */
function playBell(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
}

export function Minuteur() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const lastBoundary = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || elapsed === 0) return;
    if (isBoundary(CONFIG, elapsed) && elapsed !== lastBoundary.current) {
      lastBoundary.current = elapsed;
      if (!muted && ctxRef.current) playBell(ctxRef.current);
    }
  }, [elapsed, running, muted]);

  const seg = segmentAt(CONFIG, elapsed);
  const total = (seg.mode === 'focus' ? CONFIG.focusMin : CONFIG.breakMin) * 60;
  const frac = total > 0 ? seg.remainingSec / total : 0;
  const mm = String(Math.floor(seg.remainingSec / 60)).padStart(2, '0');
  const ss = String(seg.remainingSec % 60).padStart(2, '0');

  const R = 54;
  const CIRC = 2 * Math.PI * R;

  function start() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    setRunning(true);
  }
  function reset() {
    setRunning(false);
    setElapsed(0);
    lastBoundary.current = 0;
  }

  return (
    <div className="flex items-center gap-6 rounded-xl border border-border bg-white p-6">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-muted)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - frac)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">
            {mm}:{ss}
          </span>
          <span className="text-xs text-muted-foreground">
            {seg.mode === 'focus' ? 'focus' : 'pause'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Minuteur synchronisé (25 min focus · 5 min pause). Rien d’anxiogène : à toi de l’utiliser.
        </p>
        <div className="flex gap-2">
          {!running ? (
            <Button onClick={start}>Démarrer</Button>
          ) : (
            <Button variant="ghost" onClick={() => setRunning(false)}>
              Pause
            </Button>
          )}
          <Button variant="ghost" onClick={reset}>
            Réinitialiser
          </Button>
          <Button variant="ghost" onClick={() => setMuted((m) => !m)}>
            {muted ? 'Activer la sonnerie' : 'Couper la sonnerie'}
          </Button>
        </div>
      </div>
    </div>
  );
}
