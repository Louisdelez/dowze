'use client';

import { useState } from 'react';
import {
  getRubric,
  selfValidate,
  type RubricRow,
  type RubricCriterionRow,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export default function ValidationPage() {
  const [skillId, setSkillId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [rubric, setRubric] = useState<RubricRow | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [resultat, setResultat] = useState<string>('');
  const [erreur, setErreur] = useState('');

  async function charger() {
    setErreur('');
    setResultat('');
    try {
      const r = await getRubric(skillId);
      setRubric(r);
      setChecked({});
      if (!r) setErreur('Aucune grille pour cette compétence.');
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function valider() {
    if (!rubric) return;
    setErreur('');
    try {
      const verdicts = rubric.criteria.map((c) => ({ criterionId: c.id, met: checked[c.id] ?? false }));
      const res = await selfValidate(profileId, skillId, verdicts);
      setResultat(
        res.passed
          ? '✓ Auto-validation réussie — la suite est débloquée. Mise en file pour la revue par les pairs.'
          : '✗ Critères requis non atteints. Continue, puis réessaie.',
      );
    } catch (e) {
      setErreur(String(e));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Validation</h1>
        <p className="mt-1 text-muted-foreground">
          Pas de QCM : tu démontres, puis tu coches la grille. L’auto-validation débloque ; les pairs
          renforcent (modèle École 42).
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          placeholder="identifiant de compétence (UUID)"
        />
        <input
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          placeholder="identifiant de profil (UUID)"
        />
        <Button onClick={charger} disabled={!skillId}>
          Charger la grille
        </Button>
      </div>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}

      {rubric && (
        <Card className="space-y-3">
          <CardTitle>Grille — ce qui doit être démontré</CardTitle>
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
                {c.required ? '' : ' (indicatif)'}
                {c.description && <CardDescription>{c.description}</CardDescription>}
              </span>
            </label>
          ))}
          <Button onClick={valider} disabled={!profileId}>
            M’auto-valider
          </Button>
          {resultat && <p className="text-sm">{resultat}</p>}
        </Card>
      )}
    </div>
  );
}
