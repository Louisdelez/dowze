'use client';

import { useState } from 'react';
import {
  listClasses,
  listClasseMessages,
  postClasseMessage,
  type ClasseRow,
  type MessageRow,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

export default function CommunautePage() {
  const [classes, setClasses] = useState<ClasseRow[]>([]);
  const [classeId, setClasseId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [body, setBody] = useState('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [erreur, setErreur] = useState('');

  async function chargerClasses() {
    setErreur('');
    try {
      setClasses(await listClasses());
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function chargerMessages() {
    setErreur('');
    try {
      setMessages(await listClasseMessages(classeId));
    } catch (e) {
      setErreur(String(e));
    }
  }

  async function envoyer() {
    setErreur('');
    try {
      await postClasseMessage(classeId, authorId, body);
      setBody('');
      await chargerMessages();
    } catch (e) {
      setErreur(String(e));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Communauté</h1>
        <p className="mt-1 text-muted-foreground">
          Les Classes (~24, formées par langue/fuseau, niveaux mêlés) et leurs discussions. Tout
          fonctionne aussi seul.
        </p>
      </header>

      <div>
        <Button onClick={chargerClasses}>Charger les classes</Button>
        {classes.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {classes.map((c) => (
              <Card key={c.id} className="p-4">
                <CardTitle>{c.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {c.locale} · {c.timezone} · {c.type} · {c.status}
                </p>
                <code className="text-[10px]">{c.id}</code>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="space-y-3">
        <CardTitle>Discussion d’une classe</CardTitle>
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            placeholder="identifiant de classe (UUID)"
          />
          <Button variant="ghost" onClick={chargerMessages} disabled={!classeId}>
            Voir les messages
          </Button>
        </div>

        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-md bg-muted p-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{m.authorId}</span>
              <p>{m.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            className="w-64 rounded-md border border-border px-3 py-2 text-sm"
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            placeholder="ton identifiant de profil"
          />
          <input
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="message…"
          />
          <Button onClick={envoyer} disabled={!classeId || !authorId || !body}>
            Envoyer
          </Button>
        </div>
      </Card>

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erreur}</p>
      )}
    </div>
  );
}
