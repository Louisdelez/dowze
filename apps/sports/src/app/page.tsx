'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDowzeProfile } from '@dowze/auth';
import {
  activateSports,
  addMatch,
  composeSession,
  declareTraining,
  ingestSession,
  listMatches,
  listSessions,
  myPlugins,
  saveSession,
  type CataloguePlugin,
  type MatchEntry,
  type SportsConfig,
  type SportsSessionRow,
} from '@/lib/core';

const ACADEMIE_URL = 'https://academie.dowze.ch';
const DISCIPLINES = ['course', 'football', 'natation', 'basket', 'tennis', 'vélo'];
const SCOPE_LABELS: Record<string, string> = {
  'profile:read': 'Lire ton profil',
  'calendar:read': 'Voir ton planning',
  'calendar:write': 'Ajouter entraînements et matchs au planning',
  'ai:infer': "Préparer tes séances avec l'IA de Dowze",
  'xp:write': 'Te récompenser en XP',
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</div>;
}
function Btn({ children, onClick, disabled, variant = 'primary', type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost'; type?: 'button' | 'submit' }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50';
  const styles = variant === 'primary' ? 'bg-accent text-accent-foreground hover:bg-accent-active' : 'border border-border text-foreground hover:bg-muted';
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>{children}</button>;
}

export default function SportsHome() {
  const { profileId, displayName, ready, signedIn } = useDowzeProfile();
  const [plugin, setPlugin] = useState<CataloguePlugin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const list = await myPlugins(profileId);
      setPlugin(list.find((p) => p.slug === 'sports') ?? null);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (ready && signedIn) void refresh();
    else if (ready) setLoading(false);
  }, [ready, signedIn, refresh]);

  if (!ready || (signedIn && loading)) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (!signedIn) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">Connecte-toi sur Dowze</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dowze Sports fait partie de ton compte Dowze. Connecte-toi une fois sur l’académie.</p>
        <a href={`${ACADEMIE_URL}/connexion`} className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-active">Aller sur l’académie</a>
      </Card>
    );
  }
  if (!plugin) return <Card>Plugin Sports introuvable.</Card>;

  return plugin.activation?.enabled ? (
    <Dashboard plugin={plugin} profileId={profileId!} displayName={displayName} />
  ) : (
    <ActivationGate plugin={plugin} profileId={profileId!} onDone={refresh} />
  );
}

function ActivationGate({ plugin, profileId, onDone }: { plugin: CataloguePlugin; profileId: string; onDone: () => Promise<void> }) {
  const [discipline, setDiscipline] = useState('course');
  const [goal, setGoal] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setErr(null);
    try {
      const scopes = [...plugin.scopesRequested, 'ai:infer'];
      const config: SportsConfig = { discipline, frequencyPerWeek: goal };
      await activateSports(plugin.id, profileId, scopes, config);
      await declareTraining(profileId, discipline, goal);
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bienvenue sur Dowze Sports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ta discipline, tes entraînements réguliers et tes matchs — intégrés à ton planning.</p>
      </div>
      <Card>
        <h2 className="text-sm font-semibold">Ta discipline</h2>
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm capitalize">
          {DISCIPLINES.map((d) => <option key={d} value={d} className="capitalize">{d}</option>)}
        </select>
        <h2 className="mt-4 text-sm font-semibold">Entraînements par semaine</h2>
        <div className="mt-3 flex gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setGoal(n)} className={`h-11 w-11 rounded-lg border text-sm font-medium transition ${goal === n ? 'border-accent bg-accent text-accent-foreground' : 'border-border hover:bg-muted'}`}>{n}×</button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold">Ce à quoi tu donnes accès</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {[...plugin.scopesRequested, 'ai:infer'].map((s) => (
            <li key={s} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> {SCOPE_LABELS[s] ?? s}</li>
          ))}
        </ul>
      </Card>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Btn onClick={activate} disabled={busy}>{busy ? 'Activation…' : 'Activer Dowze Sports'}</Btn>
    </div>
  );
}

function Dashboard({ plugin, profileId, displayName }: { plugin: CataloguePlugin; profileId: string; displayName: string | null }) {
  const config = (plugin.activation?.config ?? {}) as Partial<SportsConfig>;
  const discipline = config.discipline ?? 'sport';
  const goal = config.frequencyPerWeek ?? 3;
  const [sessions, setSessions] = useState<SportsSessionRow[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [panel, setPanel] = useState<'none' | 'compose' | 'ingest'>('none');

  const load = useCallback(async () => {
    setSessions(await listSessions(profileId));
    setMatches(await listMatches(profileId).catch(() => []));
  }, [profileId]);
  useEffect(() => { void load(); }, [load]);

  const thisWeek = useMemo(() => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    return sessions.filter((s) => new Date(s.done_at).getTime() >= since).length;
  }, [sessions]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Salut {displayName ?? 'à toi'} 👋</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{discipline} — {goal}× / semaine</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Cette semaine</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">{thisWeek} <span className="text-base font-normal text-muted-foreground">/ {goal}</span></div>
          </div>
          <div className="flex gap-1">{Array.from({ length: goal }).map((_, i) => <span key={i} className={`h-8 w-2.5 rounded-full ${i < thisWeek ? 'bg-accent' : 'bg-muted'}`} />)}</div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{thisWeek >= goal ? 'Objectif atteint 💪' : 'La régularité prime — une séance manquée ne casse rien.'}</p>
        <a href={`${ACADEMIE_URL}/planning`} className="mt-3 inline-flex text-sm font-medium text-accent hover:underline">Voir mon planning →</a>
      </Card>

      <MatchesCard profileId={profileId} matches={matches} onChange={load} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Btn onClick={() => setPanel(panel === 'compose' ? 'none' : 'compose')}>Préparer ma séance</Btn>
        <Btn variant="ghost" onClick={() => setPanel(panel === 'ingest' ? 'none' : 'ingest')}>J’ai fait ma séance</Btn>
      </div>
      {panel === 'compose' && <ComposePanel profileId={profileId} discipline={discipline} />}
      {panel === 'ingest' && <IngestPanel profileId={profileId} discipline={discipline} onSaved={async () => { setPanel('none'); await load(); }} />}

      {sessions.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold">Tes dernières séances</h2>
          <ul className="mt-2 divide-y divide-border">
            {sessions.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{s.title}</span>
                <span className="shrink-0 text-muted-foreground">{new Date(s.done_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <a href="/reglages" className="inline-flex text-sm text-muted-foreground hover:text-foreground">Réglages →</a>
    </div>
  );
}

function MatchesCard({ profileId, matches, onChange }: { profileId: string; matches: MatchEntry[]; onChange: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!title.trim() || !when) return;
    setBusy(true);
    setErr(null);
    try {
      await addMatch(profileId, title, new Date(when).toISOString());
      setTitle('');
      setWhen('');
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Conflit ou erreur.');
    } finally {
      setBusy(false);
    }
  }

  const upcoming = matches.filter((m) => new Date(m.start).getTime() >= Date.now() - 3600_000).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Card>
      <h2 className="text-sm font-semibold">Mes matchs</h2>
      <p className="mt-1 text-sm text-muted-foreground">Un match a une date fixe : c’est une <b>contrainte dure</b> du planning (l’étude s’organise autour).</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Adversaire / compétition" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
        <Btn onClick={add} disabled={busy || !title.trim() || !when}>Ajouter</Btn>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {upcoming.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {upcoming.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate">{m.title}</span>
              <span className="shrink-0 text-muted-foreground">{new Date(m.start).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ComposePanel({ profileId, discipline }: { profileId: string; discipline: string }) {
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('');
  const [result, setResult] = useState<{ prompt: string; closingPrompt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      setResult(await composeSession(profileId, { title: `Séance de ${discipline}`, goal: goal || undefined, level: level || undefined }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2 className="text-sm font-semibold">Préparer ma séance</h2>
      <p className="mt-1 text-sm text-muted-foreground">Dowze prépare un prompt — donne-le à <b>ton</b> IA/coach.</p>
      <div className="mt-3 grid gap-2">
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Objectif (ex. améliorer l’endurance)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Niveau" className="rounded-lg border border-border px-3 py-2 text-sm" />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3"><Btn onClick={run} disabled={busy}>{busy ? 'Préparation…' : 'Générer le prompt'}</Btn></div>
      {result && (
        <div className="mt-4 space-y-2"><PromptBlock label="Prompt de séance" text={result.prompt} /><PromptBlock label="Pour le résumé de fin" text={result.closingPrompt} /></div>
      )}
    </Card>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <button onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs font-medium text-accent hover:underline">{copied ? 'Copié ✓' : 'Copier'}</button>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-foreground">{text}</pre>
    </div>
  );
}

function IngestPanel({ profileId, discipline, onSaved }: { profileId: string; discipline: string; onSaved: () => Promise<void> }) {
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
      await saveSession(profileId, { title: `Séance de ${discipline}`, discipline, summary, snapshot: snap });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Échec.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <h2 className="text-sm font-semibold">J’ai fait ma séance</h2>
      <p className="mt-1 text-sm text-muted-foreground">Écris librement — l’IA de Dowze en tire un résumé structuré, sans te juger.</p>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Ex. 45 min de course, 6 km, allure correcte, jambes lourdes sur la fin." className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm" />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-3"><Btn onClick={run} disabled={busy || summary.trim().length < 3}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Btn></div>
      {snapshot && <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm"><pre className="whitespace-pre-wrap text-foreground">{JSON.stringify(snapshot, null, 2)}</pre></div>}
    </Card>
  );
}
