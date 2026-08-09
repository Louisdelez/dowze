'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ExerciseItem, RankJumpView, TestView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  abandonRankJump,
  doRetention,
  generatePretest,
  generateTest,
  getRankJump,
  moodCheckin,
  startRankJump,
  submitPretest,
  submitRankJumpDay,
  submitTest,
} from '@/lib/api';
import { ExerciseCard } from '@/components/exercises/exercise-card';
import { IconTrophy } from '@/components/ui/icons';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';

const DAY_COLOR: Record<string, string> = {
  learn: 'bg-sky-400',
  weekly: 'bg-indigo-500',
  expedition: 'bg-amber-500',
  exam: 'bg-rose-500',
  rest: 'bg-muted',
};

export default function SautPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [view, setView] = useState<RankJumpView | null>(null);
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestView | null>(null);
  const [results, setResults] = useState<Record<number, { skillId: string; correct: boolean }>>({});
  const [retentionId, setRetentionId] = useState<string | null>(null);
  const [pretest, setPretest] = useState<ExerciseItem[] | null>(null);

  const charger = useCallback(async () => {
    if (!profileId) return;
    try {
      setView(await getRankJump(profileId));
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  async function demarrer() {
    if (!profileId) return;
    setBusy(true);
    setErreur('');
    try {
      setView(await startRankJump(profileId));
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function faireLaTache() {
    if (!profileId || !view?.active?.today) return;
    setBusy(true);
    setErreur('');
    setResults({});
    try {
      const kind = view.active.today.type === 'exam' ? 'trimestrial' : 'weekly';
      const t = await generateTest(profileId, kind);
      setTest(t);
      if (t.items.length === 0) {
        // Rien à évaluer aujourd'hui → journée validée d'office.
        setTest(null);
        setView(await submitRankJumpDay(profileId, 1));
      }
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function faireLePretest() {
    if (!profileId) return;
    setBusy(true);
    setErreur('');
    setResults({});
    try {
      const { items } = await generatePretest(profileId);
      if (items.length === 0) {
        setView(await submitPretest(profileId, 0.5));
      } else {
        setPretest(items);
      }
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function terminerPretest() {
    if (!profileId || !pretest) return;
    setBusy(true);
    try {
      const graded = Object.values(results);
      const score = graded.length ? graded.filter((r) => r.correct).length / graded.length : 0;
      setView(await submitPretest(profileId, score));
      setPretest(null);
      setResults({});
    } finally {
      setBusy(false);
    }
  }

  async function faireMood(mood: number) {
    if (!profileId) return;
    setView(await moodCheckin(profileId, mood));
  }

  async function faireRetention(id: string) {
    if (!profileId) return;
    setBusy(true);
    setErreur('');
    setResults({});
    try {
      const t = await generateTest(profileId, 'weekly');
      if (t.items.length === 0) {
        setView(await doRetention(profileId, id, 1));
      } else {
        setRetentionId(id);
        setTest(t);
      }
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function terminerTache() {
    if (!profileId || !test) return;
    setBusy(true);
    try {
      const res = await submitTest(test.id, profileId, Object.values(results));
      const score = res.total > 0 ? res.correct / res.total : 1;
      const v = retentionId
        ? await doRetention(profileId, retentionId, score)
        : await submitRankJumpDay(profileId, score);
      setTest(null);
      setResults({});
      setRetentionId(null);
      setView(v);
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function abandonner() {
    if (!profileId) return;
    setBusy(true);
    try {
      setView(await abandonRankJump(profileId));
      setTest(null);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Le Saut de Rang est personnel."
        action={
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        }
      />
    );
  }

  const a = view?.active;
  const active = a && a.status === 'in-progress';
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saut de Rang"
        subtitle="Un mois intensif pour franchir un rang plus vite. Exigeant, volontaire — et sans risque si ça ne marche pas."
      />

      {erreur && <Note tone="error">Une erreur est survenue. Réessaie.</Note>}

      {test ? (
        <div className="space-y-4">
          {test.items.map((item: ExerciseItem, i: number) => (
            <ExerciseCard
              key={i}
              item={item}
              onGraded={(c) =>
                setResults((r) => ({ ...r, [i]: { skillId: item.competenceId, correct: c } }))
              }
            />
          ))}
          <Button
            onClick={terminerTache}
            disabled={busy || Object.keys(results).length !== test.items.length}
          >
            {busy ? 'Enregistrement…' : 'Terminer'}
          </Button>
        </div>
      ) : pretest ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pré-test « above-level » : des questions du rang visé (que tu n’as pas encore appris) —
            pour voir si un saut est jouable. Réponds au mieux ; ne pas savoir, c’est normal.
          </p>
          {pretest.map((item, i) => (
            <ExerciseCard
              key={i}
              item={item}
              onGraded={(c) =>
                setResults((r) => ({ ...r, [i]: { skillId: item.competenceId, correct: c } }))
              }
            />
          ))}
          <Button
            onClick={terminerPretest}
            disabled={busy || Object.keys(results).length !== pretest.length}
          >
            {busy ? '…' : 'Terminer le pré-test'}
          </Button>
        </div>
      ) : (
        <>
          {view && view.retention.length > 0 && (
            <Card className="space-y-2">
              <CardTitle>Révisions de rétention</CardTitle>
              <CardDescription>
                Des petits re-tests pour ancrer durablement ce que tu as validé lors d’un saut —
                même si tu hésites, l’effort de te souvenir renforce ta mémoire.
              </CardDescription>
              {view.retention.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <span>Rétention · niveau {r.rankName}</span>
                  <Button variant="secondary" onClick={() => faireRetention(r.id)} disabled={busy}>
                    Faire le re-test
                  </Button>
                </div>
              ))}
            </Card>
          )}

          {/* Saut en cours */}
          {a && a.status === 'pending-consent' ? (
            <Card className="space-y-2">
              <CardTitle>En attente de ton responsable</CardTitle>
              <CardDescription>
                Ton Saut vers <strong>{a.targetRankName}</strong> est prêt. Le mois intensif
                démarrera dès que ton responsable l’aura confirmé (dans son Espace responsable). En
                attendant, repose-toi bien.
              </CardDescription>
              <div>
                <Button variant="secondary" onClick={abandonner} disabled={busy}>
                  Annuler la demande
                </Button>
              </div>
            </Card>
          ) : active && a ? (
            <>
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Saut vers {a.targetRankName}</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    Jour {a.currentDay}/{a.totalDays}
                  </span>
                </div>
                {/* Barre de score vers 80 % */}
                <div className="relative h-3 w-full overflow-hidden rounded-full border border-border bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.round(a.provisionalScore * 100)}%` }}
                  />
                  <div className="absolute inset-y-0" style={{ left: '80%' }}>
                    <div className="h-full w-0.5 bg-foreground/60" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Score :{' '}
                  <strong className="text-foreground">
                    {Math.round(a.provisionalScore * 100)} %
                  </strong>{' '}
                  · objectif <strong className="text-foreground">80 %</strong> · examens réussis{' '}
                  {a.examsPassed}/{a.examsRequired}
                </p>
                {/* Frise du mois */}
                <div className="flex flex-wrap gap-1">
                  {a.plan.map((d) => (
                    <span
                      key={d.day}
                      title={`Jour ${d.day} — ${d.label}`}
                      className={`inline-block h-4 w-4 rounded-sm ${DAY_COLOR[d.type]} ${
                        d.day === a.currentDay ? 'ring-2 ring-offset-1 ring-foreground' : ''
                      } ${d.done ? '' : 'opacity-40'}`}
                    />
                  ))}
                </div>
              </Card>

              {/* Bien-être (A3) : soutien, jamais un diagnostic */}
              {view?.wellbeing.note ? <Note tone="info">{view.wellbeing.note}</Note> : null}

              {/* Tâche du jour */}
              <Card className="space-y-3">
                <CardTitle>Ta tâche du jour</CardTitle>
                {a.canDoToday ? (
                  <>
                    <CardDescription>{a.today?.label}</CardDescription>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Comment tu te sens ?</span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => faireMood(n)}
                          className="h-7 w-7 rounded-full border border-border hover:bg-muted"
                          title={`${n}/5`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={faireLaTache} disabled={busy}>
                        {busy ? '…' : 'Faire la tâche du jour'}
                      </Button>
                      <Button variant="secondary" onClick={abandonner} disabled={busy}>
                        Abandonner (retour au rang, sans pénalité)
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Rappel : dors 8-10 h, ça fait partie de la préparation. Le rythme doit rester
                      tenable.
                    </p>
                  </>
                ) : (
                  <>
                    <CardDescription>
                      Tu as fait ta tâche du jour — bravo. Reviens <strong>demain</strong> pour la
                      suite : un mois intensif se construit jour après jour (c’est ça qui ancre
                      durablement).
                    </CardDescription>
                    {a.nextTaskAt ? (
                      <p className="text-xs text-muted-foreground">
                        Prochaine tâche disponible le {formatDateTime(a.nextTaskAt)}.
                      </p>
                    ) : null}
                    <div>
                      <Button variant="secondary" onClick={abandonner} disabled={busy}>
                        Abandonner (retour au rang, sans pénalité)
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </>
          ) : a && a.status === 'passed' ? (
            <Card className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <IconTrophy width={20} height={20} className="text-amber-500" /> Réussi !
              </CardTitle>
              <CardDescription>
                Tu as validé le mois intensif — tu montes à <strong>{a.targetRankName}</strong>.
                Bravo, c’était dur et tu l’as fait. On te proposera des révisions espacées pour
                ancrer durablement ce que tu as appris.
              </CardDescription>
              <Link href="/resultats" className="text-accent underline-offset-2 hover:underline">
                Voir mon nouveau rang →
              </Link>
            </Card>
          ) : (
            // Pas de saut actif : jauge + démarrage
            <NoActive
              view={view}
              onStart={demarrer}
              onPretest={faireLePretest}
              busy={busy}
              previousStatus={a?.status}
            />
          )}
        </>
      )}
    </div>
  );
}

function NoActive({
  view,
  onStart,
  onPretest,
  busy,
  previousStatus,
}: {
  view: RankJumpView | null;
  onStart: () => void;
  onPretest: () => void;
  busy: boolean;
  previousStatus?: string;
}) {
  const e = view?.eligibility;
  return (
    <div className="space-y-4">
      {previousStatus === 'failed' || previousStatus === 'abandoned' ? (
        <Note tone="info">
          Ton précédent saut n’a pas abouti — <strong>aucune pénalité</strong>, tu es exactement à
          ton rang. Ce que tu as appris reste à toi. Tenter, c’est déjà fort.
        </Note>
      ) : null}

      <Card className="space-y-2">
        <CardTitle>Le Saut de Rang, c’est quoi ?</CardTitle>
        <CardDescription>
          Un mois intensif pour franchir un rang plus vite, si tu maîtrises déjà presque tout ton
          rang. Un test chaque jour, un grand test le samedi, une expédition-éclair le dimanche, et
          une semaine d’examens pour finir. <strong>Réussir = 80 %.</strong> C’est volontairement
          exigeant — tout le monde ne le fait pas, et c’est normal. Si ça n’aboutit pas, tu reprends
          ton rang sans rien perdre.
        </CardDescription>
      </Card>

      {e ? (
        <Card className="space-y-3">
          <CardTitle>Ta Jauge de Saut</CardTitle>
          <div className="relative h-3 w-full overflow-hidden rounded-full border border-border bg-muted">
            <div className="h-full rounded-full bg-fuchsia-500" style={{ width: `${e.score}%` }} />
            <div className="absolute inset-y-0" style={{ left: '60%' }}>
              <div className="h-full w-0.5 bg-foreground/60" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{e.score}/100</strong> · il faut au moins{' '}
            <strong>60</strong> pour te lancer (on vérifie que tu es prêt — sauter n’est pas
            s’épuiser pour rien).
          </p>
          {e.blockers.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {e.blockers.map((b, i) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          ) : null}
          {e.pretestNeeded ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Pour compléter ta jauge, passe le <strong>pré-test</strong> : quelques questions du
                rang visé (pas encore appris) pour vérifier que le saut est jouable.
              </p>
              <Button onClick={onPretest} disabled={busy}>
                {busy ? 'Préparation…' : 'Passer le pré-test'}
              </Button>
            </div>
          ) : e.canStart ? (
            <div className="space-y-2">
              {e.parentConsentNeeded ? (
                <p className="text-xs text-muted-foreground">
                  Ton responsable devra confirmer avant le démarrage.
                </p>
              ) : null}
              <Button onClick={onStart} disabled={busy}>
                {busy ? '…' : 'Démarrer le mois intensif'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pas encore prêt·e pour un saut — continue ton rang, la jauge montera avec ta maîtrise.
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
