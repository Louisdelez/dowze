import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export const runtime = 'nodejs';

// État « fait/à faire » par utilisateur, persisté dans un volume monté (défaut /data).
const DATA_DIR =
  process.env.DEV_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : os.tmpdir());
const FILE = path.join(DATA_DIR, 'todo.json');

type Store = Record<string, Record<string, boolean>>; // user → { assetName → done }

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

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const store = await readStore();
  return NextResponse.json({ done: store[user] ?? {} });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  let body: { name?: string; done?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const name = (body.name || '').slice(0, 120);
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 });
  const store = await readStore();
  const mine = store[user] ?? {};
  if (body.done) mine[name] = true;
  else delete mine[name];
  store[user] = mine;
  await writeStore(store);
  return NextResponse.json({ ok: true });
}
