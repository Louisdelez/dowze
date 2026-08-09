'use client';

import { useEffect } from 'react';
import { getMe, updateMyProfile } from '@/lib/api';
import { useCompanionPet } from '@/lib/companion-pet';

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
    let timer: ReturnType<typeof setTimeout> | undefined;

    getMe()
      .then((me) => {
        if (me.profile?.companion) useCompanionPet.getState().hydrate(me.profile.companion);
      })
      .catch(() => {
        /* non connecté ou hors-ligne → on garde le local */
      })
      .finally(() => {
        ready = true;
      });

    const unsub = useCompanionPet.subscribe((s) => {
      if (!ready) return;
      if (timer) clearTimeout(timer);
      const { url, size, hidden, camMode, world, camSize, companionName } = s;
      timer = setTimeout(() => {
        updateMyProfile({ companion: { url, size, hidden, camMode, world, camSize, name: companionName } }).catch(() => {
          /* échec réseau → le local reste bon, on retentera au prochain changement */
        });
      }, 600);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
