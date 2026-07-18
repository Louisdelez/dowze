'use client';

import { useEffect, useState } from 'react';
import { getParentalSummary, type ParentalSummaryRow } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardDescription } from '@/components/ui/card';
import { TextField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { Note } from '@/components/ui/note';

export default function ParentPage() {
  const { accountId, ready } = useProfile();
  const [code, setCode] = useState('');
  const [summary, setSummary] = useState<ParentalSummaryRow | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Pré-remplit avec le compte connecté (cas « je suis moi-même l'élève »).
  useEffect(() => {
    if (ready && accountId) setCode(accountId);
  }, [ready, accountId]);

  async function charger() {
    if (!code) return;
    setCharge(true);
    setErreur(false);
    try {
      setSummary(await getParentalSummary(code));
    } catch {
      setErreur(true);
      setSummary(null);
    } finally {
      setCharge(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace responsable"
        subtitle="Un suivi bienveillant : une synthèse de la progression — jamais le contenu privé des échanges."
      />

      <Card className="space-y-3">
        <TextField
          label="Code de l’élève"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint="Communiqué par l’élève depuis son profil. Pré-rempli si tu es toi-même connecté·e."
          placeholder="code élève"
        />
        <Button onClick={charger} disabled={!code || charge}>
          {charge ? 'Chargement…' : 'Voir la synthèse'}
        </Button>
      </Card>

      {erreur && (
        <Note tone="error">
          Aucune synthèse trouvée pour ce code. Vérifie-le auprès de l’élève.
        </Note>
      )}

      {summary && (
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard value={summary.masteredCount} label="compétences maîtrisées" />
          <StatCard value={summary.inProgressCount} label="en cours d’acquisition" />
          <StatCard value={summary.planningCount} label="séances planifiées" />
        </section>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <CardDescription>{label}</CardDescription>
    </Card>
  );
}
