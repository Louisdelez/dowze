'use client';

import { useEffect, useState } from 'react';
import {
  executeHiveRuntime,
  getHiveRuntimes,
  setHiveRuntimeEnabled,
  type HiveRuntimeView,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';

export default function RuntimesPage() {
  const { signedIn } = useProfile();
  const [runtimes, setRuntimes] = useState<HiveRuntimeView[]>([]);
  const [capability, setCapability] = useState('recherche et rédaction');
  const [prompt, setPrompt] = useState('Explique en deux phrases quel moteur tu as utilisé.');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setRuntimes(await getHiveRuntimes());
  }

  useEffect(() => {
    if (signedIn) void refresh().catch(() => setError('Le registre des moteurs est indisponible.'));
  }, [signedIn]);

  async function toggle(runtime: HiveRuntimeView) {
    setBusy(true);
    try {
      await setHiveRuntimeEnabled(runtime.id, !runtime.enabled);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!capability.trim() || !prompt.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await executeHiveRuntime({
        capability: capability.trim(),
        prompt: prompt.trim(),
        channel: 'messages',
      });
      setResult(`${response.runtime.name} · ${response.status}\n\n${response.output}`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Aucun moteur n'a pu exécuter la tâche.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-3xl font-black tracking-tight">Moteurs de la Ruche</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Un moteur est un couple modèle et harness. La Ruche choisit uniquement parmi les adaptateurs
        réellement disponibles, selon la capacité, la modalité, la qualité, le coût, la latence, la
        confidentialité et ton type d’accès.
      </p>
      {!signedIn && (
        <p className="mt-8 rounded-2xl border p-5">Connecte-toi pour voir tes moteurs.</p>
      )}
      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">{error}</p>
      )}
      {signedIn && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-3">
            {runtimes.map((runtime) => (
              <article
                key={runtime.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div>
                    <h2 className="font-bold">{runtime.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {runtime.model} + {runtime.harness}
                    </p>
                  </div>
                  <span
                    className={`ml-auto rounded-full px-2 py-1 text-xs font-semibold ${runtime.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {runtime.available ? 'disponible' : 'non connecté'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {runtime.capabilities.map((item) => (
                    <span key={item} className="rounded-full bg-muted px-2 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>Qualité {Math.round(runtime.quality * 100)}%</span>
                  <span>Coût {Math.round(runtime.cost * 100)}%</span>
                  <span>Latence {Math.round(runtime.latency * 100)}%</span>
                </div>
                <button
                  disabled={busy}
                  onClick={() => void toggle(runtime)}
                  className="mt-4 rounded-xl border px-3 py-1.5 text-xs font-bold"
                >
                  {runtime.enabled ? 'Désactiver' : 'Activer'}
                </button>
              </article>
            ))}
          </section>
          <aside className="h-fit rounded-2xl border border-border bg-surface p-4">
            <h2 className="font-bold">Confier une tâche</h2>
            <label className="mt-4 block text-sm font-semibold">Capacité nécessaire</label>
            <input
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
              className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
            />
            <label className="mt-4 block text-sm font-semibold">Tâche</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              className="mt-1 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm"
            />
            <button
              disabled={busy || !prompt.trim()}
              onClick={() => void execute()}
              className="mt-4 w-full rounded-xl bg-accent px-3 py-2 font-bold text-accent-foreground disabled:opacity-50"
            >
              {busy ? 'La Ruche choisit…' : 'Choisir et exécuter'}
            </button>
            {result && (
              <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-muted p-3 text-xs font-sans leading-5">
                {result}
              </pre>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
