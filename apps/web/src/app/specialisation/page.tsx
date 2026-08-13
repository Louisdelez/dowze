'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { DisciplineProgress, SpecializationPlan, SpecializationView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  chooseSpecialization,
  completeMilestone,
  dropSpecialization,
  generateSpecPlan,
  getSpecialization,
  getSpecPlan,
} from '@/lib/api';
import { IconCheck } from '@/components/ui/icons';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton';

export default function SpecialisationPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [view, setView] = useState<SpecializationView | null>(null);
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState('');

  const charger = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    try {
      setView(await getSpecialization(profileId));
    } finally {
      setCharge(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  async function choisir(discipline: string) {
    if (!profileId) return;
    setBusy(discipline);
    try {
      setView(await chooseSpecialization(profileId, discipline));
    } finally {
      setBusy('');
    }
  }
  async function retirer(discipline: string) {
    if (!profileId) return;
    setBusy(discipline);
    try {
      setView(await dropSpecialization(profileId, discipline));
    } finally {
      setBusy('');
    }
  }

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Ta spécialisation est personnelle."
        action={
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma spécialisation"
        subtitle="On n’apprend jamais tout — on choisit ses directions et on les creuse. Librement, ou guidé."
      />

      {charge && !view && <SkeletonCards count={3} />}

      {view && !view.unlocked && (
        <Card className="space-y-1">
          <CardTitle>Bientôt : construis d’abord ton socle</CardTitle>
          <CardDescription>
            La spécialisation s’ouvre au rang <strong>{view.unlockRankName}</strong> — pour
            l’instant tu bâtis une base large dans plusieurs domaines (c’est ce qui rend une
            spécialité solide). Tu es <strong>{view.currentRankName}</strong>. Continue, elle se
            débloquera.
          </CardDescription>
        </Card>
      )}

      {view && view.unlocked && (
        <>
          {/* Badges obtenus */}
          {view.badges.length > 0 && (
            <Card className="space-y-2">
              <CardTitle>Tes badges</CardTitle>
              <div className="flex flex-wrap gap-2">
                {view.badges.map((b) => (
                  <span
                    key={b.id}
                    title={b.criteria}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-800"
                  >
                    <IconCheck width={14} height={14} className="text-amber-600" />
                    {b.name}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Voies actives + plan de spécialisation */}
          {view.active.length > 0 &&
            profileId &&
            view.active.map((d) => (
              <Card key={d.discipline} className="space-y-3">
                <DisciplineRow
                  d={d}
                  busy={busy === d.discipline}
                  onDrop={() => retirer(d.discipline)}
                />
                <PlanSection profileId={profileId} discipline={d.discipline} onBadge={charger} />
              </Card>
            ))}

          {/* Propositions guidées */}
          {view.proposals.length > 0 && (
            <Card className="space-y-3">
              <CardTitle>Des voies pour toi</CardTitle>
              <CardDescription>
                Choisies d’après ce que tu creuses le plus — ce sont des pistes, pas un verdict.
              </CardDescription>
              {view.proposals.map((p) => (
                <div
                  key={p.discipline}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{p.discipline}</p>
                    <p className="text-sm text-muted-foreground">{p.reason}</p>
                  </div>
                  <Button onClick={() => choisir(p.discipline)} disabled={busy === p.discipline}>
                    {busy === p.discipline ? '…' : 'Choisir'}
                  </Button>
                </div>
              ))}
            </Card>
          )}

          {/* Choix libre */}
          <Card className="space-y-3">
            <CardTitle>Ou choisis librement</CardTitle>
            <CardDescription>
              Prends la direction que tu veux. Tu pourras en ajouter, en combiner, ou en retirer
              quand tu veux.
            </CardDescription>
            <div className="grid gap-2 sm:grid-cols-2">
              {view.disciplines.map((d) => (
                <div
                  key={d.discipline}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{d.discipline}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.mastered} maîtrisée(s) · jusqu’à {d.topRankName}
                    </p>
                  </div>
                  {d.chosen ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-700">Choisie</span>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => choisir(d.discipline)}
                      disabled={busy === d.discipline}
                    >
                      {busy === d.discipline ? '…' : 'Choisir'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {view.active.length === 0 && view.proposals.length === 0 && (
            <Note tone="info">
              Explore encore un peu chaque domaine — dès que tu creuses davantage l’un d’eux, Dowze
              te proposera d’en faire une voie.
            </Note>
          )}
        </>
      )}
    </div>
  );
}

function PlanSection({
  profileId,
  discipline,
  onBadge,
}: {
  profileId: string;
  discipline: string;
  onBadge: () => void;
}) {
  const [plan, setPlan] = useState<SpecializationPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getSpecPlan(profileId, discipline)
      .then((p) => setPlan(p))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [profileId, discipline]);

  async function generer() {
    setBusy(true);
    setErr('');
    try {
      setPlan(await generateSpecPlan(profileId, discipline));
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      setErr(
        msg.includes('402')
          ? 'Il faut des crédits (ou ta clé) pour que le guide génère ton plan — voir « Mon Copilote ».'
          : 'Le guide n’a pas pu générer le plan. Réessaie.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function valider(mid: string) {
    setBusy(true);
    try {
      setPlan(await completeMilestone(profileId, discipline, mid));
      onBadge();
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  if (!plan)
    return (
      <div className="border-t border-border/50 pt-3">
        {err && <Note tone="error">{err}</Note>}
        <Button onClick={generer} disabled={busy}>
          {busy ? 'Le guide prépare ton plan…' : 'Générer mon plan de spécialisation'}
        </Button>
      </div>
    );

  return (
    <div className="space-y-3 border-t border-border/50 pt-3">
      <p className="text-sm">
        <strong>Ton cap :</strong> {plan.distalGoal}
      </p>
      {plan.milestones.map((m, i) => (
        <div key={m.id} className="space-y-1 rounded-lg border border-border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium">
              {m.done ? <IconCheck width={16} height={16} className="text-emerald-600" /> : null}
              <span>
                Jalon {i + 1} — {m.competency}
              </span>
            </p>
            {!m.done ? (
              <Button variant="secondary" onClick={() => valider(m.id)} disabled={busy}>
                Valider
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Réussi si : {m.successCriteria.join(' · ')}
          </p>
          {m.projectBrief ? (
            <p className="text-xs text-muted-foreground">Projet : {m.projectBrief}</p>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={generer}
        disabled={busy}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Régénérer le plan
      </button>
    </div>
  );
}

function DisciplineRow({
  d,
  busy,
  onDrop,
}: {
  d: DisciplineProgress;
  busy: boolean;
  onDrop: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="font-medium">{d.discipline}</p>
        <p className="text-sm text-muted-foreground">
          {d.mastered} maîtrisée(s) · jusqu’à {d.topRankName}
          {d.nextSkillTitle ? (
            <>
              {' '}
              · prochaine étape : <strong className="text-foreground">{d.nextSkillTitle}</strong>
            </>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onDrop}
        disabled={busy}
        className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
      >
        {busy ? '…' : 'Retirer'}
      </button>
    </div>
  );
}
