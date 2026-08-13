'use client';

import { useEffect } from 'react';
import { getMe, updateMyProfile } from '@/lib/api';
import { useCompanionPet } from '@/lib/companion-pet';
import { getSupabase } from '@/lib/supabase';

/**
 * Synchronise le compagnon avec le COMPTE (perso à chacun, comme une photo de profil) :
 * - au montage, hydrate le store depuis le serveur (source de vérité) ;
 * - ensuite, sauvegarde débouncée à chaque changement (choix, taille, masqué).
 * localStorage sert de cache instantané / hors-ligne. Si non connecté, on reste en local.
 * Monté une seule fois (dans le CompanionProvider global).
 */
export function useCompanionSync() {
  useEffect(() => {
    let ready = false; // n'écrit rien tant que l'hydratation initiale n'est pas passée
    let authenticated = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const hydrateFromAccount = () =>
      getMe()
        .then((me) => {
          if (me.profile?.companion) useCompanionPet.getState().hydrate(me.profile.companion);
        })
        .catch(() => {
          /* hors-ligne → on garde le local */
        });

    const supabase = getSupabase();
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        authenticated = !!data.session;
        return authenticated ? hydrateFromAccount() : undefined;
      })
      .finally(() => {
        ready = true;
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      authenticated = !!session;
      if (authenticated && ready) void hydrateFromAccount();
    });

    const unsub = useCompanionPet.subscribe((s) => {
      if (!ready || !authenticated) return;
      if (timer) clearTimeout(timer);
      const { url, size, hidden, camMode, world, camSize, companionName } = s;
      timer = setTimeout(() => {
        updateMyProfile({
          companion: { url, size, hidden, camMode, world, camSize, name: companionName },
        }).catch(() => {
          /* échec réseau → le local reste bon, on retentera au prochain changement */
        });
      }, 600);
    });

    return () => {
      if (timer) clearTimeout(timer);
      authListener.subscription.unsubscribe();
      unsub();
    };
  }, []);
}
