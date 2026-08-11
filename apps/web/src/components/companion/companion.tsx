'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { STATE_META, type CompanionState } from './states';
import type { CompanionSnapshot } from '@/lib/companion-bus';
import { CodexPet } from './codex-pet';
import { FRAME_H, FRAME_W, STATE_ANIM, useCompanionPet } from '@/lib/companion-pet';
import { useAmbient } from '@/lib/ambient';
import { pickLine, type BrainCtx } from '@/lib/companion-brain';

const POS_KEY = 'dowze-companion-pos';

interface Pos {
  x: number;
  y: number;
}

function clampPos(p: Pos, w: number, h: number): Pos {
  if (typeof window === 'undefined') return p;
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return { x: Math.min(Math.max(8, p.x), maxX), y: Math.min(Math.max(8, p.y), maxY) };
}

function defaultPos(w: number, h: number): Pos {
  return { x: window.innerWidth - w - 20, y: window.innerHeight - h - 24 };
}

/** Classe d'animation du corps selon l'état. */
const ANIM: Record<CompanionState, string> = {
  idle: 'cmp-breathe',
  reading: 'cmp-bob',
  thinking: 'cmp-bob',
  preparing: 'cmp-bob',
  organizing: 'cmp-bob',
  almost: 'cmp-bob-fast',
  done: 'cmp-pop',
  ask: 'cmp-bob',
  retry: 'cmp-bob',
  error: 'cmp-tilt',
  offline: 'cmp-tilt',
};

const THINKING = new Set<CompanionState>([
  'reading',
  'thinking',
  'preparing',
  'organizing',
  'almost',
]);

function mouthPath(state: CompanionState): string {
  if (state === 'error' || state === 'offline') return 'M19 31 H29'; // bouche plate (désolé)
  if (THINKING.has(state)) return 'M21 31 Q24 32.5 27 31'; // petite bouche concentrée
  return 'M18 30 Q24 34 30 30'; // sourire
}

/** Le personnage SVG (décoratif — `aria-hidden`). */
function Face({ state, size }: { state: CompanionState; size: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="cmp-face"
    >
      {/* étincelle Dowze au-dessus de la tête (idle/done) */}
      {(state === 'idle' || state === 'done') && (
        <path
          d="M24 1.5 l1.1 2.6 2.6 1.1 -2.6 1.1 -1.1 2.6 -1.1 -2.6 -2.6 -1.1 2.6 -1.1 z"
          fill="var(--color-accent)"
          className={state === 'done' ? 'cmp-sparkle' : ''}
        />
      )}
      {/* corps */}
      <path
        d="M24 6 C33 6 40 13 40 24 C40 35 33 42 24 42 C15 42 8 35 8 24 C8 13 15 6 24 6 Z"
        fill="var(--color-accent)"
        fillOpacity="0.12"
        stroke="var(--color-accent)"
        strokeWidth="2.2"
      />
      {/* yeux (clignent) */}
      <g className="cmp-eyes" fill="var(--color-foreground)">
        <circle cx="18.5" cy="23" r="2.5" />
        <circle cx="29.5" cy="23" r="2.5" />
      </g>
      {/* bouche */}
      <path
        d={mouthPath(state)}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* petite goutte (souci) */}
      {(state === 'error' || state === 'offline') && (
        <path
          d="M35 14 q2 3 0 4.5 q-2 -1.5 0 -4.5 z"
          fill="var(--color-accent)"
          fillOpacity="0.6"
        />
      )}
      {/* points « je réfléchis » */}
      {THINKING.has(state) && (
        <g fill="var(--color-accent)" className="cmp-dots">
          <circle cx="18" cy="6" r="1.7" style={{ animationDelay: '0ms' }} />
          <circle cx="24" cy="4.5" r="1.7" style={{ animationDelay: '150ms' }} />
          <circle cx="30" cy="6" r="1.7" style={{ animationDelay: '300ms' }} />
        </g>
      )}
    </svg>
  );
}

export function Companion({
  snapshot,
  onOpen,
}: {
  snapshot: CompanionSnapshot;
  onOpen?: () => void;
}) {
  const petUrl = useCompanionPet((s) => s.url);
  const hidden = useCompanionPet((s) => s.hidden);
  const size = useCompanionPet((s) => s.size);
  const companionName = useCompanionPet((s) => s.companionName);
  const [pos, setPos] = useState<Pos | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(
    null,
  );
  const snapStateRef = useRef<CompanionState>(snapshot.state);
  snapStateRef.current = snapshot.state;

  // Autonomie « IA de jeu » (sans LLM) : parole spontanée contextuelle (heure + météo réelles) + petit saut.
  const amb = useAmbient();
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [hop, setHop] = useState(0);
  const ctxRef = useRef<BrainCtx>({
    name: 'Dowze',
    mood: 'ok',
    satiety: 60,
    happiness: 60,
    energy: 60,
    hygiene: 60,
    health: 60,
    hour: 12,
    isDay: true,
    weather: 'clear',
    tempC: null,
    room: '',
  });
  ctxRef.current = {
    name: companionName?.trim() || 'Dowze',
    mood: 'ok',
    satiety: 60,
    happiness: 60,
    energy: 60,
    hygiene: 60,
    health: 60,
    hour: amb.hour,
    isDay: amb.isDay,
    weather: amb.weather,
    tempC: amb.tempC,
    room: '',
  };
  const lastLine = useRef<string[]>([]); // 6 dernières répliques (anti-répétition)
  const say = useCallback((line: string) => {
    lastLine.current = [line, ...lastLine.current].slice(0, 6);
    setAutoMsg(line);
    setDismissed(null);
    setHop((h) => h + 1);
    window.setTimeout(() => setAutoMsg((m) => (m === line ? null : m)), 5000);
  }, []);

  // Parole spontanée quand le compagnon est au repos (jamais pendant une tâche IA). Instantané, 0 réseau.
  useEffect(() => {
    let next = Date.now() + 12_000 + Math.random() * 16_000; // 1re bulle après ~12–28 s
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (hidden || drag.current || snapStateRef.current !== 'idle') return;
      const now = Date.now();
      if (now < next) return;
      next = now + 26_000 + Math.random() * 22_000; // puis toutes les ~26–48 s
      say(pickLine(ctxRef.current, lastLine.current));
    }, 3000);
    return () => window.clearInterval(id);
  }, [say, hidden]);

  // Dimensions rendues du pet flottant. (Le « mode cam » s'activera automatiquement en session de
  // travail — à venir ; pour l'instant le compagnon reste le pet normal sur le site.)
  const dispW = petUrl ? Math.round((FRAME_W / FRAME_H) * size) : size;
  const dispH = size;

  useEffect(() => {
    let initial = defaultPos(dispW, dispH);
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) initial = JSON.parse(raw) as Pos;
    } catch {
      /* ignore */
    }
    setPos(clampPos(initial, dispW, dispH));
  }, []);

  // Re-clampe la position quand la taille (pet ou cam) change ou au redimensionnement de la fenêtre.
  useEffect(() => {
    const reclamp = () => setPos((p) => (p ? clampPos(p, dispW, dispH) : p));
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [dispW, dispH]);

  // Nouveau message → on ré-affiche la bulle (annule un éventuel « fermé »).
  useEffect(() => {
    setDismissed(null);
    setAutoMsg(null); // un message du bus (IA) prend le pas sur la parole spontanée
  }, [snapshot.seq]);

  // Drag via écouteurs `window` (robuste aux mouvements rapides hors du personnage ; souris + tactile).
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      e.preventDefault();
      const state = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
      drag.current = state;

      const move = (ev: PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = ev.clientX - d.sx;
        const dy = ev.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }, dispW, dispH));
      };
      const up = () => {
        const d = drag.current;
        drag.current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!d) return;
        if (!d.moved) {
          // Clic simple : le compagnon est l'entrée centrale vers la conversation et la ruche.
          if (snapshot.state === 'idle' && onOpen) onOpen();
          else if (snapshot.state === 'idle') say(pickLine(ctxRef.current, lastLine.current));
          else setDismissed(snapshot.message);
        } else {
          setPos((p) => {
            if (p) {
              try {
                localStorage.setItem(POS_KEY, JSON.stringify(p));
              } catch {
                /* ignore */
              }
            }
            return p;
          });
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [pos, snapshot.state, snapshot.message, dispW, dispH, say, onOpen],
  );

  if (hidden || !pos) return null;

  const meta = STATE_META[snapshot.state];
  // Au repos, la parole spontanée/au-clic (autoMsg) prime ; sinon le message du bus (IA).
  const spontaneous = snapshot.state === 'idle' ? autoMsg : null;
  const rawMsg = spontaneous ?? snapshot.message;
  const showBubble =
    Boolean(rawMsg) && rawMsg !== dismissed && (meta.talks || Boolean(spontaneous));

  const below = pos.y < 96;
  const nearLeft = pos.x < 140;
  const nearRight = pos.x > window.innerWidth - 140;
  const alignX = nearLeft ? 'left-0' : nearRight ? 'right-0' : 'left-1/2 -translate-x-1/2';

  const politeMsg = meta.politeness === 'status' ? (snapshot.message ?? '') : '';
  const alertMsg = meta.politeness === 'alert' ? (snapshot.message ?? '') : '';

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-live="off">
      {/* Régions live (le sens, pas le dessin) */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {politeMsg}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {alertMsg}
      </div>

      <div
        className="pointer-events-auto absolute"
        style={{ left: pos.x, top: pos.y, width: dispW }}
      >
        {showBubble && (
          <div
            className={`absolute ${alignX} ${below ? 'top-full mt-2' : 'bottom-full mb-2'} w-max max-w-[220px]`}
          >
            <div className="relative rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] leading-snug text-slate-700 shadow-lg">
              <button
                onClick={() => setDismissed(rawMsg)}
                aria-label="Fermer"
                className="pointer-events-auto absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <span>{rawMsg}</span>
              {snapshot.state === 'ask' && snapshot.question && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {snapshot.question.options.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => snapshot.question?.onAnswer?.(o.value)}
                      className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-accent-active"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {/* petite pointe de bulle */}
              <span
                className={`absolute h-2 w-2 rotate-45 border-slate-200 bg-white ${
                  below ? '-top-1 border-l border-t' : '-bottom-1 border-b border-r'
                } ${nearLeft ? 'left-4' : nearRight ? 'right-4' : 'left-1/2 -translate-x-1/2'}`}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onPointerDown={onPointerDown}
          aria-label={`Compagnon Dowze${snapshot.message ? ` — ${snapshot.message}` : ''}`}
          className={`pointer-events-auto block cursor-grab touch-none select-none transition active:cursor-grabbing ${
            petUrl ? '' : `rounded-full ${ANIM[snapshot.state]}`
          }`}
          style={{ width: dispW, height: dispH }}
        >
          {/* key={hop} : relance le petit saut à chaque parole spontanée */}
          <span key={hop} className={hop ? 'block cmp-hop' : 'block'}>
            {petUrl ? (
              <CodexPet url={petUrl} animId={STATE_ANIM[snapshot.state]} size={size} />
            ) : (
              <Face state={snapshot.state} size={size} />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
