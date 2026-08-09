import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { listDir, resolveSafe, sanitizeName, usage } from '@/lib/files';

export const runtime = 'nodejs';

async function user(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** Liste un dossier + usage total de l'espace. */
export async function GET(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const rel = new URL(req.url).searchParams.get('path') || '';
  try {
    const entries = await listDir(u, rel);
    const use = await usage(u);
    return NextResponse.json({ path: rel, entries, usage: use });
  } catch {
    return NextResponse.json({ error: 'chemin invalide' }, { status: 400 });
  }
}

/** Supprime un fichier ou dossier (récursif). */
export async function DELETE(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const rel = new URL(req.url).searchParams.get('path');
  if (!rel) return NextResponse.json({ error: 'path requis' }, { status: 400 });
  try {
    const p = resolveSafe(u, rel);
    await fs.rm(p, { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'suppression impossible' }, { status: 400 });
  }
}

/** Renomme (newName) OU déplace (destDir) un fichier/dossier. */
export async function PATCH(req: Request) {
  const u = await user();
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const rel: string = body.path;
  if (!rel) return NextResponse.json({ error: 'path requis' }, { status: 400 });
  try {
    const src = resolveSafe(u, rel);
    let dst: string;
    if (typeof body.destDir === 'string') {
      // Déplacement : dans le dossier destDir, même nom de base
      const destDir = resolveSafe(u, body.destDir);
      dst = path.join(destDir, path.basename(src));
      if (dst === src || destDir === src) return NextResponse.json({ ok: true }); // no-op / dans soi-même
    } else {
      const newName = sanitizeName(body.newName || '');
      if (!newName) return NextResponse.json({ error: 'paramètres' }, { status: 400 });
      dst = path.join(path.dirname(src), newName);
    }
    await fs.rename(src, dst);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'opération impossible' }, { status: 400 });
  }
}
