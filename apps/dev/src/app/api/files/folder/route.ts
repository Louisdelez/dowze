import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { resolveSafe, sanitizeName } from '@/lib/files';

export const runtime = 'nodejs';

/** Crée un dossier dans le chemin courant. */
export async function POST(req: Request) {
  const jar = await cookies();
  const u = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = sanitizeName(body.name || '');
  if (!name) return NextResponse.json({ error: 'nom requis' }, { status: 400 });
  try {
    const dir = resolveSafe(u, path.join(body.path || '', name));
    await fs.mkdir(dir, { recursive: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'création impossible' }, { status: 400 });
  }
}
