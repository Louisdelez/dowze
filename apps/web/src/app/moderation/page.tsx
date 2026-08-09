'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AssignResult, ModeratorQueue } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import {
  assignClasses,
  decideReset,
  getModeratorQueue,
  resolveAiFlag,
  resolveReport,
} from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Note } from '@/components/ui/note';
import { EmptyState } from '@/components/ui/empty-state';

export default function ModerationPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [queue, setQueue] = useState<ModeratorQueue | null>(null);

  const charger = useCallback(async () => {
    if (!profileId) return;
    setQueue(await getModeratorQueue(profileId));
  }, [profileId]);

  useEffect(() => {
    if (signedIn) void charger();
  }, [signedIn, charger]);

  if (!ready) return null;
  if (!signedIn) {
    return (
      <EmptyState
        title="Espace modération"
        description="Réservé aux modérateurs."
        action={
          <Link href="/connexion" className="text-accent underline-offset-2 hover:underline">
            Se connecter
          </Link>
        }
      />
    );
  }

  if (queue && !queue.isModerator) {
    return <Note tone="info">Cet espace est réservé aux modérateurs.</Note>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace modération"
        subtitle="Signalements et demandes de remise à 0. Accès contextuel (fenêtre de la conversation signalée), décision humaine."
      />

      <AssignClasses profileId={profileId!} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Signalements de l’IA de modération</h2>
        <p className="text-sm text-muted-foreground">
          L’IA détecte et signale (elle ne bannit jamais). Le parent est alerté en même temps.
        </p>
        {!queue || queue.aiFlags.length === 0 ? (
          <CardDescription>Aucun signalement automatique.</CardDescription>
        ) : (
          queue.aiFlags.map((f) => (
            <Card key={f.id} className="space-y-2 border-red-200 bg-red-50/50">
              <CardTitle>
                {f.authorName} · {f.category} ({f.severity})
              </CardTitle>
              <CardDescription>{f.reason}</CardDescription>
              <p className="rounded-lg border border-border bg-background p-2 text-xs">
                « {f.messageBody} »
              </p>
              <div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await resolveAiFlag(profileId!, f.id);
                    charger();
                  }}
                >
                  Marquer traité
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Signalements</h2>
        {!queue || queue.reports.length === 0 ? (
          <CardDescription>Aucun signalement en attente.</CardDescription>
        ) : (
          queue.reports.map((r) => (
            <Card key={r.id} className="space-y-2">
              <CardTitle>
                {r.reporterName} signale {r.reportedName}
              </CardTitle>
              <CardDescription>« {r.reason} »</CardDescription>
              {r.context.length > 0 && (
                <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-2 text-xs">
                  <p className="font-medium text-muted-foreground">
                    Contexte (derniers messages) :
                  </p>
                  {r.context.map((m) => (
                    <p key={m.id}>
                      <span className="font-medium">{m.senderName} :</span>{' '}
                      {m.status === 'anonymized' ? <em>(message supprimé)</em> : m.body}
                    </p>
                  ))}
                </div>
              )}
              <div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await resolveReport(profileId!, r.id);
                    charger();
                  }}
                >
                  Marquer traité
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Demandes de remise à 0</h2>
        {!queue || queue.resetRequests.length === 0 ? (
          <CardDescription>Aucune demande en attente.</CardDescription>
        ) : (
          queue.resetRequests.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{r.childName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.scope === 'account' ? 'Suppression de compte' : 'Messages + amis'} · demandé
                  par {r.requestedBy === 'parent' ? 'le responsable' : 'l’élève'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    await decideReset(profileId!, r.id, true);
                    charger();
                  }}
                >
                  Valider
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await decideReset(profileId!, r.id, false);
                    charger();
                  }}
                >
                  Refuser
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

function AssignClasses({ profileId }: { profileId: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AssignResult | null>(null);

  async function lancer() {
    if (
      !confirm(
        '(Ré)assigner toutes les classes de l’année ? Les classes existantes seront recomposées.',
      )
    )
      return;
    setBusy(true);
    try {
      setRes(await assignClasses(profileId, 2026));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-2 border-accent/30 bg-accent/5">
      <CardTitle>Assignation des classes (année 2026)</CardTitle>
      <CardDescription>
        Forme les classes automatiquement : niveau (jamais mélangé) &gt; langue &gt; âge (l’âge
        n’exclut jamais). Cible 20, min 12, max 25 ; fusion multilingue si trop peu de monde dans
        une langue.
      </CardDescription>
      <div>
        <Button onClick={lancer} disabled={busy}>
          {busy ? 'Assignation…' : 'Lancer l’assignation'}
        </Button>
      </div>
      {res && (
        <div className="space-y-1 rounded-lg border border-border bg-background p-2 text-xs">
          <p className="font-medium">
            {res.created} classe(s) pour {res.totalLearners} apprenant(s) :
          </p>
          {res.classes.map((c, i) => (
            <p key={i}>
              {c.name} — {c.size} membre(s) ({c.reason}){c.isMultilingual ? ' · multilingue' : ''}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
