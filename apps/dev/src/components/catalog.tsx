'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ASSETS,
  CATEGORIES,
  KIND_LABEL,
  METHOD_NOTE,
  assetsByCategory,
  buildPrompt,
  buildRefPrompt,
  fileName,
  type Asset,
  type Category,
} from '@/lib/assets';

const DOT: Record<string, string> = {
  lime: '#bce06a',
  lilac: '#b79cf0',
  cream: '#e6d089',
  pink: '#e6a6a6',
  mint: '#8fd39a',
  coral: '#efab86',
};

function IconMaximize() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}
function IconX() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CopyBtn({
  text,
  label,
  primary,
  big,
}: {
  text: string;
  label: string;
  primary?: boolean;
  big?: boolean;
}) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      window.setTimeout(() => setOk(false), 1100);
    } catch {
      /* clipboard indispo */
    }
  };
  const base = `rounded-lg font-semibold transition ${big ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`;
  const cls = ok
    ? `${base} bg-success/10 text-success`
    : primary
      ? `${base} bg-foreground text-white hover:bg-accent`
      : `${base} border border-border text-foreground hover:border-foreground`;
  return (
    <button type="button" onClick={copy} className={cls}>
      {ok ? 'Copié' : label}
    </button>
  );
}

function AssetCard({
  asset,
  done,
  onToggle,
  onOpen,
}: {
  asset: Asset;
  done: boolean;
  onToggle: (v: boolean) => void;
  onOpen: () => void;
}) {
  const name = fileName(asset);
  const prompt = useMemo(() => buildPrompt(asset), [asset]);
  return (
    <div
      className={`flex flex-col rounded-xl border border-border bg-surface p-3 transition ${done ? 'opacity-55' : 'hover:border-foreground/30'}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--color-accent)]"
        />
        <span
          className={`flex-1 truncate text-sm font-semibold ${done ? 'line-through' : ''}`}
          title={asset.label}
        >
          {asset.label}
        </span>
        <button
          type="button"
          onClick={onOpen}
          title="Agrandir"
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-soft hover:text-foreground"
        >
          <IconMaximize /> Plus
        </button>
      </div>

      <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {KIND_LABEL[asset.kind]}
      </span>

      <code
        className="mt-2 block truncate rounded-md bg-surface-soft px-2 py-1 font-mono text-[11px] text-muted-foreground"
        title={name}
      >
        {name}
      </code>

      <div className="mt-2 flex items-center gap-1.5">
        <CopyBtn text={prompt} label="Copier le prompt" primary />
        <CopyBtn text={name} label="Nom" />
      </div>

      {/* Prompt toujours déroulé */}
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-soft p-2 text-[11px] leading-snug text-foreground/80">
        {prompt}
      </pre>
    </div>
  );
}

function AssetModal({
  asset,
  cat,
  done,
  onToggle,
  onClose,
}: {
  asset: Asset;
  cat?: Category;
  done: boolean;
  onToggle: (v: boolean) => void;
  onClose: () => void;
}) {
  const name = fileName(asset);
  const prompt = useMemo(() => buildPrompt(asset), [asset]);
  const refPrompt = useMemo(() => buildRefPrompt(asset), [asset]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-bold">{asset.label}</h2>
              {cat && (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: DOT[cat.block] }} />{' '}
                  {cat.label} · {cat.zone}
                </span>
              )}
              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {KIND_LABEL[asset.kind]}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="font-mono text-xs text-muted-foreground">{name}</code>
              <CopyBtn text={name} label="Copier le nom" />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-surface-soft hover:text-foreground"
          >
            <IconX />
          </button>
        </div>

        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-accent)]"
          />
          {done ? 'Créé' : 'Marquer comme créé'}
        </label>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-auto pr-1">
          {/* Prompt principal (1er asset / ancre) */}
          <div className="rounded-xl bg-surface-soft p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Prompt — 1er asset / ancre
              </span>
              <CopyBtn text={prompt} label="Copier le prompt" primary />
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {prompt}
            </pre>
          </div>

          {/* Variante cohérence (avec image de référence) */}
          <div className="rounded-xl border border-dashed border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Variante cohérence — joins l’ancre
              </span>
              <CopyBtn text={refPrompt} label="Copier la variante" />
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/80">
              {refPrompt}
            </pre>
          </div>

          <p className="border-t border-border-soft pt-3 text-[11px] leading-snug text-muted-foreground">
            {METHOD_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Catalog() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [hideDone, setHideDone] = useState(false);
  const [modal, setModal] = useState<Asset | null>(null);

  useEffect(() => {
    fetch('/api/todo')
      .then((r) => (r.ok ? r.json() : { done: {} }))
      .then((j) => setDone(j.done ?? {}))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function toggle(asset: Asset, v: boolean) {
    const key = fileName(asset);
    setDone((d) => ({ ...d, [key]: v }));
    fetch('/api/todo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: key, done: v }),
    }).catch(() => {});
  }

  const q = search.trim().toLowerCase();
  const total = ASSETS.length;
  const doneCount = ASSETS.filter((a) => done[fileName(a)]).length;
  const catDone = (id: string) => assetsByCategory(id).filter((a) => done[fileName(a)]).length;

  function visible(list: Asset[]): Asset[] {
    return list.filter((a) => {
      if (hideDone && done[fileName(a)]) return false;
      if (!q) return true;
      return a.label.toLowerCase().includes(q) || a.id.includes(q);
    });
  }

  const shownCats = cat === 'all' ? CATEGORIES : CATEGORIES.filter((c) => c.id === cat);
  const activeLabel = cat === 'all' ? 'Tout' : (CATEGORIES.find((c) => c.id === cat)?.label ?? '');
  const modalCat = modal ? CATEGORIES.find((c) => c.id === modal.category) : undefined;

  const navItem = (id: string, label: string, d: number, t: number, dot?: string) => {
    const active = cat === id;
    return (
      <button
        key={id}
        onClick={() => setCat(id)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
          active
            ? 'bg-surface-soft font-semibold'
            : 'text-muted-foreground hover:bg-surface-soft hover:text-foreground'
        }`}
      >
        {dot ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-border" />
        )}
        <span className="flex-1 truncate">{label}</span>
        <span
          className={`shrink-0 text-xs tabular-nums ${d === t && t > 0 ? 'text-success' : 'text-muted-foreground'}`}
        >
          {d}/{t}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Barre latérale gauche */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums">{doneCount}</span>
            <span className="text-sm text-muted-foreground">/ {total} assets créés</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-soft">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="px-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 overflow-auto px-3 py-1">
          {navItem('all', 'Tout', doneCount, total)}

          {/* Groupe : Image (toutes les catégories de génération d'image) */}
          <div className="mb-1 mt-3 flex items-center gap-2 px-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Image
            </span>
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
              {doneCount}/{total}
            </span>
          </div>
          {CATEGORIES.map((c) =>
            navItem(c.id, c.label, catDone(c.id), assetsByCategory(c.id).length, DOT[c.block]),
          )}
        </nav>

        <div className="border-t border-border px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="h-3.5 w-3.5 accent-[color:var(--color-accent)]"
            />
            Masquer les créés
          </label>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/90 px-6 py-3 backdrop-blur">
          <h1 className="text-lg font-bold">{activeLabel}</h1>
        </div>

        <div className="px-6 py-5">
          {shownCats.map((c) => {
            const list = visible(assetsByCategory(c.id));
            if (!list.length) return null;
            return (
              <section key={c.id} className="mb-7">
                {cat === 'all' && (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: DOT[c.block] }} />
                    <h2 className="text-base font-bold">{c.label}</h2>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {c.zone}
                    </span>
                    <span className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">
                      {catDone(c.id)}/{assetsByCategory(c.id).length}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((a) => (
                    <AssetCard
                      key={a.id}
                      asset={a}
                      done={!!done[fileName(a)]}
                      onToggle={(v) => toggle(a, v)}
                      onOpen={() => setModal(a)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {loaded && shownCats.every((c) => visible(assetsByCategory(c.id)).length === 0) && (
            <p className="py-12 text-center text-sm text-muted-foreground">Aucun asset.</p>
          )}
          {!loaded && (
            <p className="py-12 text-center text-sm text-muted-foreground">Chargement…</p>
          )}
        </div>
      </main>

      {modal && (
        <AssetModal
          asset={modal}
          cat={modalCat}
          done={!!done[fileName(modal)]}
          onToggle={(v) => toggle(modal, v)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
