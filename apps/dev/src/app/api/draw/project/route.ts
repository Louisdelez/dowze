import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { ensureDir, projectPath } from '@/lib/draw';

export const runtime = 'nodejs';
const MAX = 40 * 1024 * 1024; // 40 Mo (projet multi-calques en base64)

async function user(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Enregistre le projet (calques) associé à un dessin. */
export async function POST(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !body.name || !Array.isArray(body.layers)) return NextResponse.json({ error: 'paramètres' }, { status: 400 });
  const json = JSON.stringify({ layers: body.layers });
  if (Buffer.byteLength(json, 'utf8') > MAX) return NextResponse.json({ error: 'Projet trop lourd.' }, { status: 413 });
  try {
    await ensureDir(u);
    await fs.writeFile(projectPath(u, body.name), json, 'utf8');
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'enregistrement impossible' }, { status: 400 });
  }
}

/** Charge le projet (calques) d'un dessin, ou { layers: null } si absent. */
export async function GET(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 });
  try {
    const raw = await fs.readFile(projectPath(u, name), 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ layers: null });
  }
}
