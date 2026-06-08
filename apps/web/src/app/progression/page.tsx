'use client';

import { useState } from 'react';
import { getProgression, type MasteryRow } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

export default function ProgressionPage() {
  const [profileId, setProfileId] = useState('');
  const [rows, setRows] = useState<MasteryRow[]>([]);
  const [erreur, setErreur] = useState('');
  const [charge, setCharge] = useState(false);
  const [vu, setVu] = useState(false);

  async function charger() {
    setErreur('');
    setCharge(true);
    try {
      setRows(await getProgression(profileId));
      setVu(true);
    } catch (e) {
      setErreur(String(e));
      setRows([]);
    } finally {
      setCharge(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Progression</h1>
        <p className="mt-1 text-muted-foreground">
          La maîtrise par compétence, estimée par BKT. Saisis un identifiant de profil.
        </p>
      </header>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="identifiant de profil (UUID)"
        />
        <Button onClick={charger} disabled={!profileId || charge}>
          {charge ? 'Chargement…' : 'Charger'}
        </Button>
      </div>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}

      {vu && rows.length === 0 && !erreur && (
        <p className="text-sm text-muted-foreground">Aucune maîtrise enregistrée pour ce profil.</p>
      )}

      <div className="grid gap-3">
        {rows.map((r) => (
          <Card key={r.skillId} className="p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-xs">{r.skillId}</CardTitle>
              <span className="text-sm text-muted-foreground">
                {Math.round(r.pMastery * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round(r.pMastery * 100)}%` }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
