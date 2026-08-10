'use client';

import { useEffect, useState } from 'react';
import { getHiveAttention, resolveHiveAttention, type HiveAttentionItem } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';

export default function AttentionPage() {
  const { signedIn } = useProfile();
  const [items, setItems] = useState<HiveAttentionItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setItems(await getHiveAttention('open'));
  }
  useEffect(() => {
    if (signedIn) void refresh().catch(() => setError("Le centre d'attention est indisponible."));
  }, [signedIn]);

  async function answer(item: HiveAttentionItem, action: string, dismiss = false) {
    setBusy(true);
    try {
      await resolveHiveAttention(item.id, action, undefined, dismiss);
      await refresh();
    } catch {
      setError("La décision n'a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-3xl font-black tracking-tight">Ton attention</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        La Ruche travaille sans te déranger. Elle place ici uniquement les validations, décisions,
        blocages et avertissements qui nécessitent vraiment ton intervention.
      </p>
      {!signedIn && (
        <p className="mt-8 rounded-2xl border p-5">Connecte-toi pour voir les demandes.</p>
      )}
      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">{error}</p>
      )}
      {signedIn && (
        <div className="mt-8 space-y-3">
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Rien ne réclame ton attention. La Ruche continue.
            </div>
          )}
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">{item.kind}</span>
                <span
                  className={
                    item.priority === 'critical' || item.priority === 'high'
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                  }
                >
                  {item.priority}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString('fr-CH')}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold">{item.title}</h2>
              {item.details && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.details}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.options.map((option) => (
                  <button
                    key={option.id}
                    disabled={busy}
                    onClick={() => void answer(item, option.id)}
                    className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  disabled={busy}
                  onClick={() => void answer(item, 'dismiss', true)}
                  className="rounded-xl border px-3 py-2 text-sm font-bold"
                >
                  Ignorer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
