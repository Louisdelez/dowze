'use client';

import { useCallback, useEffect, useState } from 'react';
import { getHiveRun, getHiveRuns, type HiveRun, type HiveTask } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';

const statusLabel: Record<string, string> = {
  planning: 'Planification',
  running: 'En cours',
  waiting_approval: 'Attend ton accord',
  completed: 'Terminé',
  failed: 'Échec',
  cancelled: 'Annulé',
  pending: 'En attente',
  accepted: 'Acceptée',
};

export default function OperationsPage() {
  const { signedIn } = useProfile();
  const [runs, setRuns] = useState<HiveRun[]>([]);
  const [selected, setSelected] = useState<(HiveRun & { tasks: HiveTask[] }) | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const next = await getHiveRuns();
    setRuns(next);
    if (selected) setSelected(await getHiveRun(selected.id));
  }, [selected]);

  useEffect(() => {
    if (!signedIn) return;
    void refresh().catch(() => setError("Le journal d'exécution est indisponible."));
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [refresh, signedIn]);

  async function inspect(run: HiveRun) {
    setSelected(await getHiveRun(run.id));
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-3xl font-black tracking-tight">Opérations de la Ruche</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Chaque objectif est une exécution bornée. Tu peux voir les tâches, les abeilles mobilisées,
        leur profondeur, leur résultat et les limites qui empêchent une récursion incontrôlée.
      </p>
      {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3">{error}</p>}
      {!signedIn && (
        <p className="mt-8 rounded-2xl border p-5">Connecte-toi pour voir les opérations.</p>
      )}
      {signedIn && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
          <section className="space-y-3">
            {runs.length === 0 && (
              <p className="rounded-2xl border p-5">Aucune exécution enregistrée.</p>
            )}
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => void inspect(run)}
                className="block w-full rounded-2xl border bg-surface p-4 text-left shadow-sm hover:border-accent"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">
                    {statusLabel[run.status] ?? run.status}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {run.usedTasks}/{run.maxTasks} tâches · {run.usedCredits}/{run.maxCredits}{' '}
                    crédits
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 font-semibold">{run.objective}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  profondeur ≤ {run.maxDepth} · branches ≤ {run.maxFanout} · durée ≤{' '}
                  {run.maxRuntimeSeconds}s
                </p>
              </button>
            ))}
          </section>
          <section className="h-fit rounded-2xl border bg-surface p-5">
            <h2 className="font-bold">Graphe de travail</h2>
            {!selected && (
              <p className="mt-3 text-sm text-muted-foreground">
                Choisis une exécution pour voir ses tâches.
              </p>
            )}
            {selected?.tasks.map((task) => (
              <article
                key={task.id}
                className="mt-3 rounded-xl border p-3"
                style={{ marginLeft: `${Math.min(task.depth, 5) * 12}px` }}
              >
                <div className="flex items-center gap-2 text-xs">
                  <strong>{statusLabel[task.status] ?? task.status}</strong>
                  <span className="ml-auto text-muted-foreground">niveau {task.depth}</span>
                </div>
                <p className="mt-2 text-sm">{task.objective}</p>
                {task.output && <p className="mt-2 text-xs text-muted-foreground">{task.output}</p>}
                {task.error && <p className="mt-2 text-xs text-red-700">{task.error}</p>}
              </article>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
