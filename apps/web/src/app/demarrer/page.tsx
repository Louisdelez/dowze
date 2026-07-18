'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSkills, runDiagnostic, type SkillRow, type PlacementResult } from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { IconSparkles, IconArrowRight } from '@/components/ui/icons';

export default function DemarrerPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    getSkills()
      .then((all) => setSkills(all.filter((s) => s.isRoot)))
      .catch(() => setErreur(true));
  }, [signedIn]);

  async function diagnostiquer() {
    if (!profileId) return;
    setErreur(false);
    try {
      const demonstrated = skills.filter((s) => checked[s.id]).map((s) => s.id);
      setPlacement(await runDiagnostic(profileId, demonstrated));
    } catch {
      setErreur(true);
    }
  }

  const entrySkill = placement ? skills.find((s) => s.id === placement.entrySkillId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faisons le point"
        subtitle="Un court diagnostic te place sur le parcours. Tu ne choisis pas le programme : l’IA prescrit la suite. Indique simplement ce que tu sais déjà faire."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconSparkles />}
          title="Crée ton compte pour démarrer"
          description="Le diagnostic a besoin de ton profil pour placer l’élève sur le Cursus."
          action={
            <Link href="/inscription">
              <Button>Créer mon compte</Button>
            </Link>
          }
        />
      )}

      {erreur && <Note tone="error">Une action n’a pas abouti. Réessaie dans un instant.</Note>}

      {signedIn && skills.length > 0 && !placement && (
        <Card className="space-y-3">
          <CardTitle>Que sais-tu déjà faire ?</CardTitle>
          <CardDescription>Coche ce qui est acquis. Dans le doute, laisse décoché.</CardDescription>
          <div className="space-y-2 pt-1">
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
          </div>
          <Button onClick={diagnostiquer} className="gap-2">
            Voir mon placement
            <IconArrowRight />
          </Button>
        </Card>
      )}

      {placement && (
        <Card className="space-y-2">
          <CardTitle>Ton point de départ</CardTitle>
          <CardDescription>
            {placement.masteredSkillIds.length} compétence(s) déjà acquise(s). Prochaine étape :{' '}
            <strong className="text-foreground">{entrySkill?.title ?? 'à déterminer'}</strong>.
          </CardDescription>
          <div className="pt-2">
            <Link href="/dashboard">
              <Button className="gap-2">
                Commencer
                <IconArrowRight />
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
