import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { MAX_FILE_BYTES, QUOTA_BYTES, resolveSafe, sanitizeName, usage } from '@/lib/files';

export const runtime = 'nodejs';

/** Upload multi-fichiers (avec chemins relatifs pour préserver l'arborescence des dossiers glissés). */
export async function POST(req: Request) {
  const jar = await cookies();
  const u = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const rel = (form.get('path') as string) || '';
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  const rawPaths = form.getAll('paths').map((p) => String(p));
  if (!files.length) return NextResponse.json({ error: 'aucun fichier' }, { status: 400 });

  const use = await usage(u);
  let remaining = QUOTA_BYTES - use.bytes;
  const saved: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    if (f.size > MAX_FILE_BYTES) return NextResponse.json({ error: `Fichier trop lourd (max ${Math.round(MAX_FILE_BYTES / 1048576)} Mo).` }, { status: 413 });
    if (f.size > remaining) return NextResponse.json({ error: 'Quota dépassé.' }, { status: 413 });
    // Chemin relatif éventuel (dossier glissé) → nettoyage segment par segment (anti-traversée).
    const relPath = rawPaths[i] || f.name;
    const segs = relPath.split('/').map((s) => sanitizeName(s)).filter(Boolean);
    if (!segs.length) continue;
    try {
      const target = resolveSafe(u, path.join(rel, ...segs));
      await fs.mkdir(path.dirname(target), { recursive: true });
      const buf = Buffer.from(await f.arrayBuffer());
      await fs.writeFile(target, buf);
      remaining -= f.size;
      saved.push(segs.join('/'));
    } catch {
      /* ignore ce fichier */
    }
  }
  return NextResponse.json({ ok: true, saved });
}
