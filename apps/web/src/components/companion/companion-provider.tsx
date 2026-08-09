'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { subscribeCompanion, type CompanionSnapshot } from '@/lib/companion-bus';
import { useCompanionSync } from '@/lib/companion-sync';
import { Companion } from './companion';

// Pages où le pet flottant est masqué (il est déjà « dans » la page — ex. le jeu Tamagotchi).
const HIDE_ON = new Set(['/', '/compagnon', '/compagnon/', '/store', '/store/']);

/**
 * Monte le Compagnon Dowze au-dessus de TOUTE l'application (rendu client uniquement, après montage,
 * pour éviter les décalages d'hydratation liés à la position sauvegardée / au viewport).
 */
export function CompanionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CompanionSnapshot | null>(null);
  const pathname = usePathname();
  useCompanionSync(); // hydrate/sauvegarde le pet par compte

  useEffect(() => {
    const unsub = subscribeCompanion(setSnapshot);
    return unsub;
  }, []);

  return (
    <>
      {children}
      {snapshot && !HIDE_ON.has(pathname) && <Companion snapshot={snapshot} />}
    </>
  );
}
