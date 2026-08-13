'use client';

import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';

/**
 * Hydrate la session locale (accountId/profileId/displayName) à partir de la
 * session Supabase — au chargement ET à chaque changement d'auth (connexion,
 * déconnexion, rafraîchissement de jeton). Sans ça, se connecter (au lieu de
 * s'inscrire dans le même onglet) laissait `profileId` vide → le dashboard
 * renvoyait au register. Lecture protégée par la RLS (chacun ne voit que le sien).
 */
export function SessionHydrator() {
  const setSession = useSession((s) => s.setSession);
  const clear = useSession((s) => s.clear);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    async function hydrate(session: Session | null) {
      if (!active) return;
      if (!session?.user) {
        clear();
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, account_id')
        .limit(1)
        .maybeSingle();
      if (!active || !prof) return;
      setSession({
        accountId: prof.account_id,
        profileId: prof.id,
        displayName: prof.display_name,
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => hydrate(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clear();
        return;
      }
      // Différé : ne pas appeler d'autres méthodes Supabase dans le callback (verrou).
      setTimeout(() => hydrate(session), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSession, clear]);

  return null;
}
