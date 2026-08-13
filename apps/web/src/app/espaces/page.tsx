'use client';

import { useEffect, useState } from 'react';
import { getHiveSpacePackages, installHiveSpacePackage, type HiveSpacePackage } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';

export default function EspacesPage() {
  const { signedIn } = useProfile();
  const [packages, setPackages] = useState<HiveSpacePackage[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (signedIn) void getHiveSpacePackages().then(setPackages);
  }, [signedIn]);

  async function install(pkg: HiveSpacePackage, mode: 'join' | 'create') {
    setBusy(pkg.id);
    setMessage('');
    try {
      const result = await installHiveSpacePackage(pkg.id, mode);
      setMessage(`${result.space.name} fait maintenant partie de ton monde Dowze.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "L'installation a échoué.");
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-3xl font-black tracking-tight">Espaces du monde Dowze</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Un package contient le bâtiment, ses pièces, ses compagnons, capacités, workflows et
        frontières de permission. Rejoins un service partagé ou crée ta propre organisation depuis
        le même manifeste.
      </p>
      {message && <p className="mt-5 rounded-xl border bg-surface p-3 text-sm">{message}</p>}
      {!signedIn && (
        <p className="mt-8 rounded-2xl border p-5">Connecte-toi pour installer un espace.</p>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => (
          <article key={pkg.id} className="rounded-2xl border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="font-bold">{pkg.name}</h2>
              <span className="ml-auto rounded-full bg-muted px-2 py-1 text-xs">
                v{pkg.version}
              </span>
            </div>
            <p className="mt-2 min-h-10 text-sm text-muted-foreground">{pkg.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(pkg.manifest.roles ?? []).slice(0, 8).map((role) => (
                <span key={role} className="rounded-full bg-muted px-2 py-1 text-xs">
                  {role}
                </span>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                disabled={!!busy}
                onClick={() => void install(pkg, 'create')}
                className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"
              >
                Créer
              </button>
              <button
                disabled={!!busy}
                onClick={() => void install(pkg, 'join')}
                className="flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                Rejoindre
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
