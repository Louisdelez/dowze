import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Dessins (Paint) par utilisateur, stockés en PNG dans le volume, séparés de l'explorateur de fichiers.
const DATA_DIR = process.env.DEV_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : os.tmpdir());
export const DRAW_ROOT = path.join(DATA_DIR, 'draw');
export const MAX_DRAW_BYTES = 20 * 1024 * 1024; // 20 Mo / dessin

export function userDrawDir(user: string): string {
  const s = user.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'user';
  return path.join(DRAW_ROOT, s);
}

export function safeName(name: string): string {
  let n = (name || '').replace(/[/\\]/g, '').replace(/^\.+/, '').trim().slice(0, 120);
  if (!n) n = 'dessin';
  if (!/\.png$/i.test(n)) n += '.png';
  return n;
}

export function drawPath(user: string, name: string): string {
  const dir = userDrawDir(user);
  const p = path.join(dir, safeName(name));
  if (p !== dir && !p.startsWith(dir + path.sep)) throw new Error('nom invalide');
  return p;
}

/** Chemin du projet (calques) associé : `<nom>.json` à côté du PNG. */
export function projectPath(user: string, name: string): string {
  return drawPath(user, name).replace(/\.png$/i, '.json');
}

export async function ensureDir(user: string): Promise<void> {
  await fs.mkdir(userDrawDir(user), { recursive: true });
}

export interface Drawing {
  name: string;
  mtime: number;
  size: number;
}

export async function listDrawings(user: string): Promise<Drawing[]> {
  await ensureDir(user);
  const dir = userDrawDir(user);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    names = [];
  }
  const out: Drawing[] = [];
  for (const name of names) {
    if (!/\.png$/i.test(name)) continue;
    try {
      const st = await fs.stat(path.join(dir, name));
      if (st.isFile()) out.push({ name, mtime: st.mtimeMs, size: st.size });
    } catch {
      /* ignore */
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}
