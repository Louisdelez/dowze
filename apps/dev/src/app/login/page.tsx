'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Connexion refusée.');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-block-cream/40 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8 shadow-sm"
      >
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">
          Dowze Dev
        </div>
        <h1 className="mb-6 text-2xl font-bold">Connexion</h1>

        <label className="mb-1 block text-sm font-semibold" htmlFor="u">
          Identifiant
        </label>
        <input
          id="u"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mb-4 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="mb-1 block text-sm font-semibold" htmlFor="p">
          Mot de passe
        </label>
        <input
          id="p"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />

        {error && (
          <div className="mb-4 rounded-xl bg-block-pink px-3 py-2 text-sm font-medium text-foreground">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-foreground py-2.5 text-sm font-semibold text-white transition hover:bg-accent disabled:opacity-50"
        >
          {busy ? '…' : 'Se connecter'}
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Comptes gérés par l’administrateur.
        </p>
      </form>
    </main>
  );
}
