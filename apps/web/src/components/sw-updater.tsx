'use client';

import { useEffect } from 'react';
import { isDesktop } from '@/lib/desktop';

/**
 * Force la PWA à récupérer les nouvelles versions. Sans ça, le service worker peut servir
 * du code en cache et les correctifs déployés n'arrivent jamais dans l'onglet ouvert.
 * - vérifie une mise à jour du SW au chargement puis périodiquement ;
 * - quand un NOUVEAU service worker prend le contrôle (après un déploiement), recharge la page
 *   une seule fois pour charger le code frais (pas de rechargement à la 1re installation).
 */
export function SwUpdater() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // Application de BUREAU (Tauri) : les assets sont embarqués (tauri://) → un service worker ne sert qu'à
    // servir du code PÉRIMÉ (l'app ne se met alors jamais à jour après un rebuild). On le désactive : on
    // dé-enregistre tout SW et on vide les caches. (Web PWA : comportement inchangé, mise à jour normale.)
    if (isDesktop()) {
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== 'undefined') {
        caches
          .keys()
          .then((ks) => ks.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing || !hadController) return; // 1re installation → pas de reload
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const checkForUpdate = () => {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {
          /* hors-ligne ou pas de SW : rien à faire */
        });
    };
    checkForUpdate();
    const id = window.setInterval(checkForUpdate, 60_000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
