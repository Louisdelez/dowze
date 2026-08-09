'use client';

import { useState } from 'react';
import { Catalog } from '@/components/catalog';
import { Tasks } from '@/components/tasks';
import { Files } from '@/components/files';
import { Draw } from '@/components/draw';
import { CodeEditor } from '@/components/code';

type Tool = 'assets' | 'tasks' | 'draw' | 'editor' | 'files';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'assets', label: 'Assets' },
  { id: 'tasks', label: 'Tâches' },
  { id: 'draw', label: 'Dessin' },
  { id: 'editor', label: 'Éditeur' },
  { id: 'files', label: 'Fichiers' },
];

export function Workspace({ user }: { user: string }) {
  const [tool, setTool] = useState<Tool>('assets');

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-widest text-accent">Dowze Dev</span>

        <nav className="flex items-center gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tool === t.id ? 'bg-foreground text-white' : 'text-muted-foreground hover:bg-surface-soft hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">{user}</span>
          <button
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="text-xs text-muted-foreground underline hover:text-accent"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Contenu de l'outil actif */}
      <div className="min-h-0 flex-1">
        {tool === 'assets' ? <Catalog /> : tool === 'tasks' ? <Tasks /> : tool === 'draw' ? <Draw /> : tool === 'editor' ? <CodeEditor /> : <Files />}
      </div>
    </div>
  );
}
