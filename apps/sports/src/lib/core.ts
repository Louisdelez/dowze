import { DowzeClient } from '@dowze/api-client';
import { getSupabase } from '@dowze/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.dowze.ch';
export const SPORTS_SLUG = 'sports';
const TRAINING_REF = 'training-main';

export const core = new DowzeClient({
  baseUrl: API_BASE,
  getAccessToken: async () => {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  },
});

const pluginHeader = { 'x-dowze-plugin': SPORTS_SLUG };

export interface SportsConfig {
  discipline: string;
  frequencyPerWeek: number;
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

export async function activateSports(
  pluginId: string,
  profileId: string,
  grantedScopes: string[],
  config: SportsConfig,
): Promise<unknown> {
  return core.request(`/v1/plugins/${pluginId}/activate`, {
    method: 'POST',
    body: JSON.stringify({ profileId, grantedScopes, config }),
  });
}

export async function deactivateSports(pluginId: string, profileId: string): Promise<unknown> {
  return core.request(`/v1/plugins/${pluginId}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ profileId }),
  });
}

/** Entraînement récurrent → planning (P2). */
export async function declareTraining(
  profileId: string,
  discipline: string,
  frequencyPerWeek: number,
): Promise<unknown> {
  return core.request('/v1/calendar/recurring', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: SPORTS_SLUG,
      sourceRef: TRAINING_REF,
      type: 'sports.training',
      title: `Entraînement ${discipline}`,
      frequencyPerWeek,
      durationMin: 75,
      intensity: 'moderee',
      hardConstraints: { minRestDaysPerWeek: 1, weeklyCapMin: 360, minRecoveryHoursSameType: 24 },
      softPreferences: { preferredTime: 'apres-midi' },
    }),
  });
}

export async function removeTraining(profileId: string): Promise<unknown> {
  return core.request(`/v1/calendar/recurring/${profileId}/${SPORTS_SLUG}/${TRAINING_REF}`, {
    method: 'DELETE',
  });
}

/** Match = entrée ponctuelle à date fixe = CONTRAINTE DURE dans le planning (P2). */
export async function addMatch(
  profileId: string,
  title: string,
  startISO: string,
  durationMin = 90,
): Promise<unknown> {
  return core.request('/v1/calendar/entries', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: SPORTS_SLUG,
      sourceRef: `match-${startISO}`,
      entryType: 'sports.event',
      title,
      start: startISO,
      durationMin,
    }),
  });
}

export interface MatchEntry {
  id: string;
  title: string;
  start: string;
  durationMin: number;
  status: string;
}

export async function listMatches(profileId: string): Promise<MatchEntry[]> {
  const all = await core.request<(MatchEntry & { sourceApp: string })[]>(
    `/v1/calendar/entries/${profileId}`,
  );
  return all.filter((e) => e.sourceApp === SPORTS_SLUG);
}

export async function composeSession(
  profileId: string,
  body: {
    title: string;
    goal?: string;
    level?: string;
    context?: { label: string; value: string }[];
  },
): Promise<{ prompt: string; closingPrompt: string }> {
  return core.request('/v1/ai/compose', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({ profileId, sourceApp: SPORTS_SLUG, ...body }),
  });
}

export async function ingestSession(
  profileId: string,
  summary: string,
): Promise<{ snapshot: Record<string, unknown>; creditsSpent: number }> {
  return core.request('/v1/ai/ingest', {
    method: 'POST',
    headers: pluginHeader,
    body: JSON.stringify({
      profileId,
      sourceApp: SPORTS_SLUG,
      summary,
      fields: [
        { key: 'exercices', type: 'stringArray', description: 'exercices / drills réalisés' },
        { key: 'dureeMin', type: 'integer', description: 'durée en minutes' },
        { key: 'ressenti', type: 'string', description: 'ressenti global' },
        {
          key: 'progres',
          type: 'string',
          description: 'ce qui a progressé (technique, endurance…)',
        },
      ],
    }),
  });
}

export interface SportsSessionRow {
  id: string;
  done_at: string;
  title: string;
  discipline: string;
  summary: string;
  snapshot: Record<string, unknown>;
}

export async function listSessions(profileId: string): Promise<SportsSessionRow[]> {
  const { data } = await getSupabase()
    .from('sports_sessions')
    .select('id, done_at, title, discipline, summary, snapshot')
    .eq('profile_id', profileId)
    .order('done_at', { ascending: false })
    .limit(30);
  return (data ?? []) as SportsSessionRow[];
}

export async function saveSession(
  profileId: string,
  row: { title: string; discipline: string; summary: string; snapshot: Record<string, unknown> },
): Promise<void> {
  await getSupabase().from('sports_sessions').insert({
    profile_id: profileId,
    title: row.title,
    discipline: row.discipline,
    summary: row.summary,
    snapshot: row.snapshot,
  });
}
