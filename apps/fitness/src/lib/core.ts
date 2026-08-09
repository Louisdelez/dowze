import { DowzeClient } from '@dowze/api-client';
import { getSupabase } from '@dowze/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.dowze.ch';
export const FITNESS_SLUG = 'fitness';
const RECURRING_REF = 'workout-main';

/** SDK typé vers le cœur Dowze (identité = session partagée). Prouve `@dowze/api-client`. */
export const core = new DowzeClient({
  baseUrl: API_BASE,
  getAccessToken: async () => {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  },
});

/** En-tête d'identité d'app (le middleware de scopes résout le plugin par ce slug). */
const pluginHeader = { 'x-dowze-plugin': FITNESS_SLUG };

export interface FitnessConfig {
  frequencyPerWeek: number;
  healthConsent: boolean;
  healthConsentAt?: string;
}

export interface CataloguePlugin {
  id: string;
  slug: string;
  name: string;
  scopesRequested: string[];
  scopesOptional: string[];
  activation: { enabled: boolean; grantedScopes: string[]; config: Record<string, unknown> } | null;
}

/** Catalogue + état d'activation du profil (on y lit l'entrée « fitness »). */
export async function myPlugins(profileId: string): Promise<CataloguePlugin[]> {
  return core.request<CataloguePlugin[]>(`/v1/plugins/mine/${profileId}`);
}

/** Active le plugin (octroi de scopes + config) — première activation ou mise à jour de la config. */
export async function activateFitness(
  pluginId: string,
  profileId: string,
  grantedScopes: string[],
  config: FitnessConfig,
): Promise<unknown> {
  return core.request(`/v1/plugins/${pluginId}/activate`, {
    method: 'POST',
    body: JSON.stringify({ profileId, grantedScopes, config }),
  });
}

export async function deactivateFitness(pluginId: string, profileId: string): Promise<unknown> {
  return core.request(`/v1/plugins/${pluginId}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

/** Déclare l'activité récurrente « séance de sport » → apparaît dans le planning académie (P2). */
export async function declareWorkout(profileId: string, frequencyPerWeek: number): Promise<unknown> {
  return core.request('/v1/calendar/recurring', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: FITNESS_SLUG,
      sourceRef: RECURRING_REF,
      type: 'fitness.workout',
      title: 'Séance de sport',
      frequencyPerWeek,
      durationMin: 50,
      intensity: 'moderee',
      hardConstraints: { minRestDaysPerWeek: 1, weeklyCapMin: 300, minRecoveryHoursSameType: 48 },
      softPreferences: { cognitiveBoostBeforeStudy: true },
    }),
  });
}

export async function removeWorkout(profileId: string): Promise<unknown> {
  return core.request(`/v1/calendar/recurring/${profileId}/${FITNESS_SLUG}/${RECURRING_REF}`, {
    method: 'DELETE',
  });
}

/** compose (P3) : contexte → prompt lisible à donner à SON IA (ChatGPT/Claude). */
export async function composeSession(
  profileId: string,
  body: { title: string; goal?: string; level?: string; context?: { label: string; value: string }[] },
): Promise<{ prompt: string; closingPrompt: string }> {
  return core.request('/v1/ai/compose', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({ profileId, sourceApp: FITNESS_SLUG, ...body }),
  });
}

/** ingest (P3) : résumé libre → snapshot structuré (via l'IA de Dowze, crédits/BYOK). */
export async function ingestSession(
  profileId: string,
  summary: string,
): Promise<{ snapshot: Record<string, unknown>; creditsSpent: number }> {
  return core.request('/v1/ai/ingest', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: FITNESS_SLUG,
      summary,
      fields: [
        { key: 'exercices', type: 'stringArray', description: 'exercices réalisés' },
        { key: 'dureeMin', type: 'integer', description: 'durée en minutes' },
        { key: 'ressenti', type: 'string', description: 'ressenti global' },
        { key: 'intensitePercue', type: 'string', description: 'intensité perçue : facile, moyen ou dur' },
      ],
    }),
  });
}

// ─── Données propres au plugin (schéma `fitness`, RLS — le plugin possède sa donnée) ───

export interface FitnessSessionRow {
  id: string;
  done_at: string;
  title: string;
  summary: string;
  snapshot: Record<string, unknown>;
}

export async function listSessions(profileId: string): Promise<FitnessSessionRow[]> {
  const { data } = await getSupabase()
    .from('fitness_sessions')
    .select('id, done_at, title, summary, snapshot')
    .eq('profile_id', profileId)
    .order('done_at', { ascending: false })
    .limit(30);
  return (data ?? []) as FitnessSessionRow[];
}

export async function saveSession(
  profileId: string,
  row: { title: string; summary: string; snapshot: Record<string, unknown> },
): Promise<void> {
  await getSupabase().from('fitness_sessions').insert({
    profile_id: profileId,
    title: row.title,
    summary: row.summary,
    snapshot: row.snapshot,
  });
}
