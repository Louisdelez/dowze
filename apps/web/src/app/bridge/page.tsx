'use client';

import { useState } from 'react';
import type { BridgeOperation } from '@dowze/schemas';
import { createBridgeRequest, importBridgeResponse, ingestOssature } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { SelectField, TextField, TextAreaField } from '@/components/ui/field';
import { PageHeader } from '@/components/page-header';
import { Note } from '@/components/ui/note';

const OPERATIONS: { value: BridgeOperation; label: string }[] = [
  { value: 'generer-cours', label: 'Un cours' },
  { value: 'generer-grille', label: 'Une grille de validation' },
  { value: 'generer-expedition', label: 'Une expédition' },
  { value: 'generer-competence', label: 'Une compétence' },
  { value: 'generer-ossature', label: 'Une ossature de compétences' },
  { value: 'generer-plan', label: 'Un plan' },
];

export default function BridgePage() {
  const [operation, setOperation] = useState<BridgeOperation>('generer-grille');
  const [seed, setSeed] = useState('graine-demo-1');
  const [requestId, setRequestId] = useState('');
  const [aller, setAller] = useState('');
  const [retour, setRetour] = useState('');
  const [resultat, setResultat] = useState('');
  const [payload, setPayload] = useState<unknown>(null);
  const [ingest, setIngest] = useState('');
  const [erreur, setErreur] = useState('');

  async function genererAller() {
    setErreur('');
    setResultat('');
    const id = crypto.randomUUID();
    setRequestId(id);
    try {
      const json = await createBridgeRequest({ operation, requestId: id, seed });
      setAller(JSON.stringify(json, null, 2));
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }

  async function validerRetour() {
    setErreur('');
    setIngest('');
    try {
      const json = await importBridgeResponse({
        raw: retour,
        expectedRequestId: requestId,
        expectedOperation: operation,
      });
      setPayload(json);
      setResultat(JSON.stringify(json, null, 2));
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }

  // École générative : une ossature validée peut être persistée dans le graphe.
  const ossature =
    operation === 'generer-ossature' &&
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { skills?: unknown }).skills)
      ? ((payload as { skills: unknown[] }).skills as unknown[])
      : null;

  async function persister() {
    if (!ossature) return;
    setErreur('');
    try {
      const res = await ingestOssature(ossature);
      setIngest(`${res.added} compétence(s) ajoutée(s) au graphe.`);
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Le pont .json"
        subtitle="Sans API : l’app génère un fichier .json à coller dans ton IA ; tu colles sa réponse, l’app la valide strictement."
      />

      <Card className="space-y-4">
        <CardTitle>1 · Générer le fichier à coller dans l’IA</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Que veux-tu générer ?"
            value={operation}
            onChange={(e) => setOperation(e.target.value as BridgeOperation)}
          >
            {OPERATIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Sujet / graine"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
          />
        </div>
        <Button onClick={genererAller}>Générer le fichier</Button>
        {aller && (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs">{aller}</pre>
        )}
      </Card>

      <Card className="space-y-4">
        <CardTitle>2 · Coller la réponse de l’IA</CardTitle>
        <CardDescription>
          La réponse est vérifiée : taille, format, sécurité, schéma strict et cohérence du graphe.
        </CardDescription>
        <TextAreaField
          label="Réponse de l’IA (.json)"
          value={retour}
          onChange={(e) => setRetour(e.target.value)}
          className="[&_textarea]:font-mono"
          placeholder='{ "bridgeVersion": "1", "requestId": "…", "operation": "…", "payload": { … } }'
        />
        <Button onClick={validerRetour} disabled={!requestId || !retour}>
          Valider la réponse
        </Button>
        {resultat && (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs">{resultat}</pre>
        )}

        {ossature && (
          <div className="space-y-2 border-t border-border pt-3">
            <CardDescription>
              Ossature valide ({ossature.length} compétence·s). Tu peux l’ajouter au graphe — elle
              sera revalidée par la loi de clôture avant d’être persistée.
            </CardDescription>
            <Button variant="secondary" onClick={persister}>
              Persister au graphe
            </Button>
            {ingest && <Note>{ingest}</Note>}
          </div>
        )}
      </Card>

      {erreur && <Note tone="error">{erreur}</Note>}
    </div>
  );
}
