'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getNextSkill,
  getProgression,
  observe,
  composeSession,
  ingestSummary,
  generateCourseSheet,
  closeCourse,
  type NextSkillRow,
  type IngestResult,
} from '@/lib/api';
import type { CourseSheet } from '@dowze/schemas';
import { CourseSheetView } from '@/components/course/course-sheet';
import { useProfile } from '@/lib/use-profile';
import { useSessionTimer } from '@/lib/session-timer';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextAreaField } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { Skeleton } from '@/components/ui/skeleton';
import { IconSparkles, IconArrowRight, IconBadgeCheck } from '@/components/ui/icons';

const SEUIL = 95; // seuil de maîtrise (p(L) ≥ 0,95)

export default function SeancePage() {
  const { profileId, ready, signedIn } = useProfile();
  const startTimer = useSessionTimer((s) => s.start);
  const stopTimer = useSessionTimer((s) => s.stop);
  const [skill, setSkill] = useState<NextSkillRow | null>(null);
  const [pct, setPct] = useState(0);
  const [charge, setCharge] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [closing, setClosing] = useState(''); // prompt de bilan (fin de séance)
  const [copie, setCopie] = useState(false);
  const [copieBilan, setCopieBilan] = useState(false);
  const [composing, setComposing] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [tout, setTout] = useState(false); // tout est maîtrisé
  // Résumé de séance : texte libre → le Copilote le structure → maîtrise + carnet.
  const [resume, setResume] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [bilan, setBilan] = useState<IngestResult | null>(null);
  const [bilanErr, setBilanErr] = useState('');
  // Mode AUTO (défaut) : l'IA de Dowze donne le cours en app (feuille A4). MANUEL : l'ancien copier-coller.
  const [mode, setMode] = useState<'auto' | 'manuel'>('auto');
  const [sheet, setSheet] = useState<CourseSheet | null>(null);
  const [genning, setGenning] = useState(false);
  const [genErr, setGenErr] = useState('');
  const [clot, setClot] = useState(false);
  const [fini, setFini] = useState<{ outcome: string; pMastery: number } | null>(null);

  const chargerProchaine = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    setErreur(false);
    setPrompt('');
    setClosing('');
    setResume('');
    setBilan(null);
    setBilanErr('');
    setSheet(null);
    setFini(null);
    setGenErr('');
    try {
      const [next, mastery] = await Promise.all([
        getNextSkill(profileId),
        getProgression(profileId),
      ]);
      if (!next) {
        setTout(true);
        setSkill(null);
      } else {
        setTout(false);
        setSkill(next);
        const m = mastery.find((r) => r.skillId === next.id);
        setPct(Math.round((m?.pMastery ?? 0) * 100));
      }
    } catch {
      setErreur(true);
    } finally {
      setCharge(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) chargerProchaine();
  }, [signedIn, chargerProchaine]);

  // 1 · Composer le prompt lisible du jour (déterministe, gratuit).
  async function composer() {
    if (!profileId) return;
    setErreur(false);
    setComposing(true);
    try {
      const res = await composeSession(profileId);
      setPrompt(res.prompt);
      setClosing(res.closingPrompt);
      // Lance le minuteur de séance (45 min) dès que le prompt est prêt.
      startTimer(45);
    } catch {
      setErreur(true);
    } finally {
      setComposing(false);
    }
  }

  /** Messages d'erreur IA : 402 (crédits) et 503 (modèle) sont différenciés, jamais de fuite technique. */
  function messageErreurIA(e: unknown, fallback: string): string {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('402')) {
      return 'Crédits insuffisants pour ton Copilote. Recharge ton solde ou passe en « ta propre clé » dans les réglages du Copilote.';
    }
    if (msg.includes('503')) {
      return "Le modèle choisi n'est pas disponible pour l'instant. Choisis-en un autre dans les réglages du Copilote.";
    }
    return fallback;
  }

  // AUTO (défaut) · L'IA de Dowze GÉNÈRE le cours (feuille A4, rendue en app) + lance le minuteur.
  async function lancerCours() {
    if (!profileId) return;
    setGenErr('');
    setGenning(true);
    try {
      const res = await generateCourseSheet(profileId);
      if (res) {
        setSheet(res.sheet);
        startTimer(45);
      } else {
        setGenErr('Rien à travailler pour le moment.');
      }
    } catch (e) {
      setGenErr(messageErreurIA(e, 'Impossible de générer le cours. Réessaie, ou passe en mode manuel.'));
    } finally {
      setGenning(false);
    }
  }

  // Clôture du cours natif : l'app a dérivé l'outcome des réponses → Dowze recalcule la maîtrise (BKT+FSRS+carnet).
  // Relance l'erreur : la feuille ne doit se verrouiller qu'après un enregistrement RÉUSSI.
  async function terminerCours(outcome: 'maitrise' | 'progres' | 'bloque', note: string) {
    if (!skill || !profileId) return;
    setClot(true);
    setGenErr('');
    try {
      const res = await closeCourse(profileId, skill.id, outcome, note);
      setPct(Math.round(res.pMastery * 100));
      setFini({ outcome, pMastery: res.pMastery });
      stopTimer();
    } catch (e) {
      setGenErr(messageErreurIA(e, 'La maîtrise n’a pas pu être enregistrée. Réessaie.'));
      throw e;
    } finally {
      setClot(false);
    }
  }

  async function copier() {
    await navigator.clipboard.writeText(prompt);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  }

  async function copierBilan() {
    await navigator.clipboard.writeText(closing);
    setCopieBilan(true);
    setTimeout(() => setCopieBilan(false), 1500);
  }

  // 2 · Enregistrer la séance : le Copilote lit le résumé texte et met à jour la maîtrise.
  async function enregistrer() {
    if (!skill || !profileId || !resume.trim()) return;
    setBilanErr('');
    setBilan(null);
    setIngesting(true);
    try {
      const res = await ingestSummary(profileId, skill.id, resume.trim());
      setBilan(res);
      setPct(Math.round(res.pMastery * 100));
      setResume('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('402')) {
        setBilanErr(
          'Crédits insuffisants pour ton Copilote. Recharge ton solde ou passe en « ta propre clé » dans les réglages du Copilote.',
        );
      } else if (msg.includes('503')) {
        setBilanErr(
          "Le modèle choisi n'est pas disponible pour l'instant. Choisis-en un autre dans les réglages du Copilote.",
        );
      } else {
        setBilanErr("Impossible d'enregistrer ta séance. Réessaie dans un instant.");
      }
    } finally {
      setIngesting(false);
    }
  }

  // Note rapide (repli manuel, sans IA).
  async function pratiquer(reussi: boolean) {
    if (!skill || !profileId) return;
    try {
      const res = await observe(profileId, skill.id, reussi);
      setPct(Math.round(res.pMastery * 100));
    } catch {
      setErreur(true);
    }
  }

  const maitrise = pct >= SEUIL;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma séance"
        action={
          // Masqué pendant un cours en cours : basculer démonterait la feuille → réponses perdues.
          sheet && !fini ? undefined : (
            <button
              onClick={() => setMode((m) => (m === 'auto' ? 'manuel' : 'auto'))}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
            >
              {mode === 'auto' ? 'Mode manuel' : 'Cours Dowze'}
            </button>
          )
        }
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconSparkles />}
          title="Connecte-toi pour démarrer une séance"
          description="On te donne la prochaine compétence à apprendre, à ton niveau."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {charge && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {erreur && (
        <Note tone="error">Impossible de charger ta séance. Réessaie dans un instant.</Note>
      )}

      {signedIn && !charge && tout && (
        <EmptyState
          icon={<IconBadgeCheck />}
          title="Tout est maîtrisé pour l’instant !"
          description="Tu as atteint la frontière de ton parcours actuel. De nouvelles compétences arrivent à mesure que le cursus grandit."
          action={
            <Link href="/resultats">
              <Button variant="secondary">Voir mes résultats</Button>
            </Link>
          }
        />
      )}

      {signedIn && !charge && skill && (
        <>
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-accent">Compétence prescrite</p>
                <CardTitle className="mt-0.5 text-xl">{skill.title}</CardTitle>
              </div>
              {maitrise ? <Badge tone="success">Maîtrisée</Badge> : <Badge>{pct}%</Badge>}
            </div>
            <div>
              <Progress value={pct} label={`Maîtrise de ${skill.title}`} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Maîtrise estimée — atteint {SEUIL}% pour débloquer la suite.
              </p>
            </div>
          </Card>

          {!maitrise ? (
            mode === 'auto' ? (
              // AUTO (défaut) : l'IA de Dowze donne le cours en app (feuille A4 à modules).
              !sheet ? (
                <Card className="space-y-3">
                  <CardTitle>Ton cours du jour</CardTitle>
                  <Button onClick={lancerCours} disabled={genning} className="gap-2">
                    {genning ? 'Dowze prépare ton cours…' : 'Démarrer le cours'}
                    <IconArrowRight />
                  </Button>
                  {genErr && <Note tone="error">{genErr}</Note>}
                </Card>
              ) : (
                <>
                  <CourseSheetView sheet={sheet} onComplete={terminerCours} busy={clot} />
                  {fini && (
                    <>
                      <Note>
                        <span className="font-medium">
                          {fini.outcome === 'maitrise'
                            ? 'Bravo — bien maîtrisé !'
                            : fini.outcome === 'progres'
                              ? 'Beau progrès, on continue.'
                              : 'On y retravaillera, c’est noté.'}
                        </span>{' '}
                        Maîtrise de {skill.title} : {Math.round(fini.pMastery * 100)}%.
                      </Note>
                      <Button
                        onClick={() => {
                          setSheet(null);
                          setFini(null);
                          setGenErr('');
                        }}
                        className="gap-2"
                      >
                        Nouvelle séance
                        <IconArrowRight />
                      </Button>
                    </>
                  )}
                  {genErr && <Note tone="error">{genErr}</Note>}
                </>
              )
            ) : (
            <>
              <Card className="space-y-3">
                <CardTitle>1 · Copie ton prompt dans ton IA</CardTitle>
                <CardDescription>
                  Le Copilote prépare un prompt clair pour cette compétence. Copie-le et colle-le
                  dans ton assistant (ChatGPT, Claude…), puis apprends normalement.
                </CardDescription>
                {!prompt ? (
                  <Button onClick={composer} disabled={composing} className="gap-2">
                    {composing ? 'Préparation…' : 'Composer ma séance'}
                    <IconArrowRight />
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <Button variant="utility" onClick={copier}>
                        {copie ? 'Copié !' : 'Copier'}
                      </Button>
                    </div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                      {prompt}
                    </pre>
                  </div>
                )}
              </Card>

              <Card className="space-y-3">
                <CardTitle>2 · Recolle ton résumé de séance</CardTitle>
                <CardDescription>
                  Quand tu as fini d’apprendre, demande le bilan à ton IA avec le prompt ci-dessous,
                  puis colle sa réponse ici. Le Copilote la comprend, met à jour ta maîtrise et
                  l’ajoute à ton carnet. Aucun format à respecter.
                </CardDescription>

                <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-sm font-medium">
                    a) Demande le bilan à ton IA — copie ceci et colle-le dans ta conversation :
                  </p>
                  {closing ? (
                    <>
                      <div className="flex justify-end">
                        <Button variant="utility" onClick={copierBilan}>
                          {copieBilan ? 'Copié !' : 'Copier le prompt de bilan'}
                        </Button>
                      </div>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-surface p-3 text-sm">
                        {closing}
                      </pre>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={composer} disabled={composing}>
                      {composing ? 'Préparation…' : 'Préparer le prompt de bilan'}
                    </Button>
                  )}
                </div>

                <TextAreaField
                  label="b) Colle ici le résumé que ton IA t’a écrit"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Colle ici le texte du résumé…"
                  className="[&_textarea]:min-h-32"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={enregistrer} disabled={!resume.trim() || ingesting}>
                    {ingesting ? 'Le Copilote lit ton résumé…' : 'Enregistrer ma séance'}
                  </Button>
                  <Link href="/copilote" className="text-xs text-muted-foreground underline">
                    Choisir mon IA / mon solde
                  </Link>
                </div>
                {bilan && (
                  <Note>
                    <span className="font-medium">
                      {bilan.snapshot.outcome === 'maitrise'
                        ? 'Bravo — compétence bien maîtrisée !'
                        : bilan.snapshot.outcome === 'progres'
                          ? 'Beau progrès, on continue.'
                          : 'On y retravaillera, c’est noté.'}
                    </span>{' '}
                    {bilan.snapshot.carnetNote}
                    {bilan.snapshot.nextStep ? ` — Prochaine étape : ${bilan.snapshot.nextStep}` : ''}
                    {bilan.creditsSpent > 0 ? ` (${bilan.creditsSpent} crédit(s) utilisé(s))` : ''}
                  </Note>
                )}
                {bilanErr && <Note tone="error">{bilanErr}</Note>}
              </Card>

              <Card className="space-y-3">
                <CardTitle>Note rapide (sans IA)</CardTitle>
                <CardDescription>
                  Tu t’es entraîné à la main ? Note honnêtement le résultat : ta maîtrise s’ajuste.
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => pratiquer(true)}>
                    J’ai réussi
                  </Button>
                  <Button variant="secondary" onClick={() => pratiquer(false)}>
                    À revoir
                  </Button>
                </div>
              </Card>
            </>
            )
          ) : (
            <Card className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <IconBadgeCheck />
                </div>
                <div>
                  <CardTitle>Compétence maîtrisée !</CardTitle>
                  <CardDescription>La suite de ton parcours est débloquée.</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={chargerProchaine} className="gap-2">
                  Compétence suivante
                  <IconArrowRight />
                </Button>
                <Link href="/validation">
                  <Button variant="secondary">Faire valider (badge)</Button>
                </Link>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
