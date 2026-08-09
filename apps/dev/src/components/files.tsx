'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ============================ Types & helpers ============================ */
interface Entry {
  name: string;
  type: 'file' | 'folder';
  size: number;
  mtime: number;
}
interface Usage {
  bytes: number;
  files: number;
  folders: number;
}
// Un transfert en cours (panneau bas-droite, façon Google Drive).
interface Transfer {
  id: number;
  name: string;
  folder: string;
  size: number;
  loaded: number;
  status: 'uploading' | 'done' | 'error';
}
type View = 'icons' | 'list' | 'columns';
type SortKey = 'name' | 'mtime' | 'size' | 'kind';

const QUOTA = 10 * 1024 * 1024 * 1024;
const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'];
const TXT_EXT = [
  'txt',
  'md',
  'json',
  'csv',
  'log',
  'yml',
  'yaml',
  'ts',
  'tsx',
  'js',
  'css',
  'html',
];

const ext = (n: string) => n.split('.').pop()?.toLowerCase() ?? '';
const isImg = (n: string) => IMG_EXT.includes(ext(n));
const isTxt = (n: string) => TXT_EXT.includes(ext(n));
const join = (a: string, b: string) => (a ? `${a}/${b}` : b);
const basename = (p: string) => p.split('/').pop() ?? p;
const thumb = (p: string) => `/api/files/download?path=${encodeURIComponent(p)}&inline=1`;
const dl = (p: string) => `/api/files/download?path=${encodeURIComponent(p)}`;

function human(n: number): string {
  if (n < 1024) return `${n} o`;
  const u = ['Ko', 'Mo', 'Go', 'To'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
}
function kindOf(e: Entry): string {
  if (e.type === 'folder') return 'Dossier';
  const x = ext(e.name);
  if (isImg(e.name)) return `Image ${x.toUpperCase()}`;
  if (isTxt(e.name)) return `Texte ${x.toUpperCase()}`;
  return x ? `Fichier ${x.toUpperCase()}` : 'Fichier';
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================ Icônes ============================ */
function FolderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M6 12a3 3 0 0 1 3-3h11l4 4h15a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z"
        fill="#57b7f6"
      />
      <path d="M6 17h39v18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#7cc6f8" />
    </svg>
  );
}
function DocIcon({ size = 20, tint = '#c7cdd6' }: { size?: number; tint?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M12 5h18l10 10v26a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        fill="#fff"
        stroke={tint}
        strokeWidth="2"
      />
      <path d="M30 5v10h10" fill="none" stroke={tint} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// Catégories fixes (dossiers utilisateur standards, comme sur un PC).
const DEFAULT_DIRS = ['Bureau', 'Téléchargements', 'Documents', 'Images', 'Musiques', 'Vidéos'];
function SidebarIcon({ name }: { name: string }) {
  const c = '#5b6470';
  const wrap = (children: React.ReactNode) => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
  switch (name) {
    case 'Bureau':
      return wrap(
        <>
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </>,
      );
    case 'Téléchargements':
      return wrap(
        <>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </>,
      );
    case 'Documents':
      return wrap(
        <>
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6" />
          <path d="M9 13h6M9 17h5" />
        </>,
      );
    case 'Images':
      return wrap(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </>,
      );
    case 'Musiques':
      return wrap(
        <>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </>,
      );
    case 'Vidéos':
      return wrap(
        <>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 9h20M7 4v5M17 4v5" />
        </>,
      );
    default:
      return <FolderIcon size={16} />;
  }
}
function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ============================ Upload (drag OS) ============================ */
interface DropItem {
  file: File;
  relPath: string;
}
interface LegacyFileSystemEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file(callback: (file: File) => void): void;
  createReader(): {
    readEntries(callback: (entries: LegacyFileSystemEntry[]) => void): void;
  };
}

async function walkEntry(
  entry: LegacyFileSystemEntry,
  prefix: string,
  out: DropItem[],
): Promise<void> {
  if (entry.isFile) {
    const file: File = await new Promise((res) => entry.file(res));
    out.push({ file, relPath: prefix + entry.name });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const read = (): Promise<LegacyFileSystemEntry[]> =>
      new Promise((res) => reader.readEntries(res));
    let batch: LegacyFileSystemEntry[];
    do {
      batch = await read();
      for (const c of batch) await walkEntry(c, `${prefix}${entry.name}/`, out);
    } while (batch.length);
  }
}
async function collectDrop(dt: DataTransfer): Promise<DropItem[]> {
  const out: DropItem[] = [];
  const items = dt.items ? [...dt.items] : [];
  const getEntry = (it: DataTransferItem) => {
    const legacyItem = it as unknown as {
      webkitGetAsEntry?: () => LegacyFileSystemEntry | null;
    };
    return legacyItem.webkitGetAsEntry?.();
  };
  if (items.length && getEntry(items[0]!)) {
    for (const it of items) {
      const en = getEntry(it);
      if (en) await walkEntry(en, '', out);
    }
  } else {
    for (const f of [...dt.files]) out.push({ file: f, relPath: f.name });
  }
  return out;
}

/* ============================ Composant principal ============================ */
export function Files() {
  const [cwd, setCwd] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [usage, setUsage] = useState<Usage>({ bytes: 0, files: 0, folders: 0 });
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [tPanelMin, setTPanelMin] = useState(false);
  const tid = useRef(0);
  const [share, setShare] = useState<Entry | null>(null); // dialogue « Partager par lien »
  const [view, setView] = useState<View>('icons');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [menu, setMenu] = useState<{ x: number; y: number; entry: Entry | null } | null>(null);
  const [quick, setQuick] = useState<{ name: string; path: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | 'ROOT' | null>(null);
  const [hist, setHist] = useState<{ stack: string[]; idx: number }>({ stack: [''], idx: 0 });
  const [roots, setRoots] = useState<string[]>([]);
  const pickRef = useRef<HTMLInputElement>(null);
  const lastClick = useRef<number>(-1);

  const load = useCallback((p: string) => {
    setLoading(true);
    setSel(new Set());
    fetch(`/api/files?path=${encodeURIComponent(p)}`)
      .then((r) => (r.ok ? r.json() : { entries: [], usage: { bytes: 0, files: 0, folders: 0 } }))
      .then((j) => {
        setEntries(j.entries ?? []);
        setUsage(j.usage ?? { bytes: 0, files: 0, folders: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load(cwd);
  }, [cwd, load]);

  // Dossiers racine → sidebar (catégories).
  const loadRoots = useCallback(() => {
    fetch('/api/files?path=')
      .then((r) => r.json())
      .then((j: { entries?: Entry[] }) =>
        setRoots((j.entries ?? []).filter((e) => e.type === 'folder').map((e) => e.name)),
      )
      .catch(() => {});
  }, []);
  // Au montage : crée les catégories PC par défaut si absentes, puis charge la sidebar.
  useEffect(() => {
    (async () => {
      const j = await fetch('/api/files?path=')
        .then((r) => r.json())
        .catch(() => ({ entries: [] as Entry[] }));
      const have = new Set(
        (j.entries ?? []).filter((e: Entry) => e.type === 'folder').map((e: Entry) => e.name),
      );
      for (const d of DEFAULT_DIRS)
        if (!have.has(d))
          await fetch('/api/files/folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '', name: d }),
          }).catch(() => {});
      loadRoots();
      load('');
    })();
  }, [loadRoots, load]);

  function navigate(p: string) {
    if (p === cwd) return;
    setHist((h) => {
      const stack = h.stack.slice(0, h.idx + 1);
      stack.push(p);
      return { stack, idx: stack.length - 1 };
    });
    setCwd(p);
  }
  const canBack = hist.idx > 0;
  const canFwd = hist.idx < hist.stack.length - 1;
  function back() {
    if (canBack) {
      const i = hist.idx - 1;
      setHist((h) => ({ ...h, idx: i }));
      setCwd(hist.stack[i]!);
    }
  }
  function fwd() {
    if (canFwd) {
      const i = hist.idx + 1;
      setHist((h) => ({ ...h, idx: i }));
      setCwd(hist.stack[i]!);
    }
  }

  /* ---------- Upload (XHR + progression par élément) ---------- */
  // Envoie UN élément via XMLHttpRequest pour récupérer la progression (fetch ne l'expose pas).
  function uploadOne(item: DropItem, destRel: string, id: number): Promise<void> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append('path', destRel);
      fd.append('files', item.file);
      fd.append('paths', item.relPath);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, loaded: e.loaded } : t)));
      };
      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, loaded: t.size, status: ok ? 'done' : 'error' } : t,
          ),
        );
        resolve();
      };
      xhr.onerror = () => {
        setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'error' } : t)));
        resolve();
      };
      xhr.send(fd);
    });
  }
  async function doUpload(items: DropItem[], destRel = cwd) {
    if (!items.length) return;
    const jobs = items.map((item) => ({ item, id: ++tid.current }));
    // Ajoute les entrées au panneau de transfert (les plus récentes en haut).
    setTransfers((prev) => [
      ...jobs.map(({ item, id }) => ({
        id,
        name: basename(item.relPath),
        folder: item.relPath.includes('/')
          ? item.relPath.slice(0, item.relPath.lastIndexOf('/'))
          : destRel || 'Accueil',
        size: item.file.size,
        loaded: 0,
        status: 'uploading' as const,
      })),
      ...prev,
    ]);
    setTPanelMin(false);
    // Pool de 3 uploads en parallèle (rapide sans saturer).
    let idx = 0;
    const worker = async () => {
      while (idx < jobs.length) {
        const j = jobs[idx++]!;
        await uploadOne(j.item, destRel, j.id);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
    load(cwd);
    loadRoots();
  }
  async function newFolder() {
    const name = window.prompt('Nom du nouveau dossier :', 'Nouveau dossier');
    if (!name) return;
    await fetch('/api/files/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: cwd, name }),
    }).catch(() => {});
    load(cwd);
    loadRoots();
  }
  async function addCategory() {
    const name = window.prompt('Nom de la nouvelle catégorie :');
    if (!name) return;
    await fetch('/api/files/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '', name }),
    }).catch(() => {});
    loadRoots();
  }
  async function del(names: string[]) {
    if (!names.length) return;
    if (
      !window.confirm(
        names.length === 1
          ? `Placer « ${names[0]} » à la corbeille ?`
          : `Supprimer ${names.length} éléments ?`,
      )
    )
      return;
    for (const n of names)
      await fetch(`/api/files?path=${encodeURIComponent(join(cwd, n))}`, {
        method: 'DELETE',
      }).catch(() => {});
    load(cwd);
    loadRoots();
  }
  async function commitRename(oldName: string) {
    const newName = tempName.trim();
    setRenaming(null);
    if (!newName || newName === oldName) return;
    await fetch('/api/files', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: join(cwd, oldName), newName }),
    }).catch(() => {});
    load(cwd);
    loadRoots();
  }
  async function moveInto(names: string[], folderName: string) {
    const destDir = join(cwd, folderName);
    for (const n of names) {
      if (n === folderName) continue;
      await fetch('/api/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: join(cwd, n), destDir }),
      }).catch(() => {});
    }
    load(cwd);
    loadRoots();
  }

  /* ---------- Sélection ---------- */
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries;
    const s = [...list].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      let r = 0;
      if (sort.key === 'name') r = a.name.localeCompare(b.name);
      else if (sort.key === 'size') r = a.size - b.size;
      else if (sort.key === 'mtime') r = a.mtime - b.mtime;
      else r = kindOf(a).localeCompare(kindOf(b));
      return r * sort.dir;
    });
    return s;
  }, [entries, search, sort]);

  function clickEntry(e: React.MouseEvent, entry: Entry, index: number) {
    if (e.metaKey || e.ctrlKey) {
      setSel((prev) => {
        const n = new Set(prev);
        if (n.has(entry.name)) n.delete(entry.name);
        else n.add(entry.name);
        return n;
      });
    } else if (e.shiftKey && lastClick.current >= 0) {
      const [a, b] = [Math.min(lastClick.current, index), Math.max(lastClick.current, index)];
      setSel(new Set(shown.slice(a, b + 1).map((x) => x.name)));
    } else {
      setSel(new Set([entry.name]));
    }
    lastClick.current = index;
  }
  function openEntry(entry: Entry) {
    if (entry.type === 'folder') navigate(join(cwd, entry.name));
    else setQuick({ name: entry.name, path: join(cwd, entry.name) });
  }

  /* ---------- Clavier ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (renaming) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' && sel.size === 1) {
        e.preventDefault();
        const n = [...sel][0]!;
        const en = shown.find((x) => x.name === n);
        if (en) setQuick((q) => (q ? null : { name: en.name, path: join(cwd, en.name) }));
      } else if (e.key === 'Enter' && sel.size === 1) {
        const en = shown.find((x) => x.name === [...sel][0]);
        if (en) openEntry(en);
      } else if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        (e.metaKey || e.ctrlKey) &&
        sel.size
      ) {
        e.preventDefault();
        del([...sel]);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setSel(new Set(shown.map((x) => x.name)));
      } else if (e.key === 'Escape') {
        setQuick(null);
        setMenu(null);
        setSel(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, shown, renaming]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  /* ---------- Drag & drop ---------- */
  function onEntryDragStart(e: React.DragEvent, name: string) {
    const names = sel.has(name) ? [...sel] : [name];
    if (!sel.has(name)) setSel(new Set([name]));
    e.dataTransfer.setData('text/dev-move', JSON.stringify(names));
    e.dataTransfer.effectAllowed = 'move';
  }
  async function onDropTarget(e: React.DragEvent, folderName: string | 'ROOT') {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const moveData = e.dataTransfer.getData('text/dev-move');
    if (moveData) {
      const names: string[] = JSON.parse(moveData);
      if (folderName === 'ROOT') return; // déjà dans le dossier courant
      await moveInto(names, folderName);
    } else {
      const items = await collectDrop(e.dataTransfer);
      await doUpload(items, folderName === 'ROOT' ? cwd : join(cwd, folderName));
    }
  }

  const crumbs = cwd ? cwd.split('/') : [];

  /* ============================ Rendu ============================ */
  return (
    <div
      className="flex h-full overflow-hidden"
      style={
        {
          ['--color-accent' as string]: '#0a84ff',
          ['--color-accent-foreground' as string]: '#ffffff',
        } as React.CSSProperties
      }
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sidebar */}
      <aside className="flex w-48 shrink-0 flex-col gap-0.5 overflow-auto border-r border-border bg-surface-soft/70 px-2 py-3">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Favoris
          </span>
          <button
            onClick={addCategory}
            title="Ajouter une catégorie"
            className="rounded p-0.5 text-muted-foreground transition hover:bg-surface hover:text-foreground"
          >
            <PlusIcon />
          </button>
        </div>
        {[...DEFAULT_DIRS, ...roots.filter((r) => !DEFAULT_DIRS.includes(r))].map((name) => {
          const active = cwd === name || cwd.startsWith(`${name}/`);
          const over = dragOver === `SIDE:${name}`;
          return (
            <button
              key={name}
              onClick={() => navigate(name)}
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes('text/dev-move') ||
                  e.dataTransfer.types.includes('Files')
                ) {
                  e.preventDefault();
                  if (dragOver !== `SIDE:${name}`) setDragOver(`SIDE:${name}`);
                }
              }}
              onDragLeave={() => {
                if (over) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const md = e.dataTransfer.getData('text/dev-move');
                if (md) {
                  const ns: string[] = JSON.parse(md);
                  ns.forEach((n) => {
                    if (join(cwd, n) !== name)
                      fetch('/api/files', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: join(cwd, n), destDir: name }),
                      });
                  });
                  setTimeout(() => {
                    load(cwd);
                    loadRoots();
                  }, 150);
                } else {
                  collectDrop(e.dataTransfer).then((its) => doUpload(its, name));
                }
              }}
              className={`flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm transition ${over ? 'ring-2 ring-accent' : ''} ${active ? 'bg-accent/15 font-semibold text-accent' : 'hover:bg-surface'}`}
            >
              <SidebarIcon name={name} /> <span className="truncate">{name}</span>
            </button>
          );
        })}
      </aside>

      {/* Panneau principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <div className="flex items-center gap-0.5">
            <button
              onClick={back}
              disabled={!canBack}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-soft disabled:opacity-30"
              title="Précédent"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={fwd}
              disabled={!canFwd}
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-soft disabled:opacity-30"
              title="Suivant"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Fil d'Ariane */}
          <div className="flex min-w-0 items-center gap-0.5 text-sm">
            <button
              onClick={() => navigate('')}
              className={`rounded px-1.5 py-0.5 font-medium transition hover:bg-surface-soft ${cwd ? 'text-muted-foreground' : 'text-foreground'}`}
            >
              Accueil
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-0.5">
                <span className="text-muted-foreground">›</span>
                <button
                  onClick={() => navigate(crumbs.slice(0, i + 1).join('/'))}
                  className={`truncate rounded px-1.5 py-0.5 font-medium transition hover:bg-surface-soft ${i === crumbs.length - 1 ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {c}
                </button>
              </span>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Sélecteur de vue */}
            <div className="flex items-center gap-0.5 rounded-lg bg-surface-soft p-0.5">
              {(
                [
                  ['icons', 'Icônes'],
                  ['list', 'Liste'],
                  ['columns', 'Colonnes'],
                ] as [View, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={label}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${view === v ? 'bg-surface shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher"
              className="w-36 rounded-full border border-border bg-surface px-3 py-1 text-sm outline-none focus:border-accent"
            />
            <button
              onClick={newFolder}
              title="Nouveau dossier"
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm font-semibold transition hover:border-foreground"
            >
              Dossier
            </button>
            <button
              onClick={() => pickRef.current?.click()}
              className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accent"
            >
              Importer
            </button>
            <input
              ref={pickRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                void doUpload(
                  [...(e.target.files ?? [])].map((f) => ({ file: f, relPath: f.name })),
                );
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Contenu */}
        <div
          className={`relative min-h-0 flex-1 overflow-auto ${dragOver === 'ROOT' ? 'bg-accent/5' : 'bg-surface'}`}
          onClick={() => setSel(new Set())}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDragOver('ROOT');
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
          }}
          onDrop={(e) => onDropTarget(e, 'ROOT')}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY, entry: null });
          }}
        >
          {shown.length === 0 && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <FolderIcon size={54} />
              <p className="mt-3 font-medium">Dossier vide</p>
              <p className="mt-1 text-xs">Glissez des fichiers ou dossiers ici</p>
            </div>
          ) : view === 'icons' ? (
            <IconsView
              shown={shown}
              sel={sel}
              cwd={cwd}
              onClick={clickEntry}
              onOpen={openEntry}
              renaming={renaming}
              tempName={tempName}
              setTempName={setTempName}
              commitRename={commitRename}
              setRenaming={setRenaming}
              onDragStart={onEntryDragStart}
              onDropFolder={onDropTarget}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onMenu={(e, en) => {
                e.preventDefault();
                e.stopPropagation();
                setSel((s) => (s.has(en.name) ? s : new Set([en.name])));
                setMenu({ x: e.clientX, y: e.clientY, entry: en });
              }}
            />
          ) : view === 'list' ? (
            <ListView
              shown={shown}
              sel={sel}
              cwd={cwd}
              sort={sort}
              setSort={setSort}
              onClick={clickEntry}
              onOpen={openEntry}
              renaming={renaming}
              tempName={tempName}
              setTempName={setTempName}
              commitRename={commitRename}
              setRenaming={setRenaming}
              onDragStart={onEntryDragStart}
              onDropFolder={onDropTarget}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onMenu={(e, en) => {
                e.preventDefault();
                e.stopPropagation();
                setSel((s) => (s.has(en.name) ? s : new Set([en.name])));
                setMenu({ x: e.clientX, y: e.clientY, entry: en });
              }}
            />
          ) : (
            <ColumnsView
              root={cwd}
              onOpenFile={(p) => setQuick({ name: basename(p), path: p })}
              onNavigate={navigate}
            />
          )}
        </div>

        {/* Barre d'état */}
        <div className="flex items-center gap-3 border-t border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {shown.length} élément{shown.length > 1 ? 's' : ''}
            {sel.size ? ` · ${sel.size} sélectionné${sel.size > 1 ? 's' : ''}` : ''}
          </span>
          {/* Stockage total (bas-droite) */}
          <div className="ml-auto flex items-center gap-2">
            <span>
              {usage.files} fichiers · {usage.folders} dossiers
            </span>
            <div
              className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-soft"
              title={`${human(usage.bytes)} sur ${human(QUOTA)}`}
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (usage.bytes / QUOTA) * 100)}%` }}
              />
            </div>
            <span className="tabular-nums font-medium text-foreground">{human(usage.bytes)}</span>
            <span>/ {human(QUOTA)}</span>
          </div>
        </div>
      </div>

      {/* Menu contextuel */}
      {menu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-surface py-1 shadow-2xl"
          style={{
            left: Math.min(menu.x, window.innerWidth - 200),
            top: Math.min(menu.y, window.innerHeight - 260),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.entry ? (
            <>
              <MenuItem
                onClick={() => {
                  openEntry(menu.entry!);
                  setMenu(null);
                }}
              >
                Ouvrir
              </MenuItem>
              {menu.entry.type === 'file' && (
                <MenuItem
                  onClick={() => {
                    window.location.href = dl(join(cwd, menu.entry!.name));
                    setMenu(null);
                  }}
                >
                  Télécharger
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  setShare(menu.entry!);
                  setMenu(null);
                }}
              >
                Partager par lien…
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setRenaming(menu.entry!.name);
                  setTempName(menu.entry!.name);
                  setMenu(null);
                }}
              >
                Renommer
              </MenuItem>
              <div className="my-1 border-t border-border-soft" />
              <MenuItem
                danger
                onClick={() => {
                  del(sel.size > 1 && sel.has(menu.entry!.name) ? [...sel] : [menu.entry!.name]);
                  setMenu(null);
                }}
              >
                Supprimer
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem
                onClick={() => {
                  newFolder();
                  setMenu(null);
                }}
              >
                Nouveau dossier
              </MenuItem>
              <MenuItem
                onClick={() => {
                  pickRef.current?.click();
                  setMenu(null);
                }}
              >
                Importer des fichiers
              </MenuItem>
            </>
          )}
        </div>
      )}

      {/* Quick Look / Éditeur */}
      {quick && (
        <QuickLook
          path={quick.path}
          name={quick.name}
          onClose={() => setQuick(null)}
          onSaved={() => load(cwd)}
        />
      )}

      {/* Panneau de transfert (bas-droite, façon Google Drive) */}
      {transfers.length > 0 && (
        <TransferPanel
          transfers={transfers}
          minimized={tPanelMin}
          onToggle={() => setTPanelMin((v) => !v)}
          onClear={() => setTransfers([])}
        />
      )}

      {/* Dialogue « Partager par lien » (expiration 1 h – 24 h) */}
      {share && (
        <ShareDialog entry={share} path={join(cwd, share.name)} onClose={() => setShare(null)} />
      )}
    </div>
  );
}

/* ============================ Panneau de transfert ============================ */
function TransferPanel({
  transfers,
  minimized,
  onToggle,
  onClear,
}: {
  transfers: Transfer[];
  minimized: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  const active = transfers.filter((t) => t.status === 'uploading').length;
  const done = transfers.filter((t) => t.status === 'done').length;
  const err = transfers.filter((t) => t.status === 'error').length;
  const totalSize = transfers.reduce((s, t) => s + t.size, 0) || 1;
  const totalLoaded = transfers.reduce((s, t) => s + (t.status === 'done' ? t.size : t.loaded), 0);
  const pct = Math.round((totalLoaded / totalSize) * 100);
  const title =
    active > 0
      ? `Transfert de ${active} élément${active > 1 ? 's' : ''}… ${pct}%`
      : err > 0
        ? `${done} terminé${done > 1 ? 's' : ''}, ${err} en erreur`
        : `${done} transfert${done > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''}`;
  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
      <div className="flex items-center gap-2 bg-foreground px-3 py-2 text-white">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
        <button
          onClick={onToggle}
          title={minimized ? 'Agrandir' : 'Réduire'}
          className="rounded p-0.5 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            {minimized ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
          </svg>
        </button>
        <button
          onClick={onClear}
          title="Fermer"
          disabled={active > 0}
          className="rounded p-0.5 text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-30"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {!minimized && (
        <div className="max-h-72 overflow-auto py-1">
          {transfers.map((t) => {
            const p =
              t.status === 'done'
                ? 100
                : Math.min(100, Math.round((t.loaded / (t.size || 1)) * 100));
            return (
              <div key={t.id} className="flex items-center gap-2.5 px-3 py-1.5">
                <DocIcon size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {t.name}
                    </span>
                    {t.status === 'done' ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : t.status === 'error' ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                        {p}%
                      </span>
                    )}
                  </div>
                  {t.status !== 'done' && t.status !== 'error' && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-soft">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  )}
                  <div className="truncate text-[11px] text-muted-foreground">
                    {human(t.size)}
                    {t.status === 'error' ? ' · échec' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================ Dialogue de partage ============================ */
function ShareDialog({
  entry,
  path: relPath,
  onClose,
}: {
  entry: Entry;
  path: string;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(1);
  const [url, setUrl] = useState<string | null>(null);
  const [exp, setExp] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/files/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath, ttl: hours * 3600 }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || 'Échec');
        return;
      }
      setUrl(`${window.location.origin}${j.path}`);
      setExp(j.exp);
    } catch {
      setErr('Erreur réseau');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {entry.type === 'folder' ? <FolderIcon size={22} /> : <DocIcon size={22} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-foreground">
              Partager « {entry.name} »
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.type === 'folder'
                ? 'Le dossier sera téléchargé en .zip'
                : 'Lien de téléchargement direct'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-surface-soft hover:text-foreground"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Expire dans</div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 8, 12, 24].map((h) => (
              <button
                key={h}
                onClick={() => {
                  setHours(h);
                  setUrl(null);
                }}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${hours === h ? 'border-accent bg-accent text-white' : 'border-border text-foreground hover:border-foreground'}`}
              >
                {h} h
              </button>
            ))}
          </div>
        </div>

        {!url ? (
          <button
            onClick={generate}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Génération…' : 'Générer le lien'}
          </button>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-soft px-2 py-1.5">
              <input
                readOnly
                value={url}
                className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={copy}
                className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:opacity-90"
              >
                {copied ? 'Copié ✓' : 'Copier'}
              </button>
            </div>
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              Expire le{' '}
              {exp
                ? new Date(exp * 1000).toLocaleString([], {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}{' '}
              · quiconque a le lien peut télécharger.
            </div>
            <button
              onClick={() => {
                setUrl(null);
              }}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              Changer la durée
            </button>
          </div>
        )}
        {err && <div className="mt-2 text-xs font-medium text-[#ef4444]">{err}</div>}
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-sm transition hover:bg-accent hover:text-white ${danger ? 'text-[#ef4444]' : ''}`}
    >
      {children}
    </button>
  );
}

/* ============================ Vue Icônes ============================ */
function RenameInput({
  value,
  set,
  commit,
  cancel,
}: {
  value: string;
  set: (v: string) => void;
  commit: () => void;
  cancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => set(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') cancel();
      }}
      className="w-full rounded border border-accent bg-surface px-1 py-0.5 text-center text-xs outline-none"
    />
  );
}

interface ViewProps {
  shown: Entry[];
  sel: Set<string>;
  cwd: string;
  onClick: (e: React.MouseEvent, en: Entry, i: number) => void;
  onOpen: (en: Entry) => void;
  renaming: string | null;
  tempName: string;
  setTempName: (v: string) => void;
  commitRename: (n: string) => void;
  setRenaming: (n: string | null) => void;
  onDragStart: (e: React.DragEvent, n: string) => void;
  onDropFolder: (e: React.DragEvent, n: string) => void;
  dragOver: string | 'ROOT' | null;
  setDragOver: (v: string | 'ROOT' | null) => void;
  onMenu: (e: React.MouseEvent, en: Entry) => void;
}

function IconsView(p: ViewProps) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      {p.shown.map((en, i) => {
        const path = join(p.cwd, en.name);
        const selected = p.sel.has(en.name);
        const over = p.dragOver === en.name;
        return (
          <div
            key={en.name}
            draggable
            onDragStart={(e) => p.onDragStart(e, en.name)}
            onDragOver={(e) => {
              if (en.type === 'folder') {
                e.preventDefault();
                e.stopPropagation();
                if (p.dragOver !== en.name) p.setDragOver(en.name);
              }
            }}
            onDragLeave={() => {
              if (over) p.setDragOver(null);
            }}
            onDrop={(e) => {
              if (en.type === 'folder') p.onDropFolder(e, en.name);
            }}
            onClick={(e) => {
              e.stopPropagation();
              p.onClick(e, en, i);
            }}
            onDoubleClick={() => p.onOpen(en)}
            onContextMenu={(e) => p.onMenu(e, en)}
            className={`flex cursor-default flex-col items-center gap-1 rounded-lg p-2 ${over ? 'ring-2 ring-accent' : ''} ${selected ? 'bg-accent/15' : 'hover:bg-surface-soft'}`}
          >
            <div className="flex h-16 w-16 items-center justify-center">
              {en.type === 'folder' ? (
                <FolderIcon size={56} />
              ) : isImg(en.name) ? (
                <img
                  src={thumb(path)}
                  alt=""
                  className="max-h-16 max-w-16 rounded object-contain shadow-sm"
                  loading="lazy"
                />
              ) : (
                <DocIcon size={48} tint={isTxt(en.name) ? '#8fb0e6' : '#c7cdd6'} />
              )}
            </div>
            {p.renaming === en.name ? (
              <RenameInput
                value={p.tempName}
                set={p.setTempName}
                commit={() => p.commitRename(en.name)}
                cancel={() => p.setRenaming(null)}
              />
            ) : (
              <span
                className={`line-clamp-2 max-w-full break-words px-1 text-center text-xs ${selected ? 'rounded bg-accent px-1 text-white' : ''}`}
              >
                {en.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Vue Liste ============================ */
function ListView(
  p: ViewProps & {
    sort: { key: SortKey; dir: 1 | -1 };
    setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  },
) {
  const header = (key: SortKey, label: string, cls: string) => (
    <button
      onClick={() => p.setSort({ key, dir: p.sort.key === key ? (p.sort.dir === 1 ? -1 : 1) : 1 })}
      className={`flex items-center gap-1 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:text-foreground ${cls}`}
    >
      {label}
      {p.sort.key === key && <span>{p.sort.dir === 1 ? '▲' : '▼'}</span>}
    </button>
  );
  return (
    <div className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
      <div className="sticky top-0 z-[1] flex items-center gap-3 border-b border-border bg-surface px-2">
        {header('name', 'Nom', 'flex-1')}
        {header('mtime', 'Modifié le', 'w-32 hidden sm:flex')}
        {header('size', 'Taille', 'w-24 justify-end')}
        {header('kind', 'Type', 'w-32 hidden md:flex')}
      </div>
      {p.shown.map((en, i) => {
        const selected = p.sel.has(en.name);
        const over = p.dragOver === en.name;
        return (
          <div
            key={en.name}
            draggable
            onDragStart={(e) => p.onDragStart(e, en.name)}
            onDragOver={(e) => {
              if (en.type === 'folder') {
                e.preventDefault();
                e.stopPropagation();
                if (p.dragOver !== en.name) p.setDragOver(en.name);
              }
            }}
            onDragLeave={() => {
              if (over) p.setDragOver(null);
            }}
            onDrop={(e) => {
              if (en.type === 'folder') p.onDropFolder(e, en.name);
            }}
            onClick={(e) => {
              e.stopPropagation();
              p.onClick(e, en, i);
            }}
            onDoubleClick={() => p.onOpen(en)}
            onContextMenu={(e) => p.onMenu(e, en)}
            className={`flex cursor-default items-center gap-3 rounded-md px-2 py-1 text-sm ${over ? 'ring-2 ring-accent' : ''} ${selected ? 'bg-accent text-white' : 'hover:bg-surface-soft'}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0">
                {en.type === 'folder' ? (
                  <FolderIcon size={18} />
                ) : isImg(en.name) ? (
                  <img
                    src={thumb(join(p.cwd, en.name))}
                    alt=""
                    className="h-5 w-5 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <DocIcon size={16} />
                )}
              </span>
              {p.renaming === en.name ? (
                <RenameInput
                  value={p.tempName}
                  set={p.setTempName}
                  commit={() => p.commitRename(en.name)}
                  cancel={() => p.setRenaming(null)}
                />
              ) : (
                <span className="truncate">{en.name}</span>
              )}
            </div>
            <span
              className={`hidden w-32 text-xs sm:block ${selected ? 'text-white/80' : 'text-muted-foreground'}`}
            >
              {fmtDate(en.mtime)}
            </span>
            <span
              className={`w-24 text-right text-xs tabular-nums ${selected ? 'text-white/80' : 'text-muted-foreground'}`}
            >
              {human(en.size)}
            </span>
            <span
              className={`hidden w-32 truncate text-xs md:block ${selected ? 'text-white/80' : 'text-muted-foreground'}`}
            >
              {kindOf(en)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Vue Colonnes (Miller) ============================ */
function ColumnsView({
  root,
  onOpenFile,
  onNavigate,
}: {
  root: string;
  onOpenFile: (path: string) => void;
  onNavigate: (p: string) => void;
}) {
  const [cols, setCols] = useState<{ path: string; entries: Entry[] }[]>([]);
  const [picks, setPicks] = useState<string[]>([]);

  const loadCol = useCallback(async (path: string): Promise<Entry[]> => {
    const j = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .catch(() => ({ entries: [] }));
    return j.entries ?? [];
  }, []);

  useEffect(() => {
    (async () => {
      setCols([{ path: root, entries: await loadCol(root) }]);
      setPicks([]);
    })();
  }, [root, loadCol]);

  async function pick(colIdx: number, en: Entry) {
    const colPath = cols[colIdx]!.path;
    const full = join(colPath, en.name);
    const nextPicks = picks.slice(0, colIdx);
    nextPicks[colIdx] = en.name;
    setPicks(nextPicks);
    const base = cols.slice(0, colIdx + 1);
    if (en.type === 'folder') setCols([...base, { path: full, entries: await loadCol(full) }]);
    else {
      setCols(base);
      onOpenFile(full);
    }
  }

  return (
    <div className="flex h-full min-w-0" onClick={(e) => e.stopPropagation()}>
      {cols.map((col, ci) => (
        <div key={ci} className="h-full w-56 shrink-0 overflow-auto border-r border-border">
          {col.entries.map((en) => {
            const selected = picks[ci] === en.name;
            return (
              <button
                key={en.name}
                onClick={() => pick(ci, en)}
                onDoubleClick={() => en.type === 'folder' && onNavigate(join(col.path, en.name))}
                className={`flex w-full items-center gap-2 px-2 py-1 text-left text-sm ${selected ? 'bg-accent text-white' : 'hover:bg-surface-soft'}`}
              >
                <span className="shrink-0">
                  {en.type === 'folder' ? (
                    <FolderIcon size={16} />
                  ) : isImg(en.name) ? (
                    <img
                      src={thumb(join(col.path, en.name))}
                      alt=""
                      className="h-4 w-4 rounded object-cover"
                    />
                  ) : (
                    <DocIcon size={14} />
                  )}
                </span>
                <span className="truncate">{en.name}</span>
                {en.type === 'folder' && (
                  <span className={`ml-auto ${selected ? 'text-white' : 'text-muted-foreground'}`}>
                    ›
                  </span>
                )}
              </button>
            );
          })}
          {col.entries.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Vide</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================ Quick Look / Éditeur ============================ */
function QuickLook({
  path,
  name,
  onClose,
  onSaved,
}: {
  path: string;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editable = isTxt(name);
  const [text, setText] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (editable)
      fetch(thumb(path))
        .then((r) => r.text())
        .then((t) => setText(t))
        .catch(() => setText(''));
    // en mode édition, Espace ne ferme pas (on tape du texte) ; seul Échap ferme
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' && !editable && tag !== 'TEXTAREA') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path, name, onClose, editable]);

  async function save() {
    if (text == null) return;
    setSaving('saving');
    const res = await fetch('/api/files/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: text }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (res?.error) {
      alert(res.error);
      setSaving('idle');
      return;
    }
    setDirty(false);
    setSaving('saved');
    onSaved();
    window.setTimeout(() => setSaving('idle'), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="truncate text-sm font-semibold">
            {name}
            {dirty ? ' •' : ''}
          </span>
          <div className="flex items-center gap-2">
            {editable && (
              <button
                onClick={save}
                disabled={saving === 'saving' || (!dirty && saving !== 'saved')}
                className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
              >
                {saving === 'saving'
                  ? 'Enregistrement…'
                  : saving === 'saved'
                    ? 'Enregistré ✓'
                    : 'Enregistrer'}
              </button>
            )}
            <a
              href={dl(path)}
              className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:border-foreground"
            >
              Télécharger
            </a>
            <button
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-surface-soft"
              aria-label="Fermer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-surface-soft/50">
          {isImg(name) ? (
            <div className="p-4">
              <img
                src={thumb(path)}
                alt={name}
                className="mx-auto max-h-[70vh] rounded-lg object-contain shadow"
              />
            </div>
          ) : editable ? (
            <textarea
              value={text ?? ''}
              onChange={(e) => {
                setText(e.target.value);
                setDirty(true);
                setSaving('idle');
              }}
              spellCheck={false}
              className="h-[60vh] w-full resize-none bg-surface p-4 font-mono text-[13px] leading-relaxed text-foreground outline-none"
              placeholder={text == null ? 'Chargement…' : ''}
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground">
              <DocIcon size={48} />
              <p className="mt-2">Aperçu non disponible</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
