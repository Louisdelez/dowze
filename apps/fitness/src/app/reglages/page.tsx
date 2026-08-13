'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFitnessSession } from '@/lib/session';
import {
  activateFitness,
  deactivateFitness,
  declareWorkout,
  myPlugins,
  removeWorkout,
  type CataloguePlugin,
  type FitnessConfig,
} from '@/lib/core';

export default function Reglages() {
  const { profileId, ready, signedIn } = useFitnessSession();
  const [plugin, setPlugin] = useState<CataloguePlugin | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const list = await myPlugins(profileId);
    setPlugin(list.find((p) => p.slug === 'fitness') ?? null);
  }, [profileId]);

  useEffect(() => {
    if (ready && signedIn) void refresh();
  }, [ready, signedIn, refresh]);

  if (!ready) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!signedIn || !plugin?.activation?.enabled) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted-foreground">Active d’abord Dowze Fitness.</p>
        <a href="/" className="mt-2 inline-flex text-sm font-medium text-accent hover:underline">
          ← Retour
        </a>
      </div>
    );
  }

  const config = (plugin.activation.config ?? {}) as Partial<FitnessConfig>;
  const goal = config.frequencyPerWeek ?? 3;
  const healthConsent = config.healthConsent === true;
  const requested = plugin.scopesRequested;

  async function reactivate(next: Partial<FitnessConfig>) {
    if (!profileId || !plugin) return;
    setBusy(true);
    setMsg(null);
    try {
      const merged: FitnessConfig = {
        frequencyPerWeek: next.frequencyPerWeek ?? goal,
        healthConsent: next.healthConsent ?? healthConsent,
      };
      if (merged.healthConsent) {
        merged.healthConsentAt = healthConsent ? config.healthConsentAt : new Date().toISOString();
      }
      const scopes = [...requested, 'ai:infer', ...(merged.healthConsent ? ['health:write'] : [])];
      await activateFitness(plugin.id, profileId, scopes, merged);
      await declareWorkout(profileId, merged.frequencyPerWeek);
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
      await removeWorkout(profileId);
      await deactivateFitness(plugin.id, profileId);
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
          ← Ma forme
        </a>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Séances par semaine</h2>
        <div className="mt-3 flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() => reactivate({ frequencyPerWeek: n })}
              className={`h-11 w-11 rounded-lg border text-sm font-medium transition ${
                goal === n
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Met à jour tes séances dans le planning.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Données de forme (santé)</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={healthConsent}
            disabled={busy}
            onChange={(e) => reactivate({ healthConsent: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span className="text-muted-foreground">
            Autoriser l’enregistrement de mes séances (consentement explicite, révocable). Décocher
            retire le droit correspondant.
          </span>
        </label>
      </div>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Désactiver Dowze Fitness</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Retire tes séances du planning et révoque les accords. Ton compte Dowze reste intact.
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
