'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDowzeProfile } from '@dowze/auth';
import {
  activateAlim,
  composeMenu,
  declareMealPrep,
  ingestMeal,
  listEntries,
  myPlugins,
  saveEntry,
  type AlimConfig,
  type AlimEntryRow,
  type CataloguePlugin,
} from '@/lib/core';

const ACADEMIE_URL = 'https://academie.dowze.ch';
const SCOPE_LABELS: Record<string, string> = {
  'profile:read': 'Lire ton profil',
  'calendar:read': 'Voir ton planning',
  'calendar:write': 'Ajouter ton meal-prep au planning',
  'ai:infer': "Te proposer des idées de menus avec l'IA de Dowze",
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</div>
  );
}
function Btn({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-foreground hover:bg-accent-active'
      : 'border border-border text-foreground hover:bg-muted';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

/** Garde-fou produit affiché partout : régularité only, jamais de calories/conseil médical. */
function Guardrail() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Ici, on parle <b>régularité et planification</b> — jamais de comptage de calories ni de
      conseil médical. Manger doit rester simple et sans culpabilité.
    </div>
  );
}

export default function AlimHome() {
  const { profileId, displayName, ready, signedIn } = useDowzeProfile();
  const [plugin, setPlugin] = useState<CataloguePlugin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const list = await myPlugins(profileId);
      setPlugin(list.find((p) => p.slug === 'alimentations') ?? null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (ready && signedIn) void refresh();
    else if (ready) setLoading(false);
  }, [ready, signedIn, refresh]);

  if (!ready || (signedIn && loading))
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!signedIn) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">Connecte-toi sur Dowze</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dowze Alimentation fait partie de ton compte Dowze.
        </p>
        <a
          href={`${ACADEMIE_URL}/connexion`}
          className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-active"
        >
          Aller sur l’académie
        </a>
      </Card>
    );
  }
  if (!plugin) return <Card>Plugin Alimentation introuvable.</Card>;

  return plugin.activation?.enabled ? (
    <Dashboard plugin={plugin} profileId={profileId!} displayName={displayName} />
  ) : (
    <ActivationGate plugin={plugin} profileId={profileId!} onDone={refresh} />
  );
}

function ActivationGate({
  plugin,
  profileId,
  onDone,
}: {
  plugin: CataloguePlugin;
  profileId: string;
  onDone: () => Promise<void>;
}) {
  const [mealsPerDay, setMeals] = useState(3);
  const [prepPerWeek, setPrep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setErr(null);
    try {
      const scopes = [...plugin.scopesRequested, 'ai:infer'];
      const config: AlimConfig = { mealsPerDay, prepPerWeek };
      await activateAlim(plugin.id, profileId, scopes, config);
      await declareMealPrep(profileId, prepPerWeek);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bienvenue sur Dowze Alimentation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Des repas réguliers et un meal-prep planifié, inscrits dans ton planning.
        </p>
      </div>
      <Guardrail />
      <Card>
        <h2 className="text-sm font-semibold">Repas par jour</h2>
        <div className="mt-3 flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setMeals(n)}
              className={`h-11 w-11 rounded-lg border text-sm font-medium transition ${mealsPerDay === n ? 'border-accent bg-accent text-accent-foreground' : 'border-border hover:bg-muted'}`}
            >
              {n}
            </button>
          ))}
        </div>
        <h2 className="mt-4 text-sm font-semibold">Sessions meal-prep par semaine</h2>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setPrep(n)}
              className={`h-11 w-11 rounded-lg border text-sm font-medium transition ${prepPerWeek === n ? 'border-accent bg-accent text-accent-foreground' : 'border-border hover:bg-muted'}`}
            >
              {n}×
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Ce à quoi tu donnes accès</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {[...plugin.scopesRequested, 'ai:infer'].map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {SCOPE_LABELS[s] ?? s}
            </li>
          ))}
        </ul>
      </Card>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Btn onClick={activate} disabled={busy}>
        {busy ? 'Activation…' : 'Activer Dowze Alimentation'}
      </Btn>
    </div>
  );
}

function Dashboard({
  plugin,
  profileId,
  displayName,
}: {
  plugin: CataloguePlugin;
  profileId: string;
  displayName: string | null;
}) {
  const config = (plugin.activation?.config ?? {}) as Partial<AlimConfig>;
  const prep = config.prepPerWeek ?? 1;
  const [entries, setEntries] = useState<AlimEntryRow[]>([]);
  const [panel, setPanel] = useState<'none' | 'menu' | 'log'>('none');

  const load = useCallback(async () => setEntries(await listEntries(profileId)), [profileId]);
  useEffect(() => {
    void load();
  }, [load]);

  const prepThisWeek = useMemo(() => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    return entries.filter((e) => e.kind === 'prep' && new Date(e.done_at).getTime() >= since)
      .length;
  }, [entries]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Salut {displayName ?? 'à toi'} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ta cuisine, régulière et sans prise de tête.
        </p>
      </div>
      <Guardrail />
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Meal-prep cette semaine</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {prepThisWeek}{' '}
              <span className="text-base font-normal text-muted-foreground">/ {prep}</span>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: prep }).map((_, i) => (
              <span
                key={i}
                className={`h-8 w-2.5 rounded-full ${i < prepThisWeek ? 'bg-accent' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
        <a
          href={`${ACADEMIE_URL}/planning`}
          className="mt-3 inline-flex text-sm font-medium text-accent hover:underline"
        >
          Voir mon planning →
        </a>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Btn onClick={() => setPanel(panel === 'menu' ? 'none' : 'menu')}>Idées de menus</Btn>
        <Btn variant="ghost" onClick={() => setPanel(panel === 'log' ? 'none' : 'log')}>
          J’ai cuisiné
        </Btn>
      </div>
      {panel === 'menu' && <MenuPanel profileId={profileId} />}
      {panel === 'log' && (
        <LogPanel
          profileId={profileId}
          onSaved={async () => {
            setPanel('none');
            await load();
          }}
        />
      )}

      {entries.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">Ton historique</h2>
          <ul className="mt-2 divide-y divide-border">
            {entries.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{e.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(e.done_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <a
        href="/reglages"
        className="inline-flex text-sm text-muted-foreground hover:text-foreground"
      >
        Réglages →
      </a>
    </div>
  );
}

function MenuPanel({ profileId }: { profileId: string }) {
  const [result, setResult] = useState<{ prompt: string; closingPrompt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setResult(await composeMenu(profileId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2 className="text-sm font-semibold">Idées de menus</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dowze prépare un prompt (régularité et variété, jamais de calories). Donne-le à <b>ton</b>{' '}
        IA.
      </p>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3">
        <Btn onClick={run} disabled={busy}>
          {busy ? 'Préparation…' : 'Générer'}
        </Btn>
      </div>
      {result && (
        <div className="mt-4 space-y-2">
          <PromptBlock label="Menus de la semaine" text={result.prompt} />
          <PromptBlock label="Pour le bilan de fin" text={result.closingPrompt} />
        </div>
      )}
    </Card>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs font-medium text-accent hover:underline"
        >
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-foreground">{text}</pre>
    </div>
  );
}

function LogPanel({ profileId, onSaved }: { profileId: string; onSaved: () => Promise<void> }) {
  const [summary, setSummary] = useState('');
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const { snapshot: snap } = await ingestMeal(profileId, summary);
      setSnapshot(snap);
      const kind = snap.preparationFaite ? 'prep' : 'meal';
      const title =
        Array.isArray(snap.plats) && snap.plats.length > 0
          ? (snap.plats as string[]).slice(0, 2).join(', ')
          : 'Repas';
      await saveEntry(profileId, { kind, title, summary, snapshot: snap });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2 className="text-sm font-semibold">J’ai cuisiné</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Note librement ce que tu as préparé/mangé. L’IA en tire un résumé — sans jugement, sans
        chiffres.
      </p>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        placeholder="Ex. meal-prep dimanche : curry de pois chiches + riz pour 4 repas, et une salade de lentilles."
        className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3">
        <Btn onClick={run} disabled={busy || summary.trim().length < 3}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Btn>
      </div>
      {snapshot && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <pre className="whitespace-pre-wrap text-foreground">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
