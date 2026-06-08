import { Card, CardTitle, CardDescription } from '@/components/ui/card';

// Démo statique (les données réelles viendront de l'API : /skills, progression…).
const PROGRESSION = [
  { fil: 'Fondations', pct: 72 },
  { fil: 'Aptitudes durables', pct: 41 },
  { fil: 'Concepts-clés', pct: 28 },
];

const AUJOURDHUI = [
  { h: '09:00', quoi: 'Révision — Lire et comprendre un texte', kind: 'revision' },
  { h: '09:25', quoi: 'Apprentissage — Additionner', kind: 'apprentissage' },
  { h: '10:00', quoi: 'Pause (repos éveillé)', kind: 'pause' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-muted-foreground">Ta progression, ton plan du jour. Sans pression.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {PROGRESSION.map((p) => (
          <Card key={p.fil}>
            <CardTitle>{p.fil}</CardTitle>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${p.pct}%` }} />
            </div>
            <CardDescription>{p.pct}% maîtrisé (par BKT)</CardDescription>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Aujourd’hui</h2>
        <Card className="divide-y divide-border p-0">
          {AUJOURDHUI.map((e) => (
            <div key={e.h} className="flex items-center gap-4 px-6 py-3">
              <span className="w-14 text-sm tabular-nums text-muted-foreground">{e.h}</span>
              <span className="flex-1 text-sm">{e.quoi}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {e.kind}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
