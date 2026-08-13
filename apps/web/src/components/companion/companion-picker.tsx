'use client';

import { useEffect, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { CodexPet } from '@/components/companion/codex-pet';
import { CompanionCam } from '@/components/companion/companion-cam';
import { World } from '@/components/companion/companion-worlds';
import {
  companionPetUrl,
  deleteCompanionPet,
  installCompanionPet,
  listCompanionPets,
  renameCompanionPet,
  type CompanionPetItem,
} from '@/lib/api';
import {
  ANIM_LABELS,
  CAM_MAX_SIZE,
  CAM_MIN_SIZE,
  COMPANION_MAX_SIZE,
  COMPANION_MIN_SIZE,
  CURATED_PETS,
  PET_SITES,
  WORLDS,
  curatedSheetUrl,
  useCompanionPet,
} from '@/lib/companion-pet';

const MAX_PETS = 50;

/** Extrait l'id de pet d'une URL servie par l'API (`/companion/pet/<id>?v=`). */
function petIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.match(/\/companion\/pet\/([0-9a-fA-F-]{36})/)?.[1] ?? null;
}

/**
 * Choix du compagnon — perso à chaque compte : taille · aperçu des 9 animations du pet choisi ·
 * pets de l'app · **Nos pets** (bibliothèque importée, gérable) · import (.zip/fichier) · liens.
 */
export function CompanionPicker() {
  const url = useCompanionPet((s) => s.url);
  const hidden = useCompanionPet((s) => s.hidden);
  const size = useCompanionPet((s) => s.size);
  const world = useCompanionPet((s) => s.world);
  const camSize = useCompanionPet((s) => s.camSize);
  const companionName = useCompanionPet((s) => s.companionName);
  const setCompanionName = useCompanionPet((s) => s.setCompanionName);
  const setUrl = useCompanionPet((s) => s.setUrl);
  const setHidden = useCompanionPet((s) => s.setHidden);
  const setSize = useCompanionPet((s) => s.setSize);
  const setWorld = useCompanionPet((s) => s.setWorld);
  const setCamSize = useCompanionPet((s) => s.setCamSize);

  const [library, setLibrary] = useState<CompanionPetItem[]>([]);
  const [previewAnim, setPreviewAnim] = useState('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ok, setOk] = useState('');

  const activeUrl = hidden ? null : url;
  const activePetId = petIdFromUrl(activeUrl);

  async function refreshLibrary() {
    try {
      setLibrary(await listCompanionPets());
    } catch {
      /* non connecté / réseau : on garde ce qu'on a */
    }
  }
  useEffect(() => {
    void refreshLibrary();
  }, []);

  // Ferme le menu contextuel au clic ailleurs / au défilement / avec Échap.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  async function importFile(file: File) {
    setBusy(true);
    setErreur('');
    setOk('');
    try {
      const { id, name, version } = await installCompanionPet(
        (() => {
          const f = new FormData();
          f.append('file', file);
          return f;
        })(),
      );
      setUrl(companionPetUrl(id, version)); // sélectionne le nouveau pet
      setOk(`« ${name} » ajouté !`);
      await refreshLibrary();
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  function startRename(pet: CompanionPetItem) {
    setEditingId(pet.id);
    setEditName(pet.name);
  }
  async function saveRename() {
    const id = editingId;
    const name = editName.trim();
    setEditingId(null);
    if (!id || !name) return;
    try {
      await renameCompanionPet(id, name);
      await refreshLibrary();
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }
  async function removeMany(ids: string[]) {
    if (ids.length === 0) return;
    setSelected(new Set());
    try {
      await Promise.all(ids.map((id) => deleteCompanionPet(id)));
      if (activePetId && ids.includes(activePetId)) setUrl(curatedSheetUrl(CURATED_PETS[0]!.slug)); // pet actif retiré → défaut
      await refreshLibrary();
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e));
    }
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const tile = (active: boolean) =>
    `flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
      active ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted'
    }`;

  return (
    <Card className="space-y-4">
      <CardTitle>Mon compagnon</CardTitle>

      {/* Nom du compagnon (persona) — distinct du nom d'un pet */}
      <div className="rounded-xl border border-border p-3">
        <div className="text-sm font-medium">Nom du compagnon</div>
        <input
          value={companionName}
          onChange={(e) => setCompanionName(e.target.value.slice(0, 40))}
          placeholder="Dowze"
          maxLength={40}
          aria-label="Nom du compagnon"
          className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>

      {/* Taille */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Taille</span>
          <span className="tabular-nums text-muted-foreground">{size} px</span>
        </div>
        <input
          type="range"
          min={COMPANION_MIN_SIZE}
          max={COMPANION_MAX_SIZE}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="mt-1 w-full accent-accent"
          aria-label="Taille du compagnon"
        />
      </div>

      {/* Aperçu des animations du pet choisi */}
      {activeUrl && (
        <div className="rounded-xl border border-border p-3">
          <div className="text-sm font-medium">Aperçu</div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            {/* Gauche : les 9 animations */}
            <div className="grid grid-cols-3 gap-1.5 sm:w-1/2">
              {ANIM_LABELS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setPreviewAnim(a.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 transition ${
                    previewAnim === a.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className="flex h-11 items-center justify-center">
                    <CodexPet url={activeUrl} animId={a.id} size={40} />
                  </span>
                  <span className="text-[10px] font-medium">{a.label}</span>
                </button>
              ))}
            </div>
            {/* Droite : grand aperçu taille réelle */}
            <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-3">
              <CodexPet url={activeUrl} animId={previewAnim} size={size} />
              <span className="mt-2 text-xs text-muted-foreground">
                {ANIM_LABELS.find((a) => a.id === previewAnim)?.label} · {size} px
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mode cam : aperçu + décor (« monde ») + taille de la tuile. Le mode s'activera
          automatiquement en session de travail (à venir) ; ici on le prépare. */}
      <div className="rounded-xl border border-border p-3">
        <div className="text-sm font-medium">Mode cam</div>
        {activeUrl && (
          <div className="mt-3 flex justify-center">
            <CompanionCam
              url={activeUrl}
              animId="idle"
              world={world}
              size={Math.min(camSize, 260)}
              name={companionName}
            />
          </div>
        )}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Taille de la cam</span>
            <span className="tabular-nums text-muted-foreground">{camSize} px</span>
          </div>
          <input
            type="range"
            min={CAM_MIN_SIZE}
            max={CAM_MAX_SIZE}
            value={camSize}
            onChange={(e) => setCamSize(Number(e.target.value))}
            className="mt-1 w-full accent-accent"
            aria-label="Taille de la cam"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WORLDS.map((wld) => (
            <button
              key={wld.id}
              onClick={() => setWorld(wld.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                world === wld.id ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted'
              }`}
            >
              <span className="relative block h-14 w-full overflow-hidden rounded-lg">
                <World id={wld.id} />
              </span>
              <span className="text-[11px] font-medium">{wld.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pets de l'application (curés) + Aucun */}
      <div className="rounded-xl border border-border p-3">
        <div className="mb-2 text-sm font-medium">Pets de Dowze</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button onClick={() => setHidden(true)} className={tile(hidden)}>
            <span className="flex h-16 w-16 items-center justify-center text-muted-foreground">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M5.6 5.6l12.8 12.8" />
              </svg>
            </span>
            <span className="text-xs font-medium">Aucun</span>
          </button>
          {CURATED_PETS.map((p) => {
            const u = curatedSheetUrl(p.slug);
            return (
              <button key={p.slug} onClick={() => setUrl(u)} className={tile(!hidden && url === u)}>
                <span className="flex h-16 items-center justify-center">
                  <CodexPet url={u} animId="idle" size={60} />
                </span>
                <span className="text-xs font-medium">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Nos pets : clic = choisir · clic droit = menu · sélection multiple pour supprimer en lot */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Nos pets</div>
          {selected.size > 0 ? (
            <span className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => void removeMany([...selected])}
                className="font-medium text-red-600 hover:underline"
              >
                Supprimer
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-muted-foreground hover:underline"
              >
                Annuler
              </button>
            </span>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground">
              {library.length}/{MAX_PETS}
            </span>
          )}
        </div>
        {library.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Aucun pet importé.</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {library.map((pet) => {
              const isSel = selected.has(pet.id);
              return (
                <div
                  key={pet.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ id: pet.id, x: e.clientX, y: e.clientY });
                  }}
                  onClick={() => (selected.size > 0 ? toggleSelect(pet.id) : setUrl(pet.url))}
                  className={`relative cursor-pointer ${tile(activePetId === pet.id)} ${isSel ? 'ring-2 ring-accent' : ''}`}
                >
                  {isSel && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                  <span className="flex h-16 items-center justify-center">
                    <CodexPet url={pet.url} animId="idle" size={56} />
                  </span>
                  {editingId === pet.id ? (
                    <input
                      value={editName}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveRename();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => void saveRename()}
                      maxLength={60}
                      className="w-full rounded border border-border px-1.5 py-0.5 text-center text-xs"
                    />
                  ) : (
                    <span className="max-w-full truncate text-xs font-medium">{pet.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Importer un pet : input natif + glisser-déposer */}
      <div className="rounded-xl border border-border p-3">
        <div className="text-sm font-medium">Importer un pet</div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void importFile(f);
          }}
          className={`mt-2 rounded-xl border-2 border-dashed p-4 text-center transition ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border'
          }`}
        >
          <input
            type="file"
            accept=".zip,application/zip,image/webp,image/png"
            disabled={busy || library.length >= MAX_PETS}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
            className="mx-auto block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-accent file:px-5 file:py-2 file:font-medium file:text-accent-foreground hover:file:bg-accent-active disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {busy
              ? 'Import…'
              : library.length >= MAX_PETS
                ? `Limite de ${MAX_PETS} atteinte`
                : 'ou glisse le fichier ici'}
          </p>
        </div>
      </div>

      {/* Où trouver des pets */}
      <div className="rounded-xl border border-border p-3">
        <div className="text-sm font-medium">Où trouver des pets</div>
        <ul className="mt-2 flex flex-wrap gap-2">
          {PET_SITES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.note}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                {s.name}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Menu contextuel (clic droit sur un pet) */}
      {menu &&
        (() => {
          const pet = library.find((p) => p.id === menu.id);
          if (!pet) return null;
          const isSel = selected.has(pet.id);
          const item = 'block w-full px-3 py-1.5 text-left text-sm hover:bg-muted';
          return (
            <div
              className="fixed z-[100] min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
              style={{ left: menu.x, top: menu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={item}
                onClick={() => {
                  setUrl(pet.url);
                  setMenu(null);
                }}
              >
                Choisir comme compagnon
              </button>
              <button
                className={item}
                onClick={() => {
                  toggleSelect(pet.id);
                  setMenu(null);
                }}
              >
                {isSel ? 'Désélectionner' : 'Sélectionner'}
              </button>
              <button
                className={item}
                onClick={() => {
                  startRename(pet);
                  setMenu(null);
                }}
              >
                Renommer
              </button>
              <button
                className={`${item} text-red-600`}
                onClick={() => {
                  void removeMany([pet.id]);
                  setMenu(null);
                }}
              >
                Supprimer
              </button>
            </div>
          );
        })()}

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      {ok && <p className="text-xs text-emerald-600">{ok}</p>}
    </Card>
  );
}
