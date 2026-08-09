'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ExpeditionProposal, LearnerExpedition, PhaseGuidance } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  advanceGuidedExpedition,
  chooseExpedition,
  expeditionPhaseGuide,
  myExpeditions,
  proposeExpeditions,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextAreaField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

const PHASES = [
  { key: 'etincelle', label: 'Étincelle' },
  { key: 'question', label: 'Question' },
  { key: 'defi', label: 'Défi' },
  { key: 'acte', label: 'Acte' },
  { key: 'trace', label: 'Trace' },
];

export default function ExpeditionsPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [mine, setMine] = useState<LearnerExpedition[] | null>(null);
  const [proposals, setProposals] = useState<ExpeditionProposal[] | null>(null);
  const [active, setActive] = useState<LearnerExpedition | null>(null);
  const [guidance, setGuidance] = useState<PhaseGuidance | null>(null);
  const [bilan, setBilan] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    if (!profileId) return;
    try {
      const list = await myExpeditions(profileId);
      setMine(list);
      const encours = list.find((x) => x.status !== 'terminee');
      if (encours) setActive(encours);
    } catch (e) {
      setErreur(lisible(e));
      setMine([]);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  async function proposer() {
    if (!profileId) return;
    setEnCours(true);
    setErreur('');
    try {
      const res = await proposeExpeditions(profileId);
      setProposals(res.propositions);
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  async function choisir(p: ExpeditionProposal) {
    if (!profileId) return;
    setEnCours(true);
    setErreur('');
    try {
      const exp = await chooseExpedition(profileId, p);
      setProposals(null);
      setActive(exp);
      setGuidance(null);
      await charger();
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  async function guider() {
    if (!active) return;
    setEnCours(true);
    setErreur('');
    try {
      const res = await expeditionPhaseGuide(active.id);
      setGuidance(res.guidance);
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  async function avancer() {
    if (!active) return;
    setEnCours(true);
    setErreur('');
    try {
      const updated = await advanceGuidedExpedition(active.id, bilan.trim() || undefined);
      setActive(updated.status === 'terminee' ? null : updated);
      setGuidance(null);
      setBilan('');
      await charger();
    } catch (e) {
      setErreur(lisible(e));
    } finally {
      setEnCours(false);
    }
  }

  async function copier() {
    if (!guidance) return;
    await navigator.clipboard.writeText(guidance.prompt);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  }

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Connecte-toi"
        description="Les expéditions sont personnelles."
        action={<Link href="/connexion" className="text-accent underline-offset-2 hover:underline">Se connecter</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expéditions"
        subtitle="Un projet réel autour d'une grande question : Étincelle → Question → Défi → Acte → Trace. Dowze te guide à chaque étape."
      />

      {erreur && <Note tone="error">{erreur}</Note>}

      {/* Expédition en cours : parcours par phases. */}
      {active && (
        <Card className="space-y-4">
          <div>
            <CardTitle>{active.title}</CardTitle>
            <CardDescription>{active.grandeQuestion}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PHASES.map((p) => (
              <span
                key={p.key}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  p.key === active.phase ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {p.label}
              </span>
            ))}
          </div>

          {!guidance ? (
            <Button onClick={guider} disabled={enCours}>
              {enCours ? 'Dowze prépare…' : 'Obtenir le guidage de cette phase'}
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">{guidance.explication}</p>
              <div className="space-y-2">
                <p className="text-sm font-medium">Le prompt à coller dans ton IA</p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-sm">
                  {guidance.prompt}
                </pre>
                <Button variant="secondary" onClick={copier}>
                  {copie ? 'Copié !' : 'Copier le prompt'}
                </Button>
              </div>
              {guidance.pistes.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium">Pistes de départ</p>
                  <ul className="list-inside list-disc text-sm text-muted-foreground">
                    {guidance.pistes.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <TextAreaField
                label="Ton bilan de cette phase (pour reprendre plus tard)"
                value={bilan}
                onChange={(e) => setBilan(e.target.value)}
                placeholder="Ce que j'ai fait, appris, où je bloque, ma prochaine étape…"
              />
              <Button onClick={avancer} disabled={enCours}>
                {active.phase === 'trace' ? 'Terminer l’expédition' : 'Passer à la phase suivante'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Propositions (3 au choix). */}
      {!active && proposals && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Choisis l'expédition qui t'attire le plus :</p>
          {proposals.map((p, i) => (
            <Card key={i} className="space-y-2">
              <CardTitle>{p.titre}</CardTitle>
              <CardDescription>{p.grandeQuestion}</CardDescription>
              <p className="text-sm"><strong>Tu produiras :</strong> {p.produit}</p>
              <p className="text-sm text-muted-foreground"><strong>Tu apprendras :</strong> {p.apprentissage}</p>
              <Button onClick={() => choisir(p)} disabled={enCours}>
                Choisir celle-ci
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Rien en cours, pas encore de propositions. */}
      {!active && !proposals && (
        <>
          {mine === null && <SkeletonCards count={2} />}
          {mine !== null && (
            <Card className="space-y-3">
              <CardTitle>Prêt·e pour une nouvelle expédition ?</CardTitle>
              <CardDescription>
                Dowze te propose 3 expéditions taillées pour toi. Tu en choisis une, puis on avance ensemble,
                phase par phase.
              </CardDescription>
              <Button onClick={proposer} disabled={enCours}>
                {enCours ? 'Dowze réfléchit…' : 'Proposer 3 expéditions'}
              </Button>
            </Card>
          )}
          {mine && mine.filter((x) => x.status === 'terminee').length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Tes expéditions terminées</p>
              {mine
                .filter((x) => x.status === 'terminee')
                .map((x) => (
                  <Card key={x.id}>
                    <CardTitle>{x.title}</CardTitle>
                    <CardDescription>{x.grandeQuestion}</CardDescription>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function lisible(e: unknown): string {
  const msg = String(e instanceof Error ? e.message : e);
  if (msg.includes('402')) return 'Il faut des crédits (ou ta propre clé) pour que Dowze propose des expéditions. Va dans « Mon Copilote ».';
  if (msg.includes('503')) return "Le modèle n'a pas répondu. Réessaie, ou choisis un autre modèle dans « Mon Copilote ».";
  return msg;
}
