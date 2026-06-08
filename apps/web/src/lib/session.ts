import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Session locale de l'élève (persistée). `profileId` sert à pré-remplir les
 * écrans (progression, planning…) sans ressaisir l'UUID à chaque fois.
 */
interface SessionState {
  accountId: string | null;
  profileId: string | null;
  displayName: string | null;
  setSession: (s: { accountId: string; profileId: string; displayName: string }) => void;
  clear: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accountId: null,
      profileId: null,
      displayName: null,
      setSession: (s) => set(s),
      clear: () => set({ accountId: null, profileId: null, displayName: null }),
    }),
    { name: 'dowze-session' },
  ),
);
