'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Task } from '@/app/api/tasks/route';

type Type = Task['type'];
type Priority = Task['priority'];
type Status = Task['status'];

const TYPE_META: Record<Type, { label: string; cls: string }> = {
  tache: { label: 'Tâche', cls: 'bg-block-mint text-foreground' },
  idee: { label: 'Idée', cls: 'bg-block-lilac text-foreground' },
  bug: { label: 'Bug', cls: 'bg-block-pink text-foreground' },
};
const PRIORITY_META: Record<Priority, { label: string; dot: string; order: number }> = {
  urgente: { label: 'Urgente', dot: '#ef4444', order: 0 },
  haute: { label: 'Haute', dot: '#f59e0b', order: 1 },
  moyenne: { label: 'Moyenne', dot: '#3b82f6', order: 2 },
  basse: { label: 'Basse', dot: '#94a3b8', order: 3 },
};
const COLUMNS: { id: Status; label: string }[] = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'done', label: 'Fait' },
];
const TYPES: Type[] = ['tache', 'idee', 'bug'];
const PRIORITIES: Priority[] = ['urgente', 'haute', 'moyenne', 'basse'];
const selectCls = 'rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function TaskCard({ task, onOpen, onDragStart }: { task: Task; onOpen: () => void; onDragStart: () => void }) {
  const t = TYPE_META[task.type];
  const p = PRIORITY_META[task.priority];
  const done = task.status === 'done';
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onClick={onOpen}
      className={`cursor-grab rounded-xl border border-border bg-surface p-3 shadow-sm transition hover:border-foreground/40 active:cursor-grabbing ${done ? 'opacity-60' : ''}`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${t.cls}`}>{t.label}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} /> {p.label}
        </span>
      </div>
      <p className={`text-sm font-medium leading-snug ${done ? 'line-through' : ''}`}>{task.title}</p>
    </div>
  );
}

function TaskModal({
  task,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState<Type>(task.type);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<Status>(task.status);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const created = new Date(task.createdAt).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TYPE_META[type].cls}`}>{TYPE_META[type].label}</span>
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[priority].dot }} /> {PRIORITY_META[priority].label}
            </span>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-soft hover:text-foreground">
            <IconX />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titre</label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as Type)} className={`${selectCls} w-full`}>
                {TYPES.map((x) => <option key={x} value={x}>{TYPE_META[x].label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={`${selectCls} w-full`}>
                {PRIORITIES.map((x) => <option key={x} value={x}>{PRIORITY_META[x].label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={`${selectCls} w-full`}>
                {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Créée le {created}</p>
        </div>

        <div className="mt-5 flex items-center gap-2 border-t border-border-soft pt-4">
          <button
            onClick={() => onSave({ title: title.trim() || task.title, type, priority, status })}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent"
          >
            Enregistrer
          </button>
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:border-foreground">
            Annuler
          </button>
          {confirmDel ? (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Supprimer ?</span>
              <button onClick={onDelete} className="rounded-lg bg-[#ef4444] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90">Oui, supprimer</button>
              <button onClick={() => setConfirmDel(false)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Non</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-[#ef4444] transition hover:bg-block-pink">
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Type>('tache');
  const [priority, setPriority] = useState<Priority>('moyenne');
  const [modalId, setModalId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((j) => setTasks(j.tasks ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTitle('');
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t, type, priority, status: 'todo' }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.task) setTasks((prev) => [res.task, ...prev]);
  }

  function patch(id: string, changes: Partial<Task>) {
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...changes } : x)));
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...changes }),
    }).catch(() => {});
  }
  function remove(id: string) {
    setTasks((prev) => prev.filter((x) => x.id !== id));
    fetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  }

  function drop(e: React.DragEvent, status: Status) {
    e.preventDefault();
    setOverCol(null);
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (t && t.status !== status) patch(id, { status });
  }

  const byCol = useMemo(() => {
    const sort = (a: Task, b: Task) => PRIORITY_META[a.priority].order - PRIORITY_META[b.priority].order || b.createdAt - a.createdAt;
    return COLUMNS.map((c) => ({ ...c, items: tasks.filter((t) => t.status === c.id).sort(sort) }));
  }, [tasks]);

  const modalTask = tasks.find((t) => t.id === modalId) ?? null;

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-6 py-5">
      {/* Ajout */}
      <form onSubmit={add} className="mb-5 flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nouvelle tâche, idée, bug…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <select value={type} onChange={(e) => setType(e.target.value as Type)} className={selectCls}>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={selectCls}>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <button type="submit" className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent">
          Ajouter
        </button>
      </form>

      {/* Kanban (drag & drop) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {byCol.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); if (overCol !== col.id) setOverCol(col.id); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === col.id ? null : c)); }}
            onDrop={(e) => drop(e, col.id)}
            className={`flex min-h-0 flex-col rounded-2xl border p-3 transition ${overCol === col.id ? 'border-accent bg-accent/5' : 'border-border bg-surface-soft/60'}`}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <h2 className="text-sm font-bold">{col.label}</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{col.items.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-auto">
              {col.items.map((task) => (
                <TaskCard key={task.id} task={task} onOpen={() => setModalId(task.id)} onDragStart={() => setDragId(task.id)} />
              ))}
              {col.items.length === 0 && <p className="select-none px-1 py-8 text-center text-xs text-muted-foreground">Déposez une tâche ici</p>}
            </div>
          </div>
        ))}
      </div>

      {!loaded && <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>}

      {modalTask && (
        <TaskModal
          task={modalTask}
          onSave={(p) => { patch(modalTask.id, p); setModalId(null); }}
          onDelete={() => { remove(modalTask.id); setModalId(null); }}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}
