import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export const runtime = 'nodejs';

const DATA_DIR = process.env.DEV_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : os.tmpdir());
const FILE = path.join(DATA_DIR, 'tasks.json');

const TYPES = ['tache', 'idee', 'bug'] as const;
const PRIORITIES = ['basse', 'moyenne', 'haute', 'urgente'] as const;
const STATUSES = ['todo', 'doing', 'done'] as const;

export interface Task {
  id: string;
  title: string;
  type: (typeof TYPES)[number];
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
  createdAt: number;
}

type Store = Record<string, Task[]>; // user → tasks

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Store;
  } catch {
    return {};
  }
}
async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store), 'utf8');
}
async function currentUser(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

function oneOf<T extends readonly string[]>(vals: T, v: unknown, fallback: T[number]): T[number] {
  return (typeof v === 'string' && (vals as readonly string[]).includes(v) ? v : fallback) as T[number];
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const store = await readStore();
  return NextResponse.json({ tasks: store[user] ?? [] });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  let body: Partial<Task>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const title = (body.title ?? '').toString().trim().slice(0, 200);
  const store = await readStore();
  const list = store[user] ?? [];
  const clean = {
    title,
    type: oneOf(TYPES, body.type, 'tache'),
    priority: oneOf(PRIORITIES, body.priority, 'moyenne'),
    status: oneOf(STATUSES, body.status, 'todo'),
  };

  if (body.id) {
    const idx = list.findIndex((t) => t.id === body.id);
    if (idx === -1) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    list[idx] = { ...list[idx]!, ...clean, title: title || list[idx]!.title };
    store[user] = list;
    await writeStore(store);
    return NextResponse.json({ task: list[idx] });
  }

  if (!title) return NextResponse.json({ error: 'titre requis' }, { status: 400 });
  const task: Task = { id: crypto.randomUUID(), ...clean, createdAt: Date.now() };
  store[user] = [task, ...list].slice(0, 500);
  await writeStore(store);
  return NextResponse.json({ task });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const store = await readStore();
  store[user] = (store[user] ?? []).filter((t) => t.id !== id);
  await writeStore(store);
  return NextResponse.json({ ok: true });
}
