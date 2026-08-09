'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * L'ancienne page « Progression » (barres de maîtrise) est englobée par « Mes
 * résultats » (/resultats). On redirige pour ne pas casser d'anciens liens.
 */
export default function ProgressionRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/resultats');
  }, [router]);
  return null;
}
