import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import {
  MAX_DRAW_BYTES,
  drawPath,
  ensureDir,
  listDrawings,
  projectPath,
  safeName,
  userDrawDir,
} from '@/lib/draw';

export const runtime = 'nodejs';

async function user(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Liste des dessins. */
export async function GET() {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  return NextResponse.json({ drawings: await listDrawings(u) });
}

/** Enregistre un dessin (PNG en multipart). */
export async function POST(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const name = safeName((form.get('name') as string) || '');
  const file = form.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'image manquante' }, { status: 400 });
  if (file.size > MAX_DRAW_BYTES)
    return NextResponse.json({ error: 'Dessin trop lourd.' }, { status: 413 });
  try {
    await ensureDir(u);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(userDrawDir(u), name), buf);
    return NextResponse.json({ ok: true, name });
  } catch {
    return NextResponse.json({ error: 'enregistrement impossible' }, { status: 400 });
  }
}

/** Supprime un dessin. */
export async function DELETE(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const name = new URL(req.url).searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 });
  try {
    await fs.rm(drawPath(u, name), { force: true });
    await fs.rm(projectPath(u, name), { force: true }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'suppression impossible' }, { status: 400 });
  }
}

/** Renomme un dessin. */
export async function PATCH(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.newName)
    return NextResponse.json({ error: 'paramètres' }, { status: 400 });
  try {
    await fs.rename(drawPath(u, body.name), drawPath(u, body.newName));
    await fs.rename(projectPath(u, body.name), projectPath(u, body.newName)).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'renommage impossible' }, { status: 400 });
  }
}
