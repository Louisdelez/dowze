'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSkills, runDiagnostic, type SkillRow, type PlacementResult } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export default function DemarrerPage() {
  const sessionProfileId = useSession((s) => s.profileId);
  const [profileId, setProfileId] = useState('');
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (sessionProfileId) setProfileId(sessionProfileId);
  }, [sessionProfileId]);

  async function charger() {
    setErreur('');
    try {
      const all = await getSkills();
      // Pour le diagnostic, on présente les compétences fondamentales (racines).
      setSkills(all.filter((s) => s.isRoot));
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function diagnostiquer() {
    setErreur('');
    try {
      const demonstrated = skills.filter((s) => checked[s.id]).map((s) => s.id);
      setPlacement(await runDiagnostic(profileId, demonstrated));
    } catch (e) {
      setErreur(String(e));
    }
  }

  const entrySkill = placement
    ? skills.find((s) => s.id === placement.entrySkillId)
    : undefined;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Je m’inscris, je fais quoi ?</h1>
        <p className="mt-1 text-muted-foreground">
          Un court diagnostic place l’élève sur le Cursus. Tu ne choisis pas le programme : l’IA prescrit
          la suite. Indique ce que tu maîtrises déjà.
        </p>
      </header>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="ton identifiant de profil (rempli si connecté)"
        />
        <Button onClick={charger}>Charger le diagnostic</Button>
      </div>

      {skills.length > 0 && (
        <Card className="space-y-3">
          <CardTitle>Que sais-tu déjà faire ?</CardTitle>
          {skills.map((s) => (
            <label key={s.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={checked[s.id] ?? false}
                onChange={(e) => setChecked((c) => ({ ...c, [s.id]: e.target.checked }))}
              />
              {s.title}
            </label>
          ))}
          <Button onClick={diagnostiquer} disabled={!profileId}>
            Voir mon placement
          </Button>
        </Card>
      )}

      {placement && (
        <Card>
          <CardTitle>Ton point de départ</CardTitle>
          <CardDescription>
            {placement.masteredSkillIds.length} compétence(s) déjà acquise(s). Prochaine étape :{' '}
            <strong>{entrySkill?.title ?? 'à déterminer'}</strong>.
          </CardDescription>
          <div className="mt-3">
            <Link href="/dashboard">
              <Button>Commencer</Button>
            </Link>
          </div>
        </Card>
      )}

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}
    </div>
  );
}
