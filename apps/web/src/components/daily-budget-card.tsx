'use client';

import { useEffect, useState } from 'react';
import type { DailyBudgetView } from '@dowze/schemas';
import { getDailyBudget } from '@/lib/api';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

/** Couleur douce par bloc (une seule teinte structurante ; pas de rouge/vert criard). */
const COLORS: Record<string, string> = {
  language: 'bg-accent',
  review: 'bg-sky-300',
  courses: 'bg-indigo-300',
  expeditions: 'bg-violet-300',
  secondary: 'bg-amber-300',
};

/** Affiche la répartition quotidienne conseillée (langue le matin, passion plafonnée). */
export function DailyBudgetCard({ profileId }: { profileId: string }) {
  const [b, setB] = useState<DailyBudgetView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDailyBudget(profileId)
      .then((v) => !cancelled && setB(v))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (!b) return null;

  return (
    <Card>
      <CardTitle className="text-base">Ta journée idéale (~{b.totalMinutes} min)</CardTitle>
      <CardDescription>{b.note}</CardDescription>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full">
        {b.blocks.map((blk) => (
          <div
            key={blk.key}
            className={COLORS[blk.key] ?? 'bg-muted'}
            style={{ width: `${blk.pct}%` }}
            title={`${blk.label} — ${blk.minutes} min`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {b.blocks.map((blk) => (
          <li key={blk.key} className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${COLORS[blk.key] ?? 'bg-muted'}`}
            />
            <span className="text-muted-foreground">
              {blk.label} · {blk.minutes}′{blk.protectedBlock ? ' (protégé)' : ''}
              {blk.capped ? ' (plafonné)' : ''}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
