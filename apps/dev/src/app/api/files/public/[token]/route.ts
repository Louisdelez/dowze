import { NextResponse } from 'next/server';
import { promises as fs, createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { resolveSafe } from '@/lib/files';
import { verifyShare } from '@/lib/share';
import { zipDirectoryStream } from '@/lib/zip';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
};

/** Sert le fichier/dossier référencé par un jeton de partage valide (public, sans session). Tout est STREAMÉ. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = await verifyShare(token);
  if (!payload) {
    return new NextResponse('Lien invalide ou expiré.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  try {
    const abs = resolveSafe(payload.u, payload.p);
    const st = await fs.stat(abs);

    if (st.isDirectory()) {
      // Dossier → ZIP en streaming (mémoire quasi nulle, pas de limite de taille en RAM).
      const name = `${path.basename(abs) || 'dossier'}.zip`;
      return new NextResponse(zipDirectoryStream(abs), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // Fichier → streamé aussi (pas de readFile en RAM).
    const name = path.basename(abs);
    const ext = path.extname(name).toLowerCase();
    const webStream = Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Content-Length': String(st.size),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('Fichier introuvable.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
