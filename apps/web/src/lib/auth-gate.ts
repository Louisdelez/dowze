import { create } from 'zustand';

/**
 * Porte d'authentification du lanceur : n'importe quel composant (jaquette de service, favori du rail)
 * peut demander l'ouverture de la connexion Dowze quand l'utilisateur n'est pas connecté.
 */
interface AuthGate {
  open: boolean;
  /** Service que l'utilisateur voulait ouvrir → on y va après connexion. */
  intended: string | null;
  requestLogin: (intended?: string) => void;
  close: () => void;
}
export const useAuthGate = create<AuthGate>((set) => ({
  open: false,
  intended: null,
  requestLogin: (intended) => set({ open: true, intended: intended ?? null }),
  close: () => set({ open: false, intended: null }),
}));
