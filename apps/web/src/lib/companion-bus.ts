import { pickMessage, type CompanionState } from '@/components/companion/states';

/**
 * Bus du Compagnon Dowze — machine à états en TS pur (hors React), pour que du code non-React
 * (ex. `lib/api.ts`) puisse piloter le compagnon. Piloté par le **cycle de vie réel** des requêtes IA
 * (pas de frise « fake »). Cf. docs/13-COMPAGNON.
 */

export interface CompanionQuestion {
  text: string;
  options: { label: string; value: string }[];
  onAnswer?: (value: string) => void;
}

export interface CompanionSnapshot {
  state: CompanionState;
  message: string | null;
  question?: CompanionQuestion;
  /** Change à chaque émission → permet au front de re-déclencher animations/annonces. */
  seq: number;
}

type Listener = (s: CompanionSnapshot) => void;

const DEBOUNCE_MS = 400; // en-dessous : on saute le « je réfléchis » (évite le clignotement)
const DONE_MS = 6000; // durée d'affichage de « Voilà ! » avant retour au repos
const ERROR_MS = 8000;

let snapshot: CompanionSnapshot = { state: 'idle', message: null, seq: 0 };
const listeners = new Set<Listener>();
let activeCount = 0;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: Omit<CompanionSnapshot, 'seq'>) {
  snapshot = { ...next, seq: snapshot.seq + 1 };
  for (const l of listeners) l(snapshot);
}

function clearSettle() {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

function toIdleIfQuiet() {
  if (activeCount > 0) return; // encore du travail en cours
  emit({ state: 'idle', message: null });
}

export function subscribeCompanion(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot);
  return () => {
    listeners.delete(fn);
  };
}

/** Force un état (usage direct depuis une page). `message` optionnel → variante par défaut. */
export function setCompanion(state: CompanionState, message?: string): void {
  clearSettle();
  emit({ state, message: message ?? pickMessage(state) });
  if (state === 'done' || state === 'error' || state === 'offline' || state === 'retry') {
    settleTimer = setTimeout(toIdleIfQuiet, state === 'done' ? DONE_MS : ERROR_MS);
  }
}

/**
 * Enveloppe une opération IA : `thinking`/`preparing`/… (debounced) → `done`/`error`.
 * Gère la **concurrence** (compteur d'actifs) : plusieurs appels simultanés ne retombent au repos
 * qu'une fois tous terminés. Détecte l'absence de réseau → `offline`.
 */
export async function aiTask<T>(
  opts: { state?: CompanionState; message?: string },
  fn: () => Promise<T>,
): Promise<T> {
  activeCount++;
  clearSettle();
  const state = opts.state ?? 'thinking';
  const timer = setTimeout(() => {
    if (activeCount > 0) emit({ state, message: opts.message ?? pickMessage(state) });
  }, DEBOUNCE_MS);

  try {
    const result = await fn();
    clearTimeout(timer);
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0) {
      emit({ state: 'done', message: pickMessage('done') });
      settleTimer = setTimeout(toIdleIfQuiet, DONE_MS);
    } else {
      emit({ state: 'thinking', message: pickMessage('thinking') });
    }
    return result;
  } catch (err) {
    clearTimeout(timer);
    activeCount = Math.max(0, activeCount - 1);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const s: CompanionState = offline ? 'offline' : 'error';
    emit({ state: s, message: pickMessage(s) });
    settleTimer = setTimeout(toIdleIfQuiet, ERROR_MS);
    throw err;
  }
}

/**
 * Pose UNE question au format socratique (plafonnée côté appelant). Résout avec la valeur choisie,
 * ou `null` si ignorée/rejetée. (Câblage des questions proactives : phase C2.)
 */
export function askCompanion(
  text: string,
  options: { label: string; value: string }[],
): Promise<string | null> {
  clearSettle();
  return new Promise((resolve) => {
    emit({
      state: 'ask',
      message: text,
      question: {
        text,
        options,
        onAnswer: (v) => {
          resolve(v);
          toIdleIfQuiet();
        },
      },
    });
  });
}

/** Le compagnon a-t-il quelque chose « en cours » (utile pour éviter de le masquer). */
export function companionBusy(): boolean {
  return activeCount > 0;
}
