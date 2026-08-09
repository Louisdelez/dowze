'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GuardianControls, ResultsView } from '@dowze/schemas';
import {
  confirmChildAccount,
  consentRankJump,
  decideChildReset,
  decideSupervision,
  getChildRankJump,
  getChildResults,
  getGuardianControls,
  getMyChildren,
  parentReset,
  parentVoteRank,
  setSupervised,
  type ChildLink,
} from '@/lib/api';
import type { RankChoice, RankJumpView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { Note } from '@/components/ui/note';
import { ResultsBoard } from '@/components/results/results-board';

export default function ParentPage() {
  const { accountId, ready } = useProfile();
  const [code, setCode] = useState('');
  const [data, setData] = useState<ResultsView | null>(null);
  const [jump, setJump] = useState<RankJumpView | null>(null);
  const [controls, setControls] = useState<GuardianControls | null>(null);
  const [children, setChildren] = useState<ChildLink[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Enfants liés automatiquement à ce compte parent (auto-liaison à l'inscription).
  const chargerEnfants = useCallback(async () => {
    try {
      setChildren(await getMyChildren());
    } catch {
      setChildren([]);
    }
  }, []);

  const chargerControls = useCallback(async (childCode: string) => {
    try {
      setControls(await getGuardianControls(childCode));
    } catch {
      setControls(null);
    }
  }, []);

  // Pré-remplit avec le compte connecté (cas « je suis moi-même l'élève »).
  useEffect(() => {
    if (ready && accountId) {
      setCode(accountId);
      void chargerEnfants();
    }
  }, [ready, accountId, chargerEnfants]);

  async function ouvrirEnfant(childAccountId: string) {
    setCode(childAccountId);
    setCharge(true);
    setErreur(false);
    try {
      setData(await getChildResults(childAccountId));
      try {
        setJump(await getChildRankJump(childAccountId));
      } catch {
        setJump(null);
      }
      await chargerControls(childAccountId);
    } catch {
      setErreur(true);
    } finally {
      setCharge(false);
    }
  }

  async function confirmer(childAccountId: string) {
    await confirmChildAccount(childAccountId);
    await chargerEnfants();
  }

  async function charger() {
    if (!code) return;
    setCharge(true);
    setErreur(false);
    try {
      setData(await getChildResults(code.trim()));
      try {
        setJump(await getChildRankJump(code.trim()));
      } catch {
        setJump(null);
      }
      await chargerControls(code.trim());
    } catch {
      setErreur(true);
      setData(null);
    } finally {
      setCharge(false);
    }
  }

  async function onVote(choice: RankChoice) {
    if (!code) return;
    setData(await parentVoteRank(code.trim(), choice));
  }

  async function onConsent() {
    if (!code) return;
    setJump(await consentRankJump(code.trim()));
  }

  const prenom = data?.displayName ?? 'votre enfant';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace responsable"
        subtitle="Un suivi bienveillant de la progression — jamais une note, un classement, ni le contenu privé des échanges."
      />

      {/* Enfants liés automatiquement (l'enfant a indiqué votre e-mail à l'inscription). */}
      {children.length > 0 && (
        <Card className="space-y-3">
          <CardTitle>Mes enfants</CardTitle>
          {children.map((c) => (
            <div key={c.childAccountId} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div>
                <p className="font-medium">{c.name}</p>
                {c.needsParentConfirmation && (
                  <p className="text-xs text-amber-700">Compte en attente de votre validation (moins de 13 ans).</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {c.needsParentConfirmation && (
                  <Button onClick={() => confirmer(c.childAccountId)}>Valider le compte</Button>
                )}
                <Button variant="secondary" onClick={() => ouvrirEnfant(c.childAccountId)}>Voir le suivi</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Card className="space-y-3">
        <TextField
          label="Code de suivi de l’élève"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint="Sinon, entrez le code que l’élève vous communique depuis son profil."
          placeholder="code élève"
        />
        <Button onClick={charger} disabled={!code || charge}>
          {charge ? 'Chargement…' : 'Voir le suivi'}
        </Button>
      </Card>

      {erreur && (
        <Note tone="error">Aucun suivi trouvé pour ce code. Vérifiez-le auprès de l’élève.</Note>
      )}

      {data && (
        <>
          {/* Synthèse en une phrase — ce que les parents veulent vraiment savoir. */}
          <Card className="space-y-1">
            <CardTitle>Où en est {prenom} ?</CardTitle>
            <CardDescription>
              {prenom} maîtrise déjà <strong>{data.masteredCount}</strong> compétence(s) et en travaille{' '}
              <strong>{data.inProgressCount}</strong>.
              {data.strengths[0] && <> Point fort du moment : <strong>{data.strengths[0]}</strong>.</>}
              {data.nextStep && <> Prochaine étape : <strong>{data.nextStep.title}</strong>.</>}
            </CardDescription>
          </Card>

          {/* Contrôles parentaux : mode supervisé, file de validation, remise à 0. */}
          {controls && (
            <ParentalControls
              controls={controls}
              onChange={() => chargerControls(code.trim())}
              childName={prenom}
            />
          )}

          {/* Saut de Rang en attente de confirmation du responsable. */}
          {jump?.active?.status === 'pending-consent' && (
            <Card className="space-y-2 border-amber-300 bg-amber-50">
              <CardTitle>{prenom} souhaite tenter un Saut de Rang</CardTitle>
              <CardDescription>
                Un mois intensif pour monter à <strong>{jump.active.targetRankName}</strong>. C’est exigeant
                (80 % requis), mais sans risque : en cas d’échec, {prenom} reprend son rang sans pénalité. À vous
                de confirmer si le moment vous semble bon — parlez-en ensemble.
              </CardDescription>
              <div>
                <Button onClick={onConsent}>Confirmer le démarrage</Button>
              </div>
            </Card>
          )}

          {/* Le bulletin (mêmes descripteurs que l'élève). */}
          <ResultsBoard data={data} variant="parent" onVote={onVote} />

          {/* Conseil : orienter vers le dialogue, pas la surveillance. */}
          <Card className="space-y-1 border-accent/30 bg-accent/5">
            <CardTitle>Comment l’aider (le plus efficace)</CardTitle>
            <CardDescription>
              Ce qui aide le plus un enfant, ce n’est pas de vérifier ses notes, mais de s’intéresser et
              d’encourager.{' '}
              {data.nextStep
                ? `Demandez-lui de vous expliquer « ${data.nextStep.title} » avec ses mots — expliquer, c’est consolider.`
                : 'Demandez-lui de vous raconter ce dont il/elle est le/la plus fier·e cette semaine.'}
            </CardDescription>
          </Card>

          {/* Énoncé de finalité — désamorce l'attente d'une note (recommandation Guskey). */}
          <Note tone="info">
            Pourquoi pas de notes ni de moyenne ? Parce que la recherche est claire : une note chiffrée
            détourne de l’apprentissage et compare les enfants entre eux. Ici on montre la{' '}
            <strong>maîtrise</strong> (Découverte → En cours → Consolidé → <strong>Maîtrisé</strong>, la cible
            normale) et la <strong>progression</strong> — pour encourager, pas juger.
          </Note>
        </>
      )}
    </div>
  );
}

function ParentalControls({
  controls,
  onChange,
  childName,
}: {
  controls: GuardianControls;
  onChange: () => void;
  childName: string;
}) {
  const acc = controls.childAccountId;
  const [busy, setBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function toggleSupervise(on: boolean) {
    setBusy(true);
    try {
      await setSupervised(acc, on);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function demanderReset(scope: 'messages' | 'account') {
    const label = scope === 'account' ? 'SUPPRIMER le compte' : 'remettre à 0 les messages et amis';
    if (!confirm(`Demander à ${label} de ${childName} ? Un modérateur devra valider.`)) return;
    await parentReset(acc, scope);
    setResetDone(true);
  }

  return (
    <>
      {/* Alertes de l'IA de modération — immédiates. */}
      {controls.aiAlerts.length > 0 && (
        <Card className="space-y-2 border-red-300 bg-red-50">
          <CardTitle>Alertes de sécurité ({controls.aiAlerts.length})</CardTitle>
          <CardDescription>
            L’IA de modération de Dowze a détecté quelque chose dans les échanges de {childName}. La
            modération a été alertée en même temps que vous.
          </CardDescription>
          {controls.aiAlerts.slice(0, 8).map((a) => (
            <p key={a.id} className="rounded-lg border border-red-200 bg-white p-2 text-sm">
              <span className="font-medium uppercase text-red-700">{a.severity}</span> — {a.reason}
            </p>
          ))}
        </Card>
      )}

      {/* Mode supervisé — case simple. */}
      <Card className="space-y-3 border-accent/30 bg-accent/5">
        <CardTitle>Protection : tout valider avant l’enfant</CardTitle>
        <CardDescription>
          Quand c’est activé, <strong>chaque message et chaque demande d’ami</strong> — reçu ou envoyé, en
          privé, en groupe ou en classe — passe <strong>d’abord par vous</strong>. Rien n’est visible par
          {' '}{childName} tant que vous n’avez pas validé, et rien ne part tant que vous n’avez pas approuvé.
          C’est une mesure forte, utile pour rassurer ou protéger un enfant plus sensible.
        </CardDescription>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={controls.supervised}
            disabled={busy}
            onChange={(e) => toggleSupervise(e.target.checked)}
          />
          <span className="text-sm font-medium">
            {controls.supervised ? 'Activé — je valide tout' : 'Activer la validation de chaque message et ami'}
          </span>
        </label>
      </Card>

      {/* File de validation (mode supervisé). */}
      {controls.supervised && (
        <Card className="space-y-3">
          <CardTitle>À valider ({controls.queue.length})</CardTitle>
          {controls.queue.length === 0 ? (
            <CardDescription>Rien à valider pour l’instant.</CardDescription>
          ) : (
            controls.queue.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {it.kind === 'friend_request' ? 'Demande d’ami' : 'Message'} ·{' '}
                    {it.direction === 'in' ? `de ${it.otherName}` : `vers ${it.otherName}`}
                  </p>
                  <p className="truncate font-medium">{it.preview}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={async () => { await decideSupervision(acc, it.id, true); onChange(); }}>Autoriser</Button>
                  <Button variant="secondary" onClick={async () => { await decideSupervision(acc, it.id, false); onChange(); }}>Refuser</Button>
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* Demandes de remise à 0 émises par l'enfant, en attente de l'accord du parent. */}
      {controls.pendingChildResets.length > 0 && (
        <Card className="space-y-3 border-amber-300 bg-amber-50">
          <CardTitle>{childName} demande une remise à 0</CardTitle>
          <CardDescription>
            Si vous approuvez, la demande partira à un modérateur pour validation finale.
          </CardDescription>
          {controls.pendingChildResets.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{r.scope === 'account' ? 'Suppression de compte' : 'Messages + amis'}</span>
              <div className="flex gap-2">
                <Button onClick={async () => { await decideChildReset(acc, r.id, true); onChange(); }}>Approuver</Button>
                <Button variant="secondary" onClick={async () => { await decideChildReset(acc, r.id, false); onChange(); }}>Refuser</Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Le parent demande lui-même une remise à 0 / suppression. */}
      <Card className="space-y-2 border-amber-300 bg-amber-50/50">
        <CardTitle>Remise à 0 / suppression</CardTitle>
        <CardDescription>
          Vous pouvez demander d’effacer <strong>tous les messages et amis</strong> de {childName} (compte
          conservé), ou la <strong>suppression du compte</strong>. Dans les deux cas, un <strong>modérateur
          valide</strong> avant exécution (pour éviter d’effacer des preuves en cas de harcèlement).
        </CardDescription>
        {resetDone ? (
          <Note tone="info">Demande envoyée à un modérateur.</Note>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => demanderReset('messages')}>Remise à 0 (messages + amis)</Button>
            <Button variant="secondary" onClick={() => demanderReset('account')}>Supprimer le compte</Button>
          </div>
        )}
      </Card>
    </>
  );
}
