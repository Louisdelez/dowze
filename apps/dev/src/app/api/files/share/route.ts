import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { resolveSafe } from '@/lib/files';
import { signShare, clampTtl } from '@/lib/share';

export const runtime = 'nodejs';

/** Génère un lien de partage signé (fichier OU dossier), expirant entre 1 h et 24 h. */
export async function POST(req: Request) {
  const jar = await cookies();
  const u = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });

  let body: { path?: string; ttl?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'corps invalide' }, { status: 400 }); }
  const rel = (body.path || '').trim();
  if (!rel) return NextResponse.json({ error: 'path requis' }, { status: 400 });

  // Vérifie l'existence + appartenance (anti-traversée via resolveSafe).
  try {
    const abs = resolveSafe(u, rel);
    await fs.stat(abs);
  } catch {
    return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  }

  const ttl = clampTtl(Number(body.ttl) || 3600);
  const { token, exp } = await signShare(u, rel, ttl);
  // Chemin RELATIF : le client préfixe window.location.origin (robuste derrière le reverse-proxy).
  return NextResponse.json({ path: `/api/files/public/${token}`, token, exp, expiresInSeconds: ttl });
}
