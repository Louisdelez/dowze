'use client';

import { useEffect, useMemo, useState } from 'react';
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
      // Toutes les compétences, du plus fondamental au plus avancé : déclarer une
      // compétence avancée place l'élève haut (la clôture valide toute sa base).
      .then((all) =>
        setSkills([...all].sort((a, b) => a.depth - b.depth || a.title.localeCompare(b.title))),
      )
      .catch(() => setErreur(true));
  }, [signedIn]);

  // Regroupe par niveau (profondeur) pour ne pas noyer l'utilisateur.
  const niveaux = useMemo(() => {
    const m = new Map<number, SkillRow[]>();
    for (const s of skills) {
      const arr = m.get(s.depth) ?? [];
      arr.push(s);
      m.set(s.depth, arr);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [skills]);

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
        subtitle="On adapte à ton niveau — aucune mauvaise réponse. Coche ce que tu sais déjà faire, même des choses avancées : on validera tout ce qui vient en dessous, tu ne le referas pas."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconSparkles />}
          title="Crée ton compte pour démarrer"
          description="Le diagnostic a besoin de ton profil pour te placer sur le parcours."
          action={
            <Link href="/inscription">
              <Button>Créer mon compte</Button>
            </Link>
          }
        />
      )}

      {erreur && <Note tone="error">Une action n’a pas abouti. Réessaie dans un instant.</Note>}

      {signedIn && skills.length > 0 && !placement && (
        <Card className="space-y-4">
          <div>
            <CardTitle>Que sais-tu déjà faire ?</CardTitle>
            <CardDescription>
              Coche ce qui est acquis, du plus simple au plus avancé. Dans le doute, laisse décoché.
            </CardDescription>
          </div>

          {niveaux.map(([depth, items]) => (
            <div key={depth} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Niveau {depth + 1}
              </p>
              {items.map((s) => (
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
          ))}

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
            {placement.masteredSkillIds.length} compétence(s) déjà acquise(s) — tu ne les referas
            pas. Prochaine étape :{' '}
            <strong className="text-foreground">{entrySkill?.title ?? 'à déterminer'}</strong>.
          </CardDescription>
          <div className="pt-2">
            <Link href="/seance">
              <Button className="gap-2">
                Commencer ma séance
                <IconArrowRight />
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
