import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Stockage « cloud » par utilisateur, dans le volume monté. Fichiers RÉELS sur disque (dossiers = vrais répertoires).
const DATA_DIR = process.env.DEV_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : os.tmpdir());
export const FILES_ROOT = path.join(DATA_DIR, 'files');
export const QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 Go / utilisateur
export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 Mo / fichier

export interface Entry {
  name: string;
  type: 'file' | 'folder';
  size: number;
  mtime: number;
}
export interface Usage {
  bytes: number;
  files: number;
  folders: number;
}

export function userRoot(user: string): string {
  const safeUser = user.replace(/[^a-zA-Z0-9_.-]/g, '_') || 'user';
  return path.join(FILES_ROOT, safeUser);
}

/** Résout un chemin relatif SOUS la racine de l'utilisateur (anti-traversée `..`). */
export function resolveSafe(user: string, rel: string): string {
  const root = userRoot(user);
  const cleaned = (rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const p = path.resolve(root, cleaned);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error('chemin invalide');
  return p;
}

export function sanitizeName(name: string): string {
  return (name || '').replace(/[/\\]/g, '').replace(/^\.+/, '').trim().slice(0, 200);
}

export async function ensureRoot(user: string): Promise<void> {
  await fs.mkdir(userRoot(user), { recursive: true });
}

async function statsOf(dir: string): Promise<Usage> {
  let bytes = 0,
    files = 0,
    folders = 0;
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return { bytes, files, folders };
  }
  for (const name of names) {
    const full = path.join(dir, name);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      folders++;
      const s = await statsOf(full);
      bytes += s.bytes;
      files += s.files;
      folders += s.folders;
    } else {
      files++;
      bytes += st.size;
    }
  }
  return { bytes, files, folders };
}

export async function dirSize(dir: string): Promise<number> {
  return (await statsOf(dir)).bytes;
}

export async function listDir(user: string, rel: string): Promise<Entry[]> {
  await ensureRoot(user);
  const dir = resolveSafe(user, rel);
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    names = [];
  }
  const entries: Entry[] = [];
  for (const name of names) {
    const full = path.join(dir, name);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) entries.push({ name, type: 'folder', size: await dirSize(full), mtime: st.mtimeMs });
    else entries.push({ name, type: 'file', size: st.size, mtime: st.mtimeMs });
  }
  entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
  return entries;
}

export async function usage(user: string): Promise<Usage> {
  await ensureRoot(user);
  return statsOf(userRoot(user));
}
