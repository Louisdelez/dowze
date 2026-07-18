'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getRubric,
  getSkills,
  selfValidate,
  type RubricRow,
  type RubricCriterionRow,
  type SkillRow,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { SelectField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Note } from '@/components/ui/note';
import { IconBadgeCheck } from '@/components/ui/icons';

export default function ValidationPage() {
  const { profileId, ready, signedIn } = useProfile();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillId, setSkillId] = useState('');
  const [rubric, setRubric] = useState<RubricRow | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [resultat, setResultat] = useState<{ ok: boolean; msg: string } | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!signedIn) return;
    getSkills()
      .then(setSkills)
      .catch(() => setErreur('Impossible de charger les compétences.'));
  }, [signedIn]);

  async function choisir(id: string) {
    setSkillId(id);
    setRubric(null);
    setChecked({});
    setResultat(null);
    setErreur('');
    if (!id) return;
    try {
      const r = await getRubric(id);
      if (!r) setErreur('Aucune grille disponible pour cette compétence.');
      setRubric(r);
    } catch {
      setErreur('Impossible de charger la grille.');
    }
  }

  async function valider() {
    if (!rubric || !profileId) return;
    setErreur('');
    try {
      const verdicts = rubric.criteria.map((c) => ({
        criterionId: c.id,
        met: checked[c.id] ?? false,
      }));
      const res = await selfValidate(profileId, skillId, verdicts);
      setResultat(
        res.passed
          ? {
              ok: true,
              msg: 'Auto-validation réussie — la suite est débloquée et ta démonstration part en revue par les pairs.',
            }
          : {
              ok: false,
              msg: 'Critères requis non atteints. Continue de t’entraîner, puis réessaie.',
            },
      );
    } catch {
      setErreur('La validation n’a pas abouti. Réessaie dans un instant.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validation"
        subtitle="Pas de QCM : tu démontres, tu coches la grille. L’auto-validation débloque la suite ; les pairs confirment."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconBadgeCheck />}
          title="Connecte-toi pour valider une compétence"
          description="Choisis une compétence, démontre-la, coche la grille."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {signedIn && (
        <>
          <SelectField
            label="Compétence à valider"
            value={skillId}
            onChange={(e) => choisir(e.target.value)}
          >
            <option value="">Choisis une compétence…</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </SelectField>

          {erreur && <Note tone="error">{erreur}</Note>}

          {rubric && (
            <Card className="space-y-3">
              <CardTitle>Ce qui doit être démontré</CardTitle>
              {rubric.criteria.map((c: RubricCriterionRow) => (
                <label key={c.id} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked[c.id] ?? false}
                    onChange={(e) => setChecked((s) => ({ ...s, [c.id]: e.target.checked }))}
                  />
                  <span>
                    {c.label}
                    {!c.required && <span className="text-muted-foreground"> (indicatif)</span>}
                    {c.description && <CardDescription>{c.description}</CardDescription>}
                  </span>
                </label>
              ))}
              <Button onClick={valider}>M’auto-valider</Button>
              {resultat && <Note tone={resultat.ok ? 'info' : 'error'}>{resultat.msg}</Note>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
