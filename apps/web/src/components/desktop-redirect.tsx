'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isDesktop } from '@/lib/desktop';

/**
 * Le HUB Dowze (dowze.ch, ou l'application de bureau) ouvre directement le lanceur (store) à la racine.
 * Sur le service Académie (academie.dowze.ch), « / » reste la page d'accueil d'Académie.
 */
export function DesktopRedirect() {
  const router = useRouter();
  useEffect(() => {
    const host = window.location.host;
    const isHub = isDesktop() || host === 'dowze.ch' || host === 'www.dowze.ch';
    if (isHub) router.replace('/store');
  }, [router]);
  return null;
}
