'use client';

import { useState } from 'react';
import { generatePlanning, type PlanningEntryRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Minuteur } from '@/components/minuteur';

/** Lundi 00:00 UTC de la semaine courante (calcul côté client). */
function mondayThisWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function PlanningPage() {
  const [profileId, setProfileId] = useState('');
  const [entries, setEntries] = useState<PlanningEntryRow[]>([]);
  const [erreur, setErreur] = useState('');
  const [charge, setCharge] = useState(false);
  const [vu, setVu] = useState(false);

  async function generer() {
    setErreur('');
    setCharge(true);
    try {
      const res = await generatePlanning(profileId, mondayThisWeekIso());
      setEntries(res.entries);
      setVu(true);
    } catch (e) {
      setErreur(String(e));
      setEntries([]);
    } finally {
      setCharge(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Planning de la semaine</h1>
        <p className="mt-1 text-muted-foreground">
          Généré pour toi : révisions dues d’abord, puis la prochaine compétence prescrite. Sans pression.
        </p>
      </header>

      <Minuteur />

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="identifiant de profil (UUID)"
        />
        <Button onClick={generer} disabled={!profileId || charge}>
          {charge ? 'Génération…' : 'Générer la semaine'}
        </Button>
      </div>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}

      {vu && entries.length === 0 && !erreur && (
        <p className="text-sm text-muted-foreground">
          Rien à planifier (ni révision due, ni créneau disponible).
        </p>
      )}

      {entries.length > 0 && (
        <Card className="divide-y divide-border p-0">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-4 px-6 py-3">
              <span className="w-40 text-sm tabular-nums text-muted-foreground">
                {new Date(e.dateIso).toLocaleString('fr-CH')}
              </span>
              <span className="flex-1 text-sm">{e.skillId ?? '—'}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {e.kind} · {e.durationMin} min
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
