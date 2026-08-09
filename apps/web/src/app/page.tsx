'use client';

import { useEffect } from 'react';

/**
 * Racine de l'app. Le contenu dépend du DOMAINE (jamais rendu tel quel) :
 *  - service ACADÉMIE (academie.dowze.ch) → son tableau de bord.
 *  - hub / infra (infra.dowze.ch, app de bureau) → le store.
 * (dowze.ch = le site vitrine, servi par une autre app — n'arrive jamais ici.)
 */
export default function Home() {
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    window.location.replace(host === 'academie.dowze.ch' ? '/dashboard' : '/store');
  }, []);
  return null;
}
