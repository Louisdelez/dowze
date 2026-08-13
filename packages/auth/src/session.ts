import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './client';

export interface DowzeProfile {
  profileId: string | null;
  displayName: string | null;
  ready: boolean;
  signedIn: boolean;
}

/**
 * Résout l'identité de l'élève depuis la **session partagée `.dowze.ch`** : `profileId`/`displayName`
 * lus dans `profiles` (RLS : chacun ne lit que le sien). Commun à toutes les apps satellites (fitness,
 * sports, alimentation) — aucune reconnexion. Se met à jour aux changements d'auth.
 */
export function useDowzeProfile(): DowzeProfile {
  const [state, setState] = useState<DowzeProfile>({
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

  return state;
}

/**
 * Suit la session Supabase courante (partagée `.dowze.ch`). Se met à jour à la
 * connexion, à la déconnexion et au rafraîchissement de jeton. À utiliser dans
 * n'importe quelle app du compte (academie, plugins) pour un état d'auth commun.
 */
export function useSupabaseSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
