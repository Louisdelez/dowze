'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

export function AuthStatus() {
  const { displayName, clear } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Évite tout décalage d'hydratation : rien tant que non monté.
  if (!mounted) return <span className="text-sm text-muted-foreground">…</span>;

  if (!displayName) {
    return (
      <Link
        href="/connexion"
        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        Se connecter
      </Link>
    );
  }

  async function logout() {
    await getSupabase().auth.signOut();
    clear();
  }

  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{displayName}</span>
      <button onClick={logout} className="rounded-md px-2 py-1 text-xs hover:bg-muted">
        Se déconnecter
      </button>
    </span>
  );
}
