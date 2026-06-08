'use client';

import { useState } from 'react';
import { getParentalSummary, type ParentalSummaryRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export default function ParentPage() {
  const [accountId, setAccountId] = useState('');
  const [summary, setSummary] = useState<ParentalSummaryRow | null>(null);
  const [erreur, setErreur] = useState('');

  async function charger() {
    setErreur('');
    try {
      setSummary(await getParentalSummary(accountId));
    } catch (e) {
      setErreur(String(e));
      setSummary(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Espace responsable</h1>
        <p className="mt-1 text-muted-foreground">
          Un suivi bienveillant (façon Pronote) : une <strong>synthèse</strong> de la progression — jamais
          le contenu privé des échanges.
        </p>
      </header>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="identifiant du compte de l’élève (UUID)"
        />
        <Button onClick={charger} disabled={!accountId}>
          Voir la synthèse
        </Button>
      </div>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardTitle>{summary.masteredCount}</CardTitle>
            <CardDescription>compétences maîtrisées</CardDescription>
          </Card>
          <Card>
            <CardTitle>{summary.inProgressCount}</CardTitle>
            <CardDescription>en cours d’acquisition</CardDescription>
          </Card>
          <Card>
            <CardTitle>{summary.planningCount}</CardTitle>
            <CardDescription>séances planifiées</CardDescription>
          </Card>
        </div>
      )}
    </div>
  );
}
