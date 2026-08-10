'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  consolidateHiveMemory,
  exportHiveMemory,
  getHiveEvents,
  getHiveHandoffs,
  getHiveMemoryPolicy,
  getHiveLibrary,
  getHiveEventProvenance,
  searchHiveMemory,
  updateHiveMemoryPolicy,
  type HiveEvent,
  type HiveHandoff,
  type HiveMemoryPolicy,
  type HiveLibrary,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { IconBook, IconClock, IconMessage, IconUsers } from '@/components/ui/icons';

const KIND_LABELS: Record<string, string> = {
  'request.received': 'Demande',
  'response.delivered': 'Réponse',
  'message.received': 'Message reçu',
  'message.sent': 'Message envoyé',
  'handoff.created': 'Passage de relais',
  'handoff.completed': 'Relais terminé',
  'handoff.failed': 'Relais en échec',
};

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function MemoryPage() {
  const { signedIn } = useProfile();
  const [events, setEvents] = useState<HiveEvent[]>([]);
  const [handoffs, setHandoffs] = useState<HiveHandoff[]>([]);
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [provenance, setProvenance] = useState<Record<string, HiveEvent[]>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<HiveMemoryPolicy | null>(null);
  const [library, setLibrary] = useState<HiveLibrary | null>(null);

  useEffect(() => {
    if (!signedIn) {
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    Promise.all([
      getHiveEvents({ limit: 200 }),
      getHiveHandoffs(),
      getHiveMemoryPolicy(),
      getHiveLibrary(),
    ])
      .then(([nextEvents, nextHandoffs, nextPolicy, nextLibrary]) => {
        if (!active) return;
        setEvents(nextEvents);
        setHandoffs(nextHandoffs);
        setPolicy(nextPolicy);
        setLibrary(nextLibrary);
        setError('');
      })
      .catch(() => active && setError("La mémoire n'est pas disponible pour le moment."))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [signedIn]);

  const kinds = useMemo(() => [...new Set(events.map((event) => event.kind))].sort(), [events]);
  const shown = kind ? events.filter((event) => event.kind === kind) : events;

  async function runSearch() {
    setSearching(true);
    try {
      setEvents(await searchHiveMemory({ q: query.trim(), kind: kind || undefined, limit: 200 }));
      setError('');
    } catch {
      setError("La recherche dans la Bibliothèque n'est pas disponible.");
    } finally {
      setSearching(false);
    }
  }

  async function toggleProvenance(event: HiveEvent) {
    if (provenance[event.id]) {
      setProvenance((current) => {
        const next = { ...current };
        delete next[event.id];
        return next;
      });
      return;
    }
    const graph = await getHiveEventProvenance(event.id);
    setProvenance((current) => ({ ...current, [event.id]: graph.nodes }));
  }

  async function changePolicy(patch: Partial<HiveMemoryPolicy>) {
    setPolicy(await updateHiveMemoryPolicy(patch));
  }

  async function downloadExport() {
    const data = await exportHiveMemory();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dowze-memoire-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
            <IconBook className="h-7 w-7" /> Mémoire de la Ruche
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            La continuité de Dowze au-delà des sessions : demandes, décisions, réponses et passages
            de relais, avec leur provenance.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void runSearch()}
            placeholder="Un souvenir, même approximatif…"
            className="min-w-64 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          />
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            aria-label="Filtrer les événements"
          >
            <option value="">Tous les événements</option>
            {kinds.map((value) => (
              <option key={value} value={value}>
                {KIND_LABELS[value] ?? value}
              </option>
            ))}
          </select>
          <button
            onClick={() => void runSearch()}
            disabled={searching}
            className="rounded-xl bg-accent px-3 py-2 text-sm font-bold text-accent-foreground disabled:opacity-50"
          >
            {searching ? 'Recherche…' : 'Rechercher'}
          </button>
        </div>
      </div>

      {!signedIn && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-sm">
          Connecte-toi pour consulter ta mémoire Dowze.
        </div>
      )}
      {busy && <p className="mt-8 text-sm text-muted-foreground">Chargement de la mémoire…</p>}
      {error && (
        <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">{error}</p>
      )}

      {signedIn && !busy && !error && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
          <section aria-label="Chronologie" className="space-y-3">
            {shown.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                La mémoire se remplira au fil de tes interactions avec les compagnons.
              </div>
            )}
            {shown.map((event) => (
              <article
                key={event.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-accent/10 px-2 py-1 font-semibold text-accent">
                    {KIND_LABELS[event.kind] ?? event.kind}
                  </span>
                  <span>{event.channel}</span>
                  {event.space && <span>· {event.space}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    <IconClock className="h-3.5 w-3.5" /> {when(event.occurredAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{event.content}</p>
                {!!event.sourceEventIds.length && (
                  <button
                    onClick={() => void toggleProvenance(event)}
                    className="mt-3 text-left text-xs font-semibold text-accent"
                  >
                    {provenance[event.id] ? 'Masquer' : 'Voir'} la provenance ·{' '}
                    {event.sourceEventIds.length} source(s)
                  </button>
                )}
                {provenance[event.id] && (
                  <div className="mt-3 border-l-2 border-accent/30 pl-3">
                    {provenance[event.id]!.filter((node) => node.id !== event.id).map((node) => (
                      <div key={node.id} className="mt-2 text-xs">
                        <span className="font-semibold">{KIND_LABELS[node.kind] ?? node.kind}</span>
                        <span className="ml-2 text-muted-foreground">{when(node.occurredAt)}</span>
                        <p className="mt-1 line-clamp-2">{node.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>

          <aside className="h-fit rounded-2xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 font-bold">
              <IconUsers className="h-4 w-4" /> Passages de relais
            </h2>
            <div className="mt-3 space-y-3">
              {handoffs.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun relais pour le moment.</p>
              )}
              {handoffs.slice(0, 20).map((handoff) => (
                <div key={handoff.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <IconMessage className="h-3.5 w-3.5" /> {handoff.status}
                    <span className="ml-auto text-muted-foreground">{handoff.urgency}</span>
                  </div>
                  <p className="mt-2 line-clamp-3">{handoff.originalRequest}</p>
                  {handoff.summarizedContext && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {handoff.summarizedContext}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {policy && (
              <div className="mt-5 border-t border-border pt-4">
                <h2 className="font-bold">Contrôle de la mémoire</h2>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policy.proactiveMemoryEnabled}
                    onChange={(event) =>
                      void changePolicy({ proactiveMemoryEnabled: event.target.checked })
                    }
                  />
                  Consolidation automatique
                </label>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policy.crossSpaceEnabled}
                    onChange={(event) =>
                      void changePolicy({ crossSpaceEnabled: event.target.checked })
                    }
                  />
                  Mémoire entre espaces
                </label>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={policy.personalDataEnabled}
                    onChange={(event) =>
                      void changePolicy({ personalDataEnabled: event.target.checked })
                    }
                  />
                  Données personnelles autorisées
                </label>
                <div className="mt-4 grid gap-2">
                  <button
                    className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:border-accent"
                    onClick={() => void consolidateHiveMemory()}
                  >
                    Consolider maintenant
                  </button>
                  <button
                    className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:border-accent"
                    onClick={() => void downloadExport()}
                  >
                    Exporter mes données
                  </button>
                </div>
              </div>
            )}
            {library && (
              <div className="mt-5 border-t border-border pt-4">
                <h2 className="font-bold">Bibliothécaires</h2>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted p-2">
                    <strong className="block text-base">{library.memories.length}</strong>faits
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <strong className="block text-base">{library.episodes.length}</strong>épisodes
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <strong className="block text-base">{library.relations.length}</strong>relations
                  </div>
                </div>
                {library.episodes.slice(0, 3).map((episode) => (
                  <div
                    key={episode.id}
                    className="mt-3 rounded-xl border border-border p-3 text-xs"
                  >
                    <strong>{episode.title}</strong>
                    <p className="mt-1 line-clamp-3 text-muted-foreground">{episode.summary}</p>
                  </div>
                ))}
                {library.memoryHistory.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Versions remplacées
                    </h3>
                    {library.memoryHistory.slice(0, 5).map((memory) => (
                      <div
                        key={memory.id}
                        className="mt-2 rounded-xl border border-dashed p-3 text-xs"
                      >
                        <span className="line-through opacity-70">{memory.content}</span>
                        {memory.validTo && (
                          <span className="mt-1 block text-muted-foreground">
                            valable jusqu’au {new Date(memory.validTo).toLocaleDateString('fr-CH')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
