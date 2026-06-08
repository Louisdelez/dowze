import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n’existe pas (ou plus).</p>
      <Link href="/">
        <Button>Retour à l’accueil</Button>
      </Link>
    </div>
  );
}
