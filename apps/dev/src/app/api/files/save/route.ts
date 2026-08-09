import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { MAX_FILE_BYTES, resolveSafe } from '@/lib/files';

export const runtime = 'nodejs';

/** Enregistre le contenu texte d'un fichier (éditeur). */
export async function POST(req: Request) {
  const jar = await cookies();
  const u = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const rel: string = body.path;
  const content: unknown = body.content;
  if (!rel || typeof content !== 'string') return NextResponse.json({ error: 'paramètres' }, { status: 400 });
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) return NextResponse.json({ error: 'Fichier trop lourd.' }, { status: 413 });
  try {
    const p = resolveSafe(u, rel);
    await fs.writeFile(p, content, 'utf8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'écriture impossible' }, { status: 400 });
  }
}
