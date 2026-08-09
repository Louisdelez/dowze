'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ElectiveProposal, ElectiveView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  addElectiveJournal,
  analyzeElective,
  cancelElectiveChange,
  chooseElective,
  completeElectiveMilestone,
  confirmElectiveChange,
  exitElective,
  generateElectivePlan,
  getElective,
  nextDiscipline,
  proposeElectiveChange,
  setElectiveMode,
  startDiscovery,
} from '@/lib/api';
import { IconStar, IconCheck, IconCompass, IconHeart } from '@/components/ui/icons';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { SkeletonCards } from '@/components/ui/skeleton';

function frDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
}

export default function PassionPage() {
  const { profileId, signedIn } = useProfile();
  const [view, setView] = useState<ElectiveView | null>(null);
  const [charge, setCharge] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [proposals, setProposals] = useState<ElectiveProposal[]>([]);

  // saisies
  const [discInputs, setDiscInputs] = useState<string[]>(['', '', '', '', '']);
  const [freeLabel, setFreeLabel] = useState('');
  const [journal, setJournal] = useState({ did: '', liked: '', disliked: '', intensity: 3 });
  const [changeTarget, setChangeTarget] = useState('');

  const charger = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    try {
      setView(await getElective(profileId));
    } finally {
      setCharge(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  function guard<T>(fn: () => Promise<T>, tag: string) {
    return async () => {
      if (!profileId) return;
      setBusy(tag);
      setErr('');
      try {
        await fn();
      } catch (e) {
        setErr(e instanceof Error ? e.message.replace(/^API \d+ — /, '') : 'Impossible.');
      } finally {
        setBusy('');
      }
    };
  }

  const lancerDecouverte = guard(async () => {
    const labels = discInputs.map((s) => s.trim()).filter(Boolean);
    if (labels.length !== 5) {
      setErr('Indique 5 disciplines à explorer (une par ligne).');
      return;
    }
    setView(
      await startDiscovery(
        profileId!,
        labels.map((label) => ({ label, disciplineHint: '' })),
      ),
    );
  }, 'discovery');

  const suivante = guard(async () => setView(await nextDiscipline(profileId!)), 'next');

  const enregistrerJournal = guard(async () => {
    const cur = view?.discovery?.currentDiscipline;
    if (!cur) return;
    setView(await addElectiveJournal(profileId!, { discipline: cur.label, ...journal }));
    setJournal({ did: '', liked: '', disliked: '', intensity: 3 });
  }, 'journal');

  const analyser = guard(async () => setProposals(await analyzeElective(profileId!)), 'analyze');

  const choisir = (label: string, mode: 'plaisir' | 'pro' = 'plaisir') =>
    guard(async () => {
      setView(await chooseElective(profileId!, { label, mode }));
      setProposals([]);
    }, 'choose:' + label)();

  const genererPlan = guard(async () => {
    await generateElectivePlan(profileId!);
    setView(await getElective(profileId!));
  }, 'plan');

  const validerJalon = (id: string) =>
    guard(async () => {
      await completeElectiveMilestone(profileId!, id);
      setView(await getElective(profileId!));
    }, 'ms:' + id)();

  if (!charge && !view) return <div className="p-6" />;
  const e = view?.elective ?? null;
  const d = view?.discovery ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Ma passion"
        subtitle="Un cours secondaire, 100 % ton choix. Pousse ce que tu aimes — peut-être jusqu'au métier. Ça reste une passion : temps mesuré, jamais au détriment des cours principaux (ton plan B solide)."
      />
      {charge && <SkeletonCards count={2} />}

      {view && (
        <>
          {view.capMinutes > 0 && !e && !d && (
            <Note>
              Optionnel — prends ton temps. Une passion se travaille ~{view.capMinutes} min/jour au
              plus : assez pour progresser, sans négliger le reste.
            </Note>
          )}

          {/* ---- Passion active ---- */}
          {e && (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{e.label}</CardTitle>
                    <CardDescription>
                      {e.mode === 'pro'
                        ? 'Mode : en faire un métier (Plan A / Plan B)'
                        : 'Mode : pour le plaisir'}
                    </CardDescription>
                  </div>
                  <IconStar />
                </div>
                {e.commitUntilIso && e.status === 'active' && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Tu t'es engagé·e jusqu'au {frDate(e.commitUntilIso)} — donne une vraie chance à
                    ton choix. Mais tu restes libre.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="utility"
                    onClick={() =>
                      void guard(
                        async () =>
                          setView(
                            await setElectiveMode(profileId!, e.mode === 'pro' ? 'plaisir' : 'pro'),
                          ),
                        'mode',
                      )()
                    }
                  >
                    {e.mode === 'pro'
                      ? 'Repasser en « pour le plaisir »'
                      : 'Passer en « professionnaliser »'}
                  </Button>
                </div>
              </Card>

              {/* Plan (Plan A/B) */}
              {view.plan ? (
                <Card>
                  <CardTitle>{view.plan.distalGoal}</CardTitle>
                  {view.plan.baseRate && <Note className="mt-2">{view.plan.baseRate}</Note>}
                  {view.plan.paths.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Des voies possibles (Plan A / Plan B) :</p>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {view.plan.paths.map((p, i) => (
                          <li key={i}>
                            <span className="font-medium text-foreground">{p.title}</span> —{' '}
                            {p.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <ol className="mt-4 space-y-3">
                    {view.plan.milestones.map((m) => (
                      <li key={m.id} className="rounded-md border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{m.competency}</span>
                          {m.done ? (
                            <span className="inline-flex items-center gap-1 text-sm text-green-700">
                              <IconCheck /> fait
                            </span>
                          ) : (
                            <Button
                              variant="utility"
                              onClick={() => void validerJalon(m.id)}
                              disabled={busy === 'ms:' + m.id}
                            >
                              Valider
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{m.projectBrief}</p>
                      </li>
                    ))}
                  </ol>
                </Card>
              ) : (
                <Card>
                  <CardTitle className="text-base">Un plan pour progresser</CardTitle>
                  <CardDescription>
                    L'IA de Dowze te trace des jalons concrets, avec des projets et des badges.
                  </CardDescription>
                  <div className="mt-3">
                    <Button onClick={() => void genererPlan()} disabled={busy === 'plan'}>
                      {busy === 'plan' ? 'Génération…' : 'Générer mon plan'}
                    </Button>
                  </div>
                </Card>
              )}

              {view.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {view.badges.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-sm"
                    >
                      <IconStar /> {b.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Changer de passion : verrou DOUX + réflexion 1 mois + rampe de sortie */}
              <Card>
                <CardTitle className="text-base">Changer de passion</CardTitle>
                {view.inReflection ? (
                  <>
                    <CardDescription>
                      Tu réfléchis à passer à « {e.changeTarget} ». Confirmation possible à partir
                      du {frDate(e.changeConfirmIso)} (on te laisse un mois pour être sûr·e).
                    </CardDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          void guard(
                            async () => setView(await confirmElectiveChange(profileId!)),
                            'confirm',
                          )()
                        }
                        disabled={busy === 'confirm'}
                      >
                        Confirmer le changement
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void guard(
                            async () => setView(await cancelElectiveChange(profileId!)),
                            'cancelc',
                          )()
                        }
                        disabled={busy === 'cancelc'}
                      >
                        Finalement, je garde
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <CardDescription>
                      Tu peux changer, mais on te propose d'y réfléchir 1 mois avant de confirmer
                      (pour ne pas décider sur un coup de tête).
                    </CardDescription>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        value={changeTarget}
                        onChange={(ev) => setChangeTarget(ev.target.value)}
                        placeholder="Nouvelle passion envisagée"
                        className="flex-1 rounded-md border border-border bg-surface p-2 text-sm"
                      />
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void guard(
                            async () =>
                              setView(await proposeElectiveChange(profileId!, changeTarget)),
                            'propose',
                          )()
                        }
                        disabled={busy === 'propose' || changeTarget.trim().length < 2}
                      >
                        Proposer un changement
                      </Button>
                    </div>
                    <button
                      className="mt-3 text-sm text-muted-foreground underline"
                      onClick={() =>
                        void guard(async () => setView(await exitElective(profileId!)), 'exit')()
                      }
                    >
                      Ça ne me convient vraiment pas — arrêter maintenant (sans pénalité)
                    </button>
                  </>
                )}
              </Card>
            </>
          )}

          {/* ---- Mode découverte en cours ---- */}
          {!e && d && d.status === 'active' && d.currentDiscipline && (
            <Card>
              <CardTitle>
                Semaine {d.currentIndex + 1}/5 · {d.currentDiscipline.label}
              </CardTitle>
              <CardDescription>
                Jour {d.dayInWeek} — explore vraiment (fais des choses), et note ta journée
                ci-dessous.
              </CardDescription>

              {d.journalToday ? (
                <Note className="mt-3">
                  Journal du jour enregistré. Reviens demain, ou passe à la suivante.
                </Note>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={journal.did}
                    onChange={(e2) => setJournal({ ...journal, did: e2.target.value })}
                    rows={2}
                    placeholder="Ce que j'ai fait aujourd'hui…"
                    className="w-full rounded-md border border-border bg-surface p-2 text-sm"
                  />
                  <textarea
                    value={journal.liked}
                    onChange={(e2) => setJournal({ ...journal, liked: e2.target.value })}
                    rows={2}
                    placeholder="Ce que j'ai aimé…"
                    className="w-full rounded-md border border-border bg-surface p-2 text-sm"
                  />
                  <textarea
                    value={journal.disliked}
                    onChange={(e2) => setJournal({ ...journal, disliked: e2.target.value })}
                    rows={2}
                    placeholder="Ce que je n'ai pas aimé…"
                    className="w-full rounded-md border border-border bg-surface p-2 text-sm"
                  />
                  <label className="block text-sm text-muted-foreground">
                    Plaisir / « perdu la notion du temps » : {journal.intensity}/5
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={journal.intensity}
                      onChange={(e2) =>
                        setJournal({ ...journal, intensity: Number(e2.target.value) })
                      }
                      className="mt-1 w-full"
                    />
                  </label>
                  <Button onClick={() => void enregistrerJournal()} disabled={busy === 'journal'}>
                    Enregistrer ma journée
                  </Button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  variant="secondary"
                  onClick={() => void suivante()}
                  disabled={busy === 'next'}
                >
                  {d.currentIndex + 1 >= 5
                    ? 'Terminer la découverte'
                    : 'Passer à la discipline suivante'}
                </Button>
                <Button variant="utility" onClick={() => void choisir(d.currentDiscipline!.label)}>
                  J'ai trouvé : choisir « {d.currentDiscipline.label} »
                </Button>
              </div>
            </Card>
          )}

          {/* ---- Découverte terminée : analyse + propositions ---- */}
          {!e && d && d.status === 'done' && (
            <Card>
              <CardTitle>Découverte terminée</CardTitle>
              <CardDescription>
                Tu peux choisir maintenant, ou demander à l'IA de repérer des pistes dans tes
                journaux.
              </CardDescription>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => void analyser()}
                  disabled={busy === 'analyze'}
                >
                  {busy === 'analyze' ? 'Analyse…' : 'Que disent mes journaux ?'}
                </Button>
              </div>
              {proposals.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {proposals.map((p, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-sm text-muted-foreground">{p.reason}</p>
                      <Button
                        variant="utility"
                        className="mt-2"
                        onClick={() => void choisir(p.label)}
                      >
                        Choisir celle-ci
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ---- Rien encore : choisir directement ou explorer ---- */}
          {!e && !d && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconHeart /> Je sais déjà
                </CardTitle>
                <CardDescription>
                  Choisis directement ta passion (photo, cuisine, esport, dev, foot…).
                </CardDescription>
                <div className="mt-3 space-y-2">
                  <input
                    value={freeLabel}
                    onChange={(ev) => setFreeLabel(ev.target.value)}
                    placeholder="Ma passion…"
                    className="w-full rounded-md border border-border bg-surface p-2 text-sm"
                  />
                  <Button
                    onClick={() => void choisir(freeLabel)}
                    disabled={busy.startsWith('choose') || freeLabel.trim().length < 2}
                  >
                    Choisir cette passion
                  </Button>
                </div>
              </Card>
              <Card>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IconCompass /> Mode découverte
                </CardTitle>
                <CardDescription>
                  Teste 5 disciplines, 1 semaine chacune, avec un journal de bord.
                </CardDescription>
                <div className="mt-3 space-y-2">
                  {discInputs.map((val, i) => (
                    <input
                      key={i}
                      value={val}
                      onChange={(ev) =>
                        setDiscInputs(discInputs.map((x, j) => (j === i ? ev.target.value : x)))
                      }
                      placeholder={`Discipline ${i + 1}`}
                      className="w-full rounded-md border border-border bg-surface p-2 text-sm"
                    />
                  ))}
                  <Button
                    variant="secondary"
                    onClick={() => void lancerDecouverte()}
                    disabled={busy === 'discovery'}
                  >
                    Lancer la découverte
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {err && <Note tone="error">{err}</Note>}
        </>
      )}
    </div>
  );
}
