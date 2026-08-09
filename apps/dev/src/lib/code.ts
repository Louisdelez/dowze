import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Documents de l'éditeur de code, un fichier texte par document, par utilisateur.
// Stocké dans le volume, séparé de l'explorateur « Fichiers » et des dessins.
const DATA_DIR =
  process.env.DEV_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : os.tmpdir());
export const CODE_ROOT = path.join(DATA_DIR, 'code');
export const MAX_CODE_BYTES = 5 * 1024 * 1024; // 5 Mo / document

export function userCodeDir(user: string): string {
  const s = user.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'user';
  return path.join(CODE_ROOT, s);
}

/** Nom de fichier assaini (extension conservée pour la détection du langage). */
export function safeName(name: string): string {
  let n = (name || '').replace(/[/\\]/g, '').replace(/^\.+/, '').trim().slice(0, 120);
  if (!n) n = 'sans-titre.txt';
  return n;
}

export function codePath(user: string, name: string): string {
  const dir = userCodeDir(user);
  const p = path.join(dir, safeName(name));
  if (p !== dir && !p.startsWith(dir + path.sep)) throw new Error('nom invalide');
  return p;
}

export async function ensureDir(user: string): Promise<void> {
  await fs.mkdir(userCodeDir(user), { recursive: true });
}

export interface Doc {
  name: string;
  mtime: number;
  size: number;
}

export async function listDocs(user: string): Promise<Doc[]> {
  await ensureDir(user);
  const dir = userCodeDir(user);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    names = [];
  }
  const out: Doc[] = [];
  for (const name of names) {
    try {
      const st = await fs.stat(path.join(dir, name));
      if (st.isFile()) out.push({ name, mtime: st.mtimeMs, size: st.size });
    } catch {
      /* ignore */
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
