'use client';

import { useEffect, useState } from 'react';
import {
  createHiveAsset,
  createHiveComputeResource,
  getCompanionSpaces,
  getHiveAssets,
  getHiveVaultItems,
  getHiveComputeResources,
  updateHiveAssetStatus,
  type CompanionSpace,
  type HiveAsset,
  type HiveVaultItem,
  type HiveComputeResource,
} from '@/lib/api';
import { useProfile } from '@/lib/use-profile';

export default function InfrastructurePage() {
  const { signedIn } = useProfile();
  const [assets, setAssets] = useState<HiveAsset[]>([]);
  const [spaces, setSpaces] = useState<CompanionSpace[]>([]);
  const [vault, setVault] = useState<HiveVaultItem[]>([]);
  const [compute, setCompute] = useState<HiveComputeResource[]>([]);
  const [space, setSpace] = useState('home');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<HiveAsset['assetType']>('server');
  const [purpose, setPurpose] = useState('');
  const [vaultItemId, setVaultItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [computeName, setComputeName] = useState('');
  const [computeKind, setComputeKind] = useState<HiveComputeResource['kind']>('cpu');
  const [error, setError] = useState('');

  async function refresh() {
    const [nextAssets, nextSpaces, nextVault, nextCompute] = await Promise.all([
      getHiveAssets(),
      getCompanionSpaces(),
      getHiveVaultItems(),
      getHiveComputeResources(),
    ]);
    setAssets(nextAssets);
    setSpaces(nextSpaces);
    setVault(nextVault);
    setCompute(nextCompute);
  }

  async function addCompute() {
    if (!computeName.trim()) return;
    setBusy(true);
    try {
      await createHiveComputeResource({
        name: computeName.trim(),
        kind: computeKind,
        locality: 'local',
        modalities: computeKind === 'gpu' ? ['text', 'image', 'audio', '3d'] : ['text'],
      });
      setComputeName('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (signedIn) void refresh().catch(() => setError("L'inventaire est indisponible."));
  }, [signedIn]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createHiveAsset({
        space,
        name: name.trim(),
        assetType,
        purpose,
        vaultItemId: vaultItemId || undefined,
      });
      setName('');
      setPurpose('');
      await refresh();
    } catch {
      setError("L'actif n'a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-3xl font-black tracking-tight">Infrastructure visuelle</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Chaque objet correspond à un actif réel de la Maison ou d’une organisation. Les accès ne
        sont jamais stockés ici : l’objet référence seulement un secret chiffré du coffre.
      </p>
      {!signedIn && (
        <p className="mt-8 rounded-2xl border p-5">Connecte-toi pour voir tes actifs.</p>
      )}
      {error && (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">{error}</p>
      )}
      {signedIn && (
        <>
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="grid gap-3 sm:grid-cols-2">
              {assets.map((asset) => (
                <article
                  key={asset.id}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`/furniture/${asset.visualKey}.png`}
                      alt=""
                      className="h-14 w-14 object-contain"
                    />
                    <div>
                      <h2 className="font-bold">{asset.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {asset.assetType} · {asset.environment}
                      </p>
                    </div>
                    <span className="ml-auto text-xs font-semibold">{asset.status}</span>
                  </div>
                  <p className="mt-3 text-sm">{asset.purpose || 'Aucune finalité décrite.'}</p>
                  {asset.vaultItemId && (
                    <p className="mt-2 text-xs text-emerald-700">Accès protégé par le coffre</p>
                  )}
                  <select
                    value={asset.status}
                    onChange={(event) =>
                      void updateHiveAssetStatus(
                        asset.id,
                        event.target.value as HiveAsset['status'],
                      ).then(refresh)
                    }
                    className="mt-4 rounded-lg border bg-transparent px-2 py-1 text-xs"
                  >
                    <option value="healthy">healthy</option>
                    <option value="degraded">degraded</option>
                    <option value="offline">offline</option>
                    <option value="unknown">unknown</option>
                  </select>
                </article>
              ))}
            </section>
            <aside className="h-fit rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-bold">Ajouter un actif</h2>
              <label className="mt-4 block text-sm font-semibold">Espace</label>
              <select
                value={space}
                onChange={(event) => setSpace(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"
              >
                <option value="home">Maison</option>
                {spaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <label className="mt-4 block text-sm font-semibold">Nom</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"
              />
              <label className="mt-4 block text-sm font-semibold">Type</label>
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value as HiveAsset['assetType'])}
                className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"
              >
                {['server', 'database', 'firewall', 'vps', 'service', 'device', 'other'].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
              </select>
              <label className="mt-4 block text-sm font-semibold">Finalité</label>
              <textarea
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"
              />
              <label className="mt-4 block text-sm font-semibold">Secret associé</label>
              <select
                value={vaultItemId}
                onChange={(event) => setVaultItemId(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-transparent px-3 py-2"
              >
                <option value="">Aucun</option>
                {vault.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !name.trim()}
                onClick={() => void add()}
                className="mt-4 w-full rounded-xl bg-accent px-3 py-2 font-bold text-accent-foreground disabled:opacity-50"
              >
                Créer l’objet
              </button>
            </aside>
          </div>
          <section className="mt-8 rounded-2xl border bg-surface p-5">
            <h2 className="text-xl font-bold">Ressources de calcul</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Le scheduler choisit un nœud sain selon modalité, mémoire, confidentialité, charge et
              coût.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {compute.map((resource) => (
                <div key={resource.id} className="rounded-xl border p-3 text-sm">
                  <strong>{resource.name}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {resource.kind} · {resource.locality} · {resource.activeAllocations}/
                    {resource.maxConcurrency}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={computeName}
                onChange={(event) => setComputeName(event.target.value)}
                placeholder="Nom du nœud"
                className="rounded-xl border bg-transparent px-3 py-2 text-sm"
              />
              <select
                value={computeKind}
                onChange={(event) =>
                  setComputeKind(event.target.value as HiveComputeResource['kind'])
                }
                className="rounded-xl border bg-transparent px-3 py-2 text-sm"
              >
                {['cpu', 'gpu', 'npu', 'remote_api'].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <button
                disabled={busy || !computeName.trim()}
                onClick={() => void addCompute()}
                className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"
              >
                Ajouter au scheduler
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
