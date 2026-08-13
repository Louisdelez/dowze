'use client';

import Link from 'next/link';
import { CompanionRoom } from '@/components/companion/companion-room';
import { useProfile } from '@/lib/use-profile';

export default function CompagnonPage() {
  const { ready, signedIn } = useProfile();

  if (ready && !signedIn) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-semibold">Connecte-toi pour retrouver ton compagnon</p>
          <Link
            href="/connexion"
            className="mt-3 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-foreground"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return <CompanionRoom />;
}
