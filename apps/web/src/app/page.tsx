'use client';

import { useEffect } from 'react';

/**
 * Racine de l'app. Le contenu dépend du DOMAINE (jamais rendu tel quel) :
 * Le compagnon est désormais le bureau principal de Dowze sur tous les domaines applicatifs.
 * Académie et les autres services s'ouvrent ensuite dans ses appareils virtuels.
 * (dowze.ch = le site vitrine, servi par une autre app — n'arrive jamais ici.)
 */
export default function Home() {
  useEffect(() => {
    window.location.replace('/compagnon');
  }, []);
  return null;
}
