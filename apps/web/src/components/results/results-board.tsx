'use client';

import { useState } from 'react';
import type { Progression, RankChoice, ResultsView } from '@dowze/schemas';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { IconCheck } from '@/components/ui/icons';

/**
 * Bulletin SANS note. Progression « façon jeu vidéo compétitif » : un rang unique + une barre RR
 * (niveau requis du rang). La montée se débloque sous 3 conditions (niveau requis + 3 examens
 * trimestriels + ≥ 60 % des tests hebdo) et un plancher d'1 an ; elle n'est jamais automatique
 * (vote de l'élève + confirmation du responsable). Réutilisé côté élève et côté responsable.
 */

type Variant = 'student' | 'parent';

// Couleurs de rang façon jeu vidéo (Fer → Dowzer Suprême).
const TIER_DEFAULT = { bg: '#64748b', ring: '#475569' };
const TIER_STYLE: Record<number, { bg: string; ring: string }> = {
  1: { bg: '#64748b', ring: '#475569' },
  2: { bg: '#b45309', ring: '#92400e' },
  3: { bg: '#94a3b8', ring: '#64748b' },
  4: { bg: '#eab308', ring: '#ca8a04' },
  5: { bg: '#2dd4bf', ring: '#0d9488' },
  6: { bg: '#10b981', ring: '#059669' },
  7: { bg: '#22d3ee', ring: '#06b6d4' },
  8: { bg: '#8b5cf6', ring: '#7c3aed' },
  9: { bg: '#ef4444', ring: '#b91c1c' },
  10: { bg: 'linear-gradient(135deg,#f59e0b,#d946ef)', ring: '#a21caf' },
};
const tierStyle = (r: number) => TIER_STYLE[r] ?? TIER_DEFAULT;

export function ResultsBoard({
  data,
  variant = 'student',
  onVote,
}: {
  data: ResultsView;
  variant?: Variant;
  onVote?: (choice: RankChoice) => Promise<void>;
}) {
  const p = data.progression;
  return (
    <div className="space-y-6">
      {data.pointDepart && (
        <Card className="space-y-1">
          <CardTitle>Ton point de départ</CardTitle>
          <CardDescription>
            {data.pointDepart.aboveReferential
              ? 'Tu es parti·e en ayant déjà un beau socle d’avance — un vrai tremplin !'
              : data.pointDepart.entrySkillTitle
                ? `Tu es parti·e en commençant par « ${data.pointDepart.entrySkillTitle} ». C'est ton point de départ, pas ta limite.`
                : 'Ton point de départ a été situé — il ne dit pas ce dont tu es capable, seulement par où commencer.'}
          </CardDescription>
        </Card>
      )}

      {p && <RankCard p={p} variant={variant} onVote={onVote} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="space-y-2">
          <CardTitle>Tes forces</CardTitle>
          {data.strengths.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.strengths.map((s, i) => (
                <span key={i} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <CardDescription>Tes premières réussites apparaîtront ici — ça vient vite !</CardDescription>
          )}
        </Card>
        <Card className="space-y-2">
          <CardTitle>Ton prochain défi</CardTitle>
          {data.nextStep ? (
            <p className="text-sm">
              Continuer avec : <strong>{data.nextStep.title}</strong>{' '}
              <span className="text-muted-foreground">({data.nextStep.domain})</span>
            </p>
          ) : (
            <CardDescription>L'IA de Dowze te génère la suite — le chemin ne s'arrête jamais.</CardDescription>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <div>
          <CardTitle>Tes tests d'entraînement</CardTitle>
          <CardDescription>Chaque test compte pour ta montée de rang (≥ 60 % à réussir sur l'année).</CardDescription>
        </div>
        {data.tests.length > 0 ? (
          <ul className="space-y-2">
            {data.tests.map((t, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{t.kind === 'trimestrial' ? 'Examen trimestriel' : 'Test de la semaine'}</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{t.correct}/{t.total}</strong> réussi(s) · {formatDate(t.dateIso)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <CardDescription>Aucun test pour l'instant.</CardDescription>
        )}
      </Card>
    </div>
  );
}

/** Carte de rang : écusson + barre RR + conditions de montée + vote. */
function RankCard({ p, variant, onVote }: { p: Progression; variant: Variant; onVote?: (c: RankChoice) => Promise<void> }) {
  const style = tierStyle(p.rank);
  const [busy, setBusy] = useState<RankChoice | null>(null);

  const vote = async (choice: RankChoice) => {
    if (!onVote || busy) return;
    setBusy(choice);
    try {
      await onVote(choice);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-black text-white shadow"
          style={{ background: style.bg, boxShadow: `inset 0 0 0 1px ${style.ring}` }}
          aria-hidden
        >
          {p.rank}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {variant === 'parent' ? 'Rang de l’élève' : 'Ton rang'}
          </p>
          <p className="text-xl font-bold leading-tight">
            <span className={p.isTop ? 'text-fuchsia-700' : ''}>{p.rankName}</span>{' '}
            <span className="text-sm font-normal text-muted-foreground">{p.rankEquivalent}</span>
          </p>
        </div>
        {!p.isTop && p.nextRankName ? (
          <span className="ml-auto shrink-0 text-right text-xs text-muted-foreground">
            vers
            <br />
            <strong className="text-foreground">{p.nextRankName}</strong>
          </span>
        ) : null}
      </div>

      {/* Barre RR */}
      <div
        className="h-3 w-full overflow-hidden rounded-full border border-border bg-muted"
        style={p.isTop ? { background: 'linear-gradient(90deg,#f59e0b33,#d946ef66,#f59e0b33)', borderColor: 'transparent' } : undefined}
      >
        {!p.isTop ? <div className="h-full rounded-full" style={{ width: `${p.rr}%`, background: style.bg }} /> : null}
      </div>

      {/* Rien d'autre que le rang + la barre. La montée (quand débloquée) apparaît ici, sinon rien. */}
      {!p.isTop && p.eligible ? (
        <RankVote p={p} variant={variant} busy={busy} vote={vote} hasVote={!!onVote} />
      ) : null}
    </Card>
  );
}

function RankVote({
  p,
  variant,
  busy,
  vote,
  hasVote,
}: {
  p: Progression;
  variant: Variant;
  busy: RankChoice | null;
  vote: (c: RankChoice) => Promise<void>;
  hasVote: boolean;
}) {
  const studentAccepted = p.studentChoice === 'accept';

  if (variant === 'parent') {
    if (!studentAccepted) {
      return (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          L’élève peut monter au rang <strong>{p.nextRankName}</strong>. En attente de son choix — puis tu
          confirmeras avec lui.
        </p>
      );
    }
    return (
      <div className="space-y-2 rounded-lg bg-emerald-50 p-3">
        <p className="text-sm text-emerald-900">
          {p.rankName} → <strong>{p.nextRankName}</strong> : l’élève souhaite monter. Confirmes-tu le passage,
          ou vaut-il mieux consolider une année de plus ?
        </p>
        {hasVote ? (
          <div className="flex flex-wrap gap-2">
            <VoteButton primary busy={busy === 'accept'} onClick={() => vote('accept')}>
              Confirmer le passage
            </VoteButton>
            <VoteButton busy={busy === 'consolidate'} onClick={() => vote('consolidate')}>
              Consolider une année
            </VoteButton>
          </div>
        ) : null}
      </div>
    );
  }

  // Élève
  if (studentAccepted && p.hasParent && p.parentChoice !== 'accept') {
    return (
      <p className="flex items-start gap-1.5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
        <IconCheck width={16} height={16} className="mt-0.5 shrink-0 text-emerald-600" />
        <span>
          Tu as choisi de monter vers <strong>{p.nextRankName}</strong>. En attente de la confirmation de ton
          responsable.
        </span>
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-lg bg-emerald-50 p-3">
      <p className="text-sm text-emerald-900">
        Tu remplis tout pour passer à <strong>{p.nextRankName}</strong> ! À toi de choisir : monter, ou
        consolider une année de plus si tu préfères d’abord affûter (les deux sont de bons choix).
      </p>
      {hasVote ? (
        <div className="flex flex-wrap gap-2">
          <VoteButton primary busy={busy === 'accept'} onClick={() => vote('accept')}>
            Passer à {p.nextRankName}
          </VoteButton>
          <VoteButton busy={busy === 'consolidate'} onClick={() => vote('consolidate')}>
            Consolider une année
          </VoteButton>
        </div>
      ) : null}
    </div>
  );
}

function VoteButton({
  children,
  onClick,
  busy,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
        primary
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'border border-border bg-background text-foreground hover:bg-muted'
      }`}
    >
      {busy ? '…' : children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
