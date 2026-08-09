'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDowzeProfile } from '@dowze/auth';
import {
  activateSports,
  deactivateSports,
  declareTraining,
  myPlugins,
  removeTraining,
  type CataloguePlugin,
  type SportsConfig,
} from '@/lib/core';

const DISCIPLINES = ['course', 'football', 'natation', 'basket', 'tennis', 'vélo'];

export default function Reglages() {
  const { profileId, ready, signedIn } = useDowzeProfile();
  const [plugin, setPlugin] = useState<CataloguePlugin | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const list = await myPlugins(profileId);
    setPlugin(list.find((p) => p.slug === 'sports') ?? null);
  }, [profileId]);
  useEffect(() => {
    if (ready && signedIn) void refresh();
  }, [ready, signedIn, refresh]);

  if (!ready) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!signedIn || !plugin?.activation?.enabled) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted-foreground">Active d’abord Dowze Sports.</p>
        <a href="/" className="mt-2 inline-flex text-sm font-medium text-accent hover:underline">
          ← Retour
        </a>
      </div>
    );
  }

  const config = (plugin.activation.config ?? {}) as Partial<SportsConfig>;
  const discipline = config.discipline ?? 'course';
  const goal = config.frequencyPerWeek ?? 3;

  async function save(next: Partial<SportsConfig>) {
    if (!profileId || !plugin) return;
    setBusy(true);
    setMsg(null);
    try {
      const merged: SportsConfig = {
        discipline: next.discipline ?? discipline,
        frequencyPerWeek: next.frequencyPerWeek ?? goal,
      };
      await activateSports(plugin.id, profileId, [...plugin.scopesRequested, 'ai:infer'], merged);
      await declareTraining(profileId, merged.discipline, merged.frequencyPerWeek);
      await refresh();
      setMsg('Enregistré ✓');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!profileId || !plugin) return;
    setBusy(true);
    try {
      await removeTraining(profileId);
      await deactivateSports(plugin.id, profileId);
      window.location.assign('/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Réglages</h1>
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour
        </a>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Discipline</h2>
        <select
          value={discipline}
          disabled={busy}
          onChange={(e) => save({ discipline: e.target.value })}
          className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm capitalize"
        >
          {DISCIPLINES.map((d) => (
            <option key={d} value={d} className="capitalize">
              {d}
            </option>
          ))}
        </select>
        <h2 className="mt-4 text-sm font-semibold">Entraînements par semaine</h2>
        <div className="mt-3 flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() => save({ frequencyPerWeek: n })}
              className={`h-11 w-11 rounded-lg border text-sm font-medium transition ${goal === n ? 'border-accent bg-accent text-accent-foreground' : 'border-border hover:bg-muted'}`}
            >
              {n}×
            </button>
          ))}
        </div>
      </div>
      {msg && <p className="text-sm text-sky-700">{msg}</p>}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Désactiver Dowze Sports</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Retire tes entraînements du planning et révoque les accords.
        </p>
        <button
          onClick={deactivate}
          disabled={busy}
          className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Désactiver
        </button>
      </div>
    </div>
  );
}
