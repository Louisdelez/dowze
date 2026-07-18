'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IconArrowRight } from '@/components/ui/icons';
import { useProfile } from '@/lib/use-profile';

/** CTA d'accueil : mène à l'espace de l'élève si connecté, sinon à l'inscription. */
export function HeroActions() {
  const { ready, signedIn } = useProfile();
  const connecte = ready && signedIn;
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={connecte ? '/dashboard' : '/inscription'}>
        <Button className="gap-2">
          {connecte ? 'Continuer' : 'Commencer'}
          <IconArrowRight />
        </Button>
      </Link>
    </div>
  );
}
