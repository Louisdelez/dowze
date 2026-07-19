'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getNextSkill,
  getProgression,
  observe,
  composeSession,
  ingestSummary,
  type NextSkillRow,
  type IngestResult,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
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
  const [skill, setSkill] = useState<NextSkillRow | null>(null);
  const [pct, setPct] = useState(0);
  const [charge, setCharge] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [copie, setCopie] = useState(false);
  const [composing, setComposing] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [tout, setTout] = useState(false); // tout est maîtrisé
  // Résumé de séance : texte libre → le Copilote le structure → maîtrise + carnet.
  const [resume, setResume] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [bilan, setBilan] = useState<IngestResult | null>(null);
  const [bilanErr, setBilanErr] = useState('');

  const chargerProchaine = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    setErreur(false);
    setPrompt('');
    setResume('');
    setBilan(null);
    setBilanErr('');
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
    } catch {
      setErreur(true);
    } finally {
      setComposing(false);
    }
  }

  async function copier() {
    await navigator.clipboard.writeText(prompt);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
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
        subtitle="Copie le prompt du jour dans ton IA, apprends, puis recolle ton résumé : ta progression se met à jour toute seule."
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
          title="Tout est maîtrisé pour l’instant 🎉"
          description="Tu as atteint la frontière de ton parcours actuel. De nouvelles compétences arrivent à mesure que le cursus grandit."
          action={
            <Link href="/progression">
              <Button variant="secondary">Voir ma progression</Button>
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
                        {copie ? 'Copié ✓' : 'Copier'}
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
                  À la fin, ton IA t’écrit un court résumé. Colle-le ici : le Copilote le comprend,
                  met à jour ta maîtrise et l’ajoute à ton carnet. Aucun format à respecter.
                </CardDescription>
                <TextAreaField
                  label="Le résumé de séance que ton IA t’a écrit"
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
