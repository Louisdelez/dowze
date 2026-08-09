import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Minuteur de séance (persisté). Basé sur l'heure de départ pour survivre au
 * changement d'onglet. Non-punitif : c'est un coach de rythme, pas un chrono de
 * pression. (cf. docs/10-APP-WEB/17-seance-et-minuteur.md)
 */
interface SessionTimerState {
  startedAt: number | null; // ms epoch, null = pas de séance en cours
  durationMin: number;
  /** L'alarme a-t-elle déjà sonné pour cette séance (évite les répétitions) ? */
  rang: boolean;
  start: (durationMin: number) => void;
  markRang: () => void;
  stop: () => void;
}

export const useSessionTimer = create<SessionTimerState>()(
  persist(
    (set) => ({
      startedAt: null,
      durationMin: 45,
      rang: false,
      start: (durationMin) => set({ startedAt: Date.now(), durationMin, rang: false }),
      markRang: () => set({ rang: true }),
      stop: () => set({ startedAt: null, rang: false }),
    }),
    { name: 'dowze-session-timer' },
  ),
);
