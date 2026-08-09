import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { resolveSafe } from '@/lib/files';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

/** Télécharge (ou prévisualise) un fichier. */
export async function GET(req: Request) {
  const jar = await cookies();
  const u = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const url = new URL(req.url);
  const rel = url.searchParams.get('path');
  const inline = url.searchParams.get('inline') === '1'; // aperçu (thumbnail / Quick Look) au lieu du téléchargement
  if (!rel) return NextResponse.json({ error: 'path requis' }, { status: 400 });
  try {
    const p = resolveSafe(u, rel);
    const st = await fs.stat(p);
    if (!st.isFile()) return NextResponse.json({ error: 'pas un fichier' }, { status: 400 });
    const buf = await fs.readFile(p);
    const name = path.basename(p);
    const ext = path.extname(name).toLowerCase();
    const body = new Uint8Array(buf);
    return new NextResponse(body, {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(name)}"`,
        'Content-Length': String(st.size),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'introuvable' }, { status: 404 });
  }
}
