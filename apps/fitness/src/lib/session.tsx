'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from '@dowze/auth';

export const ACADEMIE_URL = 'https://academie.dowze.ch';

interface FitnessSession {
  profileId: string | null;
  displayName: string | null;
  ready: boolean;
  signedIn: boolean;
}

const Ctx = createContext<FitnessSession>({
  profileId: null,
  displayName: null,
  ready: false,
  signedIn: false,
});
export const useFitnessSession = (): FitnessSession => useContext(Ctx);

/**
 * Résout l'identité depuis la **session partagée `.dowze.ch`** (cookie posé par l'académie, cf. @dowze/auth).
 * Aucune reconnexion : si l'utilisateur est connecté sur Dowze, il l'est ici. Le `profileId` vient de la
 * table `profiles` (RLS : chacun ne lit que le sien).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FitnessSession>({
    profileId: null,
    displayName: null,
    ready: false,
    signedIn: false,
  });

  const resolve = useCallback(async () => {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setState({ profileId: null, displayName: null, ready: true, signedIn: false });
      return;
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, display_name')
      .limit(1)
      .maybeSingle();
    setState({
      profileId: prof?.id ?? null,
      displayName: prof?.display_name ?? null,
      ready: true,
      signedIn: Boolean(prof?.id),
    });
  }, []);

  useEffect(() => {
    let active = true;
    void resolve();
    const { data: sub } = getSupabase().auth.onAuthStateChange(() => {
      if (active) void resolve();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resolve]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
