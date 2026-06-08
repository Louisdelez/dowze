'use client';

import { useState } from 'react';
import type { BridgeOperation } from '@dowze/schemas';
import { createBridgeRequest, importBridgeResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

const OPERATIONS: BridgeOperation[] = [
  'generer-competence',
  'generer-ossature',
  'generer-expedition',
  'generer-grille',
  'generer-cours',
  'generer-plan',
];

export default function BridgePage() {
  const [operation, setOperation] = useState<BridgeOperation>('generer-grille');
  const [seed, setSeed] = useState('graine-demo-1');
  const [requestId, setRequestId] = useState('');
  const [aller, setAller] = useState('');
  const [retour, setRetour] = useState('');
  const [resultat, setResultat] = useState('');
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
      setErreur(String(e));
    }
  }

  async function validerRetour() {
    setErreur('');
    try {
      const json = await importBridgeResponse({
        raw: retour,
        expectedRequestId: requestId,
        expectedOperation: operation,
      });
      setResultat(JSON.stringify(json, null, 2));
    } catch (e) {
      setErreur(String(e));
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Le pont .json</h1>
        <p className="mt-1 text-muted-foreground">
          Sans API : l’intra génère un <code>.json</code> aller à coller dans ton IA ; tu colles le
          retour, l’intra le valide strictement.
        </p>
      </header>

      <Card className="space-y-4">
        <CardTitle>1 · Générer le .json aller</CardTitle>
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-md border border-border px-3 py-2 text-sm"
            value={operation}
            onChange={(e) => setOperation(e.target.value as BridgeOperation)}
          >
            {OPERATIONS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="graine"
          />
          <Button onClick={genererAller}>Générer</Button>
        </div>
        {aller && (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs">{aller}</pre>
        )}
      </Card>

      <Card className="space-y-4">
        <CardTitle>2 · Coller le .json retour de l’IA</CardTitle>
        <CardDescription>
          Le retour est validé : taille, parse, anti prototype-pollution, schéma strict, et loi de
          clôture du graphe.
        </CardDescription>
        <textarea
          className="h-40 w-full rounded-md border border-border p-3 font-mono text-xs"
          value={retour}
          onChange={(e) => setRetour(e.target.value)}
          placeholder='{ "bridgeVersion": "1", "requestId": "…", "operation": "…", "payload": { … } }'
        />
        <Button onClick={validerRetour} disabled={!requestId || !retour}>
          Valider le retour
        </Button>
        {resultat && (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs">{resultat}</pre>
        )}
      </Card>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erreur}
        </p>
      )}
    </div>
  );
}
