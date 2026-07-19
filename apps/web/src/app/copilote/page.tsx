'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getModels,
  getEmbeddingModels,
  getCopiloteSettings,
  updateCopiloteSettings,
  getCredits,
} from '@/lib/api';
import type { AiEmbeddingModel, AiModel, CopiloteSettingsView } from '@dowze/schemas';
import { useProfile } from '@/lib/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { TextField, SelectField } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Note } from '@/components/ui/note';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/page-header';
import { IconPlug } from '@/components/ui/icons';

export default function CopilotePage() {
  const { profileId, ready, signedIn } = useProfile();
  const [models, setModels] = useState<AiModel[]>([]);
  const [embModels, setEmbModels] = useState<AiEmbeddingModel[]>([]);
  const [settings, setSettings] = useState<CopiloteSettingsView | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState(false);

  // Form
  const [modelId, setModelId] = useState('');
  const [billing, setBilling] = useState<'credits' | 'byok'>('credits');
  const [keyInput, setKeyInput] = useState('');
  const [embModelId, setEmbModelId] = useState('');
  const [embKeyInput, setEmbKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const charger = useCallback(async () => {
    if (!profileId) return;
    setCharge(true);
    setErreur(false);
    try {
      const [ms, ems, s, b] = await Promise.all([
        getModels(),
        getEmbeddingModels(),
        getCopiloteSettings(profileId),
        getCredits(profileId).catch(() => ({ balance: 0 })),
      ]);
      setModels(ms);
      setEmbModels(ems);
      setSettings(s);
      setBalance(b.balance);
      setModelId(s.modelId);
      setBilling(s.billing);
      setEmbModelId(s.embeddingModelId ?? '');
    } catch {
      setErreur(true);
    } finally {
      setCharge(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (signedIn) charger();
  }, [signedIn, charger]);

  const selected = models.find((m) => m.id === modelId) ?? null;
  const embSelected = embModels.find((m) => m.id === embModelId) ?? null;
  const embNeedsKey = embSelected !== null;

  async function enregistrer() {
    if (!profileId) return;
    setSaving(true);
    setMsg('');
    try {
      const updated = await updateCopiloteSettings({
        profileId,
        modelId,
        billing,
        byokProvider: selected?.provider ?? null,
        byokApiKey: billing === 'byok' && keyInput.trim() ? keyInput.trim() : undefined,
        embeddingModelId: embModelId === '' ? null : embModelId,
        embeddingApiKey: embNeedsKey && embKeyInput.trim() ? embKeyInput.trim() : undefined,
      });
      setSettings(updated);
      setKeyInput('');
      setEmbKeyInput('');
      setMsg('Réglages du Copilote enregistrés ✓');
    } catch {
      setMsg('Échec de l’enregistrement. Réessaie.');
    } finally {
      setSaving(false);
    }
  }

  async function supprimerCle() {
    if (!profileId) return;
    setSaving(true);
    setMsg('');
    try {
      const updated = await updateCopiloteSettings({ profileId, byokApiKey: null });
      setSettings(updated);
      setMsg('Clé supprimée.');
    } catch {
      setMsg('Échec de la suppression.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon Copilote"
        subtitle="L’IA interne qui prépare tes prompts et lit tes résumés de séance. Choisis ton modèle et comment tu le paies."
      />

      {ready && !signedIn && (
        <EmptyState
          icon={<IconPlug />}
          title="Connecte-toi pour régler ton Copilote"
          description="Le Copilote structure tes séances et tient ta mémoire de progression."
          action={
            <Link href="/connexion">
              <Button>Se connecter</Button>
            </Link>
          }
        />
      )}

      {charge && <Skeleton className="h-64 w-full" />}
      {erreur && <Note tone="error">Impossible de charger tes réglages. Réessaie.</Note>}

      {signedIn && !charge && settings && (
        <>
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Le modèle du Copilote</CardTitle>
                <CardDescription>
                  Une petite IA guidée par Dowze. Elle n’enseigne pas — c’est ton IA (ChatGPT,
                  Claude…) qui enseigne.
                </CardDescription>
              </div>
              {billing === 'credits' && balance !== null && (
                <Badge tone={balance > 0 ? 'accent' : 'neutral'}>{Math.round(balance)} crédits</Badge>
              )}
            </div>

            <SelectField
              label="Modèle"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              hint={
                selected
                  ? `${selected.note}${selected.euHosted ? ' · hébergement UE (RGPD)' : ''}`
                  : undefined
              }
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Comment payer le Copilote"
              value={billing}
              onChange={(e) => setBilling(e.target.value as 'credits' | 'byok')}
              hint={
                billing === 'credits'
                  ? 'Crédits Dowze : tu recharges, Dowze fournit l’IA. ~0,2 centime par séance.'
                  : 'Ta propre clé API : gratuit pour Dowze, tu paies ton fournisseur directement.'
              }
            >
              <option value="credits">Crédits Dowze (recharge)</option>
              <option value="byok">Ma propre clé API (BYOK)</option>
            </SelectField>

            {billing === 'byok' && (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
                <TextField
                  label={`Clé API ${selected?.provider ?? ''}`}
                  type="password"
                  autoComplete="off"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={settings.hasByokKey ? '•••••••• (déjà enregistrée)' : 'sk-…'}
                  hint="Chiffrée au repos, jamais réaffichée. Elle ne sert qu’à tes propres séances."
                />
                {settings.hasByokKey && (
                  <Button variant="ghost" onClick={supprimerCle} disabled={saving}>
                    Supprimer ma clé
                  </Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={enregistrer} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <CardTitle>Mémoire sémantique (embeddings)</CardTitle>
              <CardDescription>
                Optionnel. Donne à Dowze une mémoire « par le sens » : regrouper des confusions
                formulées différemment et retrouver un épisode passé similaire. Sans embeddings, la
                mémoire fonctionne déjà (par mots-clés).
              </CardDescription>
            </div>

            <SelectField
              label="Modèle d’embedding"
              value={embModelId}
              onChange={(e) => setEmbModelId(e.target.value)}
              hint={
                embSelected
                  ? `${embSelected.pricePerM === 0 ? 'Gratuit (auto-hébergé)' : `${embSelected.pricePerM} $/M tokens`} · ${embSelected.dimensions} dim.${embSelected.euHosted ? ' · UE (RGPD)' : ''} — ${embSelected.note}`
                  : 'Désactivée : la mémoire reste par mots-clés.'
              }
            >
              <option value="">— Aucun (mémoire par mots-clés) —</option>
              {embModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} {m.pricePerM === 0 ? '· gratuit' : `· ${m.pricePerM} $/M`}
                </option>
              ))}
            </SelectField>

            {embNeedsKey && (
              <TextField
                label={`Clé API ${embSelected?.provider ?? ''} (embeddings)`}
                type="password"
                autoComplete="off"
                value={embKeyInput}
                onChange={(e) => setEmbKeyInput(e.target.value)}
                placeholder={settings.hasEmbeddingKey ? '•••••••• (déjà enregistrée)' : 'clé…'}
                hint="Chiffrée au repos. Peut être différente de la clé du Copilote."
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={enregistrer} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </Card>

          {billing === 'credits' && (
            <Card className="space-y-2">
              <CardTitle>Recharger mes crédits</CardTitle>
              <CardDescription>
                Le paiement par carte (Stripe) arrive bientôt. En attendant, tes crédits peuvent être
                ajoutés par l’équipe Dowze. 1 crédit ≈ 0,1 centime ; une séance coûte ~2 crédits.
              </CardDescription>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
