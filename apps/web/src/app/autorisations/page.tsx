'use client';

import { useEffect, useState } from 'react';
import {
  createHiveVaultItem,
  decideHiveAccess,
  getHiveAccessRequests,
  getHiveVaultItems,
  type HiveAccessRequest,
  type HiveVaultItem,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';

export default function AuthorizationsPage() {
  const { signedIn } = useProfile();
  const [items, setItems] = useState<HiveVaultItem[]>([]);
  const [requests, setRequests] = useState<HiveAccessRequest[]>([]);
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [nextItems, nextRequests] = await Promise.all([
      getHiveVaultItems(),
      getHiveAccessRequests(),
    ]);
    setItems(nextItems);
    setRequests(nextRequests);
  }

  useEffect(() => {
    if (signedIn) void refresh().catch(() => setError("Le coffre n'est pas disponible."));
  }, [signedIn]);

  async function addSecret() {
    if (!label.trim() || !secret) return;
    setBusy(true);
    setError('');
    try {
      await createHiveVaultItem({ label: label.trim(), secret });
      setLabel('');
      setSecret('');
      await refresh();
    } catch {
      setError("Le secret n'a pas pu être chiffré. Vérifie la configuration du coffre.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(request: HiveAccessRequest, decision: 'approve' | 'deny' | 'revoke') {
    setBusy(true);
    setError('');
    try {
      await decideHiveAccess(request.id, decision);
      await refresh();
    } catch {
      setError("La décision n'a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  const labelFor = (id: string) => items.find((item) => item.id === id)?.label ?? 'Secret';

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-3xl font-black tracking-tight">Coffre et autorisations</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Les compagnons demandent un accès précis, pour une raison et une durée définies. Un accès
        approuvé est à usage unique puis automatiquement révoqué.
      </p>
      {!signedIn && (
        <p className="mt-8 rounded-2xl border p-5">Connecte-toi pour ouvrir ton coffre.</p>
      )}
      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">{error}</p>
      )}
      {signedIn && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            <h2 className="text-lg font-bold">Demandes d’accès</h2>
            <div className="mt-3 space-y-3">
              {requests.length === 0 && (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Aucune demande.
                </div>
              )}
              {requests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <strong>{labelFor(request.vaultItemId)}</strong>
                    <span className="ml-auto rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm">{request.purpose}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Durée demandée : {Math.round(request.requestedSeconds / 60)} min
                  </p>
                  {request.status === 'pending' && (
                    <div className="mt-4 flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => void decide(request, 'approve')}
                        className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground"
                      >
                        Autoriser
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void decide(request, 'deny')}
                        className="rounded-xl border px-3 py-2 text-sm font-bold"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                  {request.status === 'approved' && (
                    <button
                      disabled={busy}
                      onClick={() => void decide(request, 'revoke')}
                      className="mt-4 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
                    >
                      Révoquer maintenant
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
          <aside className="h-fit rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-bold">Ajouter un secret</h2>
            <label className="mt-4 block text-sm font-semibold">Nom</label>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"
              placeholder="Serveur de production"
            />
            <label className="mt-4 block text-sm font-semibold">Valeur secrète</label>
            <textarea
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-xl border bg-transparent px-3 py-2"
              placeholder="Clé, jeton ou mot de passe"
            />
            <button
              disabled={busy || !label.trim() || !secret}
              onClick={() => void addSecret()}
              className="mt-4 w-full rounded-xl bg-accent px-3 py-2 font-bold text-accent-foreground disabled:opacity-50"
            >
              Chiffrer dans le coffre
            </button>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Les valeurs ne sont jamais affichées dans cette liste. Elles sont chiffrées avant
              stockage.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
