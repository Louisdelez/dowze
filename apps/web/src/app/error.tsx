'use client';

import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="text-muted-foreground">
        Rien de grave. Tu peux réessayer — tes données sont en sécurité.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
