'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getNextSkill,
  getProgression,
  observe,
  createBridgeRequest,
  importBridgeResponse,
  addCarnetEntry,
  type NextSkillRow,
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
  const [lecon, setLecon] = useState('');
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [tout, setTout] = useState(false); // tout est maîtrisé
  // Bilan de séance (l'IA rend un .json → maîtrise + carnet mis à jour).
  const [rapportAller, setRapportAller] = useState('');
  const [rapportReqId, setRapportReqId] = useState('');
  const [rapportRaw, setRapportRaw] = useState('');
  const [rapportMsg, setRapportMsg] = useState('');
  const [rapportErr, setRapportErr] = useState('');

  const chargerProchaine = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    setErreur(false);
    setLecon('');
    try {
      const [next, mastery] = await Promise.all([
        getNextSkill(profileId),
        getProgression(profileId),
      ]);
      if (!next) {
        setTout(true);
        setSkill(null);
      } else {
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

  async function obtenirLecon() {
    if (!skill) return;
    setErreur(false);
    try {
      const json = await createBridgeRequest({
        operation: 'generer-cours',
        requestId: crypto.randomUUID(),
        seed: skill.slug,
      });
      setLecon(JSON.stringify(json, null, 2));
    } catch {
      setErreur(true);
    }
  }

  async function copier() {
    await navigator.clipboard.writeText(lecon);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  }

  async function pratiquer(reussi: boolean) {
    if (!skill || !profileId) return;
    setErreur(false);
    try {
      const res = await observe(profileId, skill.id, reussi);
      setPct(Math.round(res.pMastery * 100));
    } catch {
      setErreur(true);
    }
  }

  // Génère le `.json` ALLER à faire remplir par l'IA (format du bilan).
  async function genererRapport() {
    if (!skill) return;
    setRapportErr('');
    setRapportMsg('');
    try {
      const id = crypto.randomUUID();
      setRapportReqId(id);
      const json = await createBridgeRequest({
        operation: 'rapport-seance',
        requestId: id,
        seed: skill.slug,
      });
      setRapportAller(JSON.stringify(json, null, 2));
    } catch {
      setRapportErr('Impossible de générer le bilan à demander.');
    }
  }

  // Valide le bilan de l'IA → met à jour la maîtrise (BKT) + ajoute au carnet.
  async function validerRapport() {
    if (!skill || !profileId || !rapportRaw) return;
    setRapportErr('');
    setRapportMsg('');
    try {
      const res = (await importBridgeResponse({
        raw: rapportRaw,
        expectedRequestId: rapportReqId,
        expectedOperation: 'rapport-seance',
      })) as {
        ok: boolean;
        payload?: { report: { outcome: 'reussi' | 'a-revoir'; note: string } };
        errors?: { path: string; message: string }[];
      };
      if (!res.ok || !res.payload) {
        setRapportErr(
          `Bilan refusé : ${(res.errors ?? []).map((e) => e.message).join(', ') || 'format invalide'}`,
        );
        return;
      }
      const { outcome, note } = res.payload.report;
      const obs = await observe(profileId, skill.id, outcome === 'reussi');
      setPct(Math.round(obs.pMastery * 100));
      await addCarnetEntry(profileId, note);
      setRapportMsg('Bilan enregistré : maîtrise mise à jour et note ajoutée à ton carnet ✓');
      setRapportRaw('');
      setRapportAller('');
      setRapportReqId('');
    } catch {
      setRapportErr('Impossible d’enregistrer ton bilan. Réessaie dans un instant.');
    }
  }

  const maitrise = pct >= SEUIL;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma séance"
        subtitle="Ta compétence du moment : apprends-la avec ton IA, puis pratique. Ta maîtrise avance toute seule."
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
                <CardTitle>1 · Apprends avec ton IA</CardTitle>
                <CardDescription>
                  Génère la leçon, colle-la dans ton assistant IA : il devient ton prof et te fait
                  travailler cette compétence.
                </CardDescription>
                {!lecon ? (
                  <Button onClick={obtenirLecon} className="gap-2">
                    Générer ma leçon
                    <IconArrowRight />
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <Button variant="utility" onClick={copier}>
                        {copie ? 'Copié ✓' : 'Copier'}
                      </Button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 text-xs">
                      {lecon}
                    </pre>
                  </div>
                )}
              </Card>

              <Card className="space-y-3">
                <CardTitle>2 · Puis, pratique</CardTitle>
                <CardDescription>
                  Après la leçon, entraîne-toi avec ton IA. Note honnêtement chaque essai : ta
                  maîtrise s’ajuste à chaque fois.
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => pratiquer(true)}>J’ai réussi</Button>
                  <Button variant="secondary" onClick={() => pratiquer(false)}>
                    À revoir
                  </Button>
                </div>
              </Card>

              <Card className="space-y-3">
                <CardTitle>3 · Ou laisse ton IA faire le bilan</CardTitle>
                <CardDescription>
                  Demande à ton IA un bilan de la séance et colle sa réponse ici : ta maîtrise et ton
                  carnet se mettent à jour automatiquement.
                </CardDescription>
                {!rapportAller ? (
                  <Button variant="secondary" onClick={genererRapport}>
                    Générer le bilan à demander à mon IA
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-sm text-muted-foreground">
                        1. Colle ceci à ton IA (à la fin de la séance) :
                      </p>
                      <pre className="max-h-40 overflow-auto rounded-md bg-muted p-4 text-xs">
                        {rapportAller}
                      </pre>
                    </div>
                    <TextAreaField
                      label="2. Colle le bilan (.json) que ton IA te renvoie"
                      value={rapportRaw}
                      onChange={(e) => setRapportRaw(e.target.value)}
                      className="[&_textarea]:font-mono"
                    />
                    <Button onClick={validerRapport} disabled={!rapportRaw}>
                      Valider mon bilan
                    </Button>
                  </div>
                )}
                {rapportMsg && <Note>{rapportMsg}</Note>}
                {rapportErr && <Note tone="error">{rapportErr}</Note>}
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
