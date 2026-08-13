import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { drawPath } from '@/lib/draw';

export const runtime = 'nodejs';

/** Sert l'image PNG d'un dessin (pour l'ouvrir sur le canvas / miniature). */
export async function GET(req: Request) {
  const jar = await cookies();
  const u = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 });
  try {
    const buf = await fs.readFile(drawPath(u, name));
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  }
}
