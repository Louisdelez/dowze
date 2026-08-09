'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACADEMIE_URL, useFitnessSession } from '@/lib/session';
import {
  activateFitness,
  composeSession,
  declareWorkout,
  ingestSession,
  listSessions,
  myPlugins,
  saveSession,
  type CataloguePlugin,
  type FitnessConfig,
  type FitnessSessionRow,
} from '@/lib/core';

const SCOPE_LABELS: Record<string, string> = {
  'profile:read': 'Lire ton profil (prénom, âge)',
  'calendar:read': 'Voir ton planning',
  'calendar:write': 'Ajouter tes séances au planning',
  'ai:infer': "Préparer tes séances avec l'IA de Dowze",
  'health:write': 'Enregistrer des données de forme',
  'xp:write': 'Te récompenser en XP',
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
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-foreground hover:bg-accent-active'
      : 'border border-border text-foreground hover:bg-muted';
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export default function FitnessHome() {
  const { profileId, displayName, ready, signedIn } = useFitnessSession();
  const [plugin, setPlugin] = useState<CataloguePlugin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const list = await myPlugins(profileId);
      setPlugin(list.find((p) => p.slug === 'fitness') ?? null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (ready && signedIn) void refresh();
    else if (ready) setLoading(false);
  }, [ready, signedIn, refresh]);

  if (!ready || (signedIn && loading)) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (!signedIn) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">Connecte-toi sur Dowze</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dowze Fitness fait partie de ton compte Dowze. Connecte-toi une fois sur l’académie — tu
          seras connecté ici automatiquement.
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

  if (!plugin) return <Card>Plugin Fitness introuvable.</Card>;

  const enabled = plugin.activation?.enabled === true;
  return enabled ? (
    <Dashboard plugin={plugin} profileId={profileId!} displayName={displayName} />
  ) : (
    <ActivationGate plugin={plugin} profileId={profileId!} onDone={refresh} />
  );
}

// ─── Activation + consentement (RGPD Art. 9 : consentement santé SÉPARÉ) ───

function ActivationGate({
  plugin,
  profileId,
  onDone,
}: {
  plugin: CataloguePlugin;
  profileId: string;
  onDone: () => Promise<void>;
}) {
  const [goal, setGoal] = useState(3);
  const [healthConsent, setHealthConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const requested = plugin.scopesRequested;

  async function activate() {
    setBusy(true);
    setErr(null);
    try {
      const scopes = [...requested, 'ai:infer', ...(healthConsent ? ['health:write'] : [])];
      const config: FitnessConfig = {
        frequencyPerWeek: goal,
        healthConsent,
        ...(healthConsent ? { healthConsentAt: new Date().toISOString() } : {}),
      };
      await activateFitness(plugin.id, profileId, scopes, config);
      await declareWorkout(profileId, goal);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec de l’activation.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bienvenue sur Dowze Fitness</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Des séances régulières, inscrites dans ton planning et orchestrées avec ton étude. La
          régularité d’abord — jamais la performance à tout prix.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold">Combien de séances par semaine ?</h2>
        <div className="mt-3 flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setGoal(n)}
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
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Ce à quoi tu donnes accès</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {requested.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {SCOPE_LABELS[s] ?? s}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {SCOPE_LABELS['ai:infer']}
          </li>
        </ul>

        {/* Consentement santé SÉPARÉ (Art. 9) — jamais coché par défaut, facultatif. */}
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={healthConsent}
            onChange={(e) => setHealthConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-600"
          />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Données de forme (facultatif).</span>{' '}
            J’autorise Dowze Fitness à enregistrer mes séances (exercices, ressenti). Consentement
            explicite, révocable à tout moment dans les réglages. Sans ça, Fitness fonctionne quand
            même.
          </span>
        </label>
      </Card>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <Btn onClick={activate} disabled={busy}>
        {busy ? 'Activation…' : 'Activer Dowze Fitness'}
      </Btn>
    </div>
  );
}

// ─── Tableau de bord « Ma forme » ───

function Dashboard({
  plugin,
  profileId,
  displayName,
}: {
  plugin: CataloguePlugin;
  profileId: string;
  displayName: string | null;
}) {
  const config = (plugin.activation?.config ?? {}) as Partial<FitnessConfig>;
  const goal = config.frequencyPerWeek ?? 3;
  const [sessions, setSessions] = useState<FitnessSessionRow[]>([]);
  const [panel, setPanel] = useState<'none' | 'compose' | 'ingest'>('none');

  const loadSessions = useCallback(async () => {
    setSessions(await listSessions(profileId));
  }, [profileId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const thisWeek = useMemo(() => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    return sessions.filter((s) => new Date(s.done_at).getTime() >= since).length;
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Salut {displayName ?? 'à toi'} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ta forme, à ton rythme.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Cette semaine</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {thisWeek}{' '}
              <span className="text-base font-normal text-muted-foreground">/ {goal} séances</span>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: goal }).map((_, i) => (
              <span
                key={i}
                className={`h-8 w-2.5 rounded-full ${i < thisWeek ? 'bg-accent' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {thisWeek >= goal
            ? 'Objectif atteint, beau travail 💪 Chaque séance de plus est un bonus.'
            : "Pas de pression : la régularité compte plus que l'intensité. Une séance manquée ne casse rien."}
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Tes séances dans le planning</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {goal}×/semaine, placées par l’IA de Dowze autour de ton étude (avant un bloc d’étude
          quand c’est un bon réveil pour le cerveau).
        </p>
        <a
          href={`${ACADEMIE_URL}/planning`}
          className="mt-3 inline-flex text-sm font-medium text-accent hover:underline"
        >
          Voir mon planning →
        </a>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Btn onClick={() => setPanel(panel === 'compose' ? 'none' : 'compose')}>
          Composer ma séance
        </Btn>
        <Btn variant="ghost" onClick={() => setPanel(panel === 'ingest' ? 'none' : 'ingest')}>
          J’ai fait ma séance
        </Btn>
      </div>

      {panel === 'compose' && <ComposePanel profileId={profileId} />}
      {panel === 'ingest' && (
        <IngestPanel
          profileId={profileId}
          onSaved={async () => {
            setPanel('none');
            await loadSessions();
          }}
        />
      )}

      {sessions.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">Tes dernières séances</h2>
          <ul className="mt-2 divide-y divide-border">
            {sessions.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{s.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(s.done_at).toLocaleDateString('fr-FR', {
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
        Réglages & consentement →
      </a>
    </div>
  );
}

// ─── compose : Dowze donne le prompt, ton IA (ChatGPT/Claude) reste le coach ───

function ComposePanel({ profileId }: { profileId: string }) {
  const [title, setTitle] = useState('Séance du jour');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('');
  const [result, setResult] = useState<{ prompt: string; closingPrompt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setResult(
        await composeSession(profileId, {
          title,
          goal: goal || undefined,
          level: level || undefined,
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold">Composer ma séance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dowze prépare un prompt clair. Copie-le dans <b>ton</b> IA (ChatGPT, Claude…) — c’est elle
        ton coach.
      </p>
      <div className="mt-3 grid gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre (ex. Haut du corps)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Objectif (ex. gagner en force)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          placeholder="Niveau (ex. débutant)"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3">
        <Btn onClick={run} disabled={busy}>
          {busy ? 'Préparation…' : 'Générer le prompt'}
        </Btn>
      </div>
      {result && (
        <div className="mt-4 space-y-2">
          <PromptBlock label="Prompt de séance" text={result.prompt} />
          <PromptBlock label="Pour le résumé de fin" text={result.closingPrompt} />
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

// ─── ingest : résumé libre → snapshot structuré (IA de Dowze), sauvegardé ───

function IngestPanel({ profileId, onSaved }: { profileId: string; onSaved: () => Promise<void> }) {
  const [summary, setSummary] = useState('');
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const { snapshot: snap } = await ingestSession(profileId, summary);
      setSnapshot(snap);
      const title =
        Array.isArray(snap.exercices) && snap.exercices.length > 0
          ? (snap.exercices as string[]).slice(0, 2).join(', ')
          : 'Séance';
      await saveSession(profileId, { title, summary, snapshot: snap });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec de l’enregistrement.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold">J’ai fait ma séance</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Écris librement ce que tu as fait. L’IA de Dowze en tire un résumé structuré — sans te
        juger.
      </p>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        placeholder="Ex. 4×8 développé couché à 50kg, tractions, ~50 min, plutôt satisfait mais épaules fatiguées."
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
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Résumé
          </div>
          <pre className="whitespace-pre-wrap text-foreground">
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
