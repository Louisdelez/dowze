import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { MAX_CODE_BYTES, codePath, ensureDir, listDocs, safeName, userCodeDir } from '@/lib/code';
import path from 'node:path';

export const runtime = 'nodejs';

async function user(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** GET sans `name` → liste des documents ; avec `name` → contenu du document. */
export async function GET(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ docs: await listDocs(u) });
  try {
    const content = await fs.readFile(codePath(u, name), 'utf8');
    return NextResponse.json({ name: safeName(name), content });
  } catch {
    return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  }
}

/** Enregistre un document (JSON { name, content }). */
export async function POST(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'paramètres' }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, 'utf8') > MAX_CODE_BYTES) {
    return NextResponse.json({ error: 'Document trop lourd.' }, { status: 413 });
  }
  const name = safeName(body.name);
  try {
    await ensureDir(u);
    await fs.writeFile(path.join(userCodeDir(u), name), body.content, 'utf8');
    return NextResponse.json({ ok: true, name });
  } catch {
    return NextResponse.json({ error: 'enregistrement impossible' }, { status: 400 });
  }
}

/** Supprime un document. */
export async function DELETE(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 });
  try {
    await fs.rm(codePath(u, name), { force: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'suppression impossible' }, { status: 400 });
  }
}

/** Renomme un document. */
export async function PATCH(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.newName)
    return NextResponse.json({ error: 'paramètres' }, { status: 400 });
  try {
    await fs.rename(codePath(u, body.name), codePath(u, body.newName));
    return NextResponse.json({ ok: true, name: safeName(body.newName) });
  } catch {
    return NextResponse.json({ error: 'renommage impossible' }, { status: 400 });
  }
}
