import { DowzeClient } from '@dowze/api-client';
import { getSupabase } from '@dowze/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.dowze.ch';
export const ALIM_SLUG = 'alimentations';
const PREP_REF = 'mealprep-main';

export const core = new DowzeClient({
  baseUrl: API_BASE,
  getAccessToken: async () => {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  },
});

const pluginHeader = { 'x-dowze-plugin': ALIM_SLUG };

export interface AlimConfig {
  mealsPerDay: number;
  prepPerWeek: number;
}

export interface CataloguePlugin {
  id: string;
  slug: string;
  name: string;
  scopesRequested: string[];
  scopesOptional: string[];
  activation: { enabled: boolean; grantedScopes: string[]; config: Record<string, unknown> } | null;
}

export async function myPlugins(profileId: string): Promise<CataloguePlugin[]> {
  return core.request<CataloguePlugin[]>(`/v1/plugins/mine/${profileId}`);
}

export async function activateAlim(
  pluginId: string,
  profileId: string,
  grantedScopes: string[],
  config: AlimConfig,
): Promise<unknown> {
  return core.request(`/v1/plugins/${pluginId}/activate`, {
    method: 'POST',
    body: JSON.stringify({ profileId, grantedScopes, config }),
  });
}

export async function deactivateAlim(pluginId: string, profileId: string): Promise<unknown> {
  return core.request(`/v1/plugins/${pluginId}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

/** Session meal-prep hebdo → planning (P2). C'est le bloc concret et actionnable. */
export async function declareMealPrep(profileId: string, prepPerWeek: number): Promise<unknown> {
  return core.request('/v1/calendar/recurring', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: ALIM_SLUG,
      sourceRef: PREP_REF,
      type: 'alimentation.prep',
      title: 'Meal-prep',
      frequencyPerWeek: Math.max(1, prepPerWeek),
      durationMin: 60,
      intensity: 'legere',
      hardConstraints: { minRestDaysPerWeek: 0 },
      softPreferences: { preferredTime: 'apres-midi' },
    }),
  });
}

export async function removeMealPrep(profileId: string): Promise<unknown> {
  return core.request(`/v1/calendar/recurring/${profileId}/${ALIM_SLUG}/${PREP_REF}`, {
    method: 'DELETE',
  });
}

/**
 * compose : idées de menus/repas réguliers (P3). GARDE-FOU : jamais de calories ni de conseil médical —
 * on ne demande que régularité, variété et planification.
 */
export async function composeMenu(
  profileId: string,
): Promise<{ prompt: string; closingPrompt: string }> {
  return core.request('/v1/ai/compose', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: ALIM_SLUG,
      title: 'Idées de menus pour la semaine',
      goal: 'manger régulièrement, varié et planifié',
      instructions:
        'Propose des idées de repas simples et un plan de meal-prep pour la semaine. ' +
        'IMPORTANT : ne donne AUCUN comptage de calories, AUCUN objectif chiffré, AUCUN conseil médical ' +
        'ou nutritionnel individualisé. Reste sur la régularité, la variété et la planification.',
    }),
  });
}

export async function ingestMeal(
  profileId: string,
  summary: string,
): Promise<{ snapshot: Record<string, unknown>; creditsSpent: number }> {
  return core.request('/v1/ai/ingest', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: ALIM_SLUG,
      summary,
      fields: [
        { key: 'plats', type: 'stringArray', description: 'plats préparés ou repas pris' },
        {
          key: 'preparationFaite',
          type: 'boolean',
          description: 'a-t-il fait du meal-prep / cuisiné à l’avance ?',
        },
        { key: 'ressenti', type: 'string', description: 'ressenti général (sans jugement)' },
      ],
    }),
  });
}

export interface AlimEntryRow {
  id: string;
  done_at: string;
  kind: string;
  title: string;
  summary: string;
  snapshot: Record<string, unknown>;
}

export async function listEntries(profileId: string): Promise<AlimEntryRow[]> {
  const { data } = await getSupabase()
    .from('alimentation_entries')
    .select('id, done_at, kind, title, summary, snapshot')
    .eq('profile_id', profileId)
    .order('done_at', { ascending: false })
    .limit(30);
  return (data ?? []) as AlimEntryRow[];
}

export async function saveEntry(
  profileId: string,
  row: { kind: string; title: string; summary: string; snapshot: Record<string, unknown> },
): Promise<void> {
  await getSupabase().from('alimentation_entries').insert({
    profile_id: profileId,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    snapshot: row.snapshot,
  });
}
