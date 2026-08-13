'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * L'ancien diagnostic statique (cases à cocher) est remplacé par le TEST D'ENTRÉE
 * ADAPTATIF (/placement). On redirige pour ne pas casser d'anciens liens/marque-pages.
 */
export default function DemarrerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/placement');
  }, [router]);
  return null;
}
