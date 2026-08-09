import { z } from 'zod';

/**
 * Plateforme de PLUGINS Dowze — contrat partagé (registre, scopes, manifest,
 * activation par utilisateur). Source de vérité des types côté cœur (API) et
 * côté apps satellites / SDK. Cf. docs/12-PLUGINS.
 */

/** Version du cœur exposée aux plugins (compatibilité `min_core_version`). */
export const CORE_VERSION = '3.0.0' as const;
/** Version courante de l'API plugin (préfixe d'URL `/v1/`). */
export const PLUGIN_API_VERSION = 'v1' as const;

// ─── Scopes (permissions à moindre privilège, accordées par l'utilisateur) ───

export const PLUGIN_SCOPES = [
  'profile:read', // lire le profil public (nom, âge, locale) — jamais de données sensibles
  'calendar:read', // lire les entrées du planning du profil
  'calendar:write', // inscrire des activités récurrentes / événements dans le planning
  'ai:infer', // utiliser l'IA de Dowze (compose/ingest) via le contrat scopé
  'health:write', // écrire des données de santé (Art. 9) — consentement explicite séparé
  'xp:write', // créditer de l'XP (régularité récompensée)
] as const;

export const pluginScopeSchema = z.enum(PLUGIN_SCOPES);
export type PluginScope = z.infer<typeof pluginScopeSchema>;

/** Libellés lisibles pour l'écran de consentement (jamais de jargon technique visible). */
export const SCOPE_LABELS: Record<PluginScope, string> = {
  'profile:read': 'Lire ton profil (prénom, âge, langue)',
  'calendar:read': 'Voir ton planning',
  'calendar:write': 'Ajouter des séances à ton planning',
  'ai:infer': "Utiliser l'IA de Dowze pour préparer tes séances",
  'health:write': 'Enregistrer des données de forme (avec ton accord explicite)',
  'xp:write': 'Te récompenser en XP quand tu es régulier',
};

/** Scopes sensibles (données de santé Art. 9) → consentement séparé obligatoire. */
export const SENSITIVE_SCOPES: readonly PluginScope[] = ['health:write'];

// ─── Manifest déclaratif (dowze-plugin.yml) ───

export const pluginStatusSchema = z.enum(['draft', 'active', 'deprecated', 'disabled']);
export type PluginStatus = z.infer<typeof pluginStatusSchema>;

/** Ce qu'un plugin apporte au cœur (types d'entrée calendrier, tuiles, nav). */
export const pluginContributesSchema = z
  .object({
    calendarEntryTypes: z
      .array(
        z.object({
          type: z.string().min(1), // ex. 'fitness.workout'
          label: z.string().min(1),
          color: z.string().min(1).default('emerald'),
          icon: z.string().min(1).default('activity'), // nom d'icône Lucide
        }),
      )
      .default([]),
    navTiles: z
      .array(z.object({ label: z.string().min(1), href: z.string().min(1), icon: z.string().min(1) }))
      .default([]),
  })
  .default({ calendarEntryTypes: [], navTiles: [] });
export type PluginContributes = z.infer<typeof pluginContributesSchema>;

export const pluginManifestSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/), // 'fitness'
  name: z.string().min(1), // 'Dowze Fitness'
  subdomain: z.string().regex(/^[a-z0-9.-]+$/), // 'fitness.dowze.ch'
  description: z.string().default(''),
  manifestVersion: z.string().default('1'),
  apiVersion: z.string().default(PLUGIN_API_VERSION),
  minCoreVersion: z.string().default(CORE_VERSION),
  scopesRequested: z.array(pluginScopeSchema).default([]), // requis (moindre privilège)
  scopesOptional: z.array(pluginScopeSchema).default([]), // facultatifs (activés à la demande)
  contributes: pluginContributesSchema,
  subscribes: z.array(z.string()).default([]), // événements écoutés (ex. 'calendar.entry.created')
  configSchema: z.record(z.unknown()).default({}), // JSON Schema de la config utilisateur
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

// ─── Projection du registre (ce que l'API renvoie) ───

export const pluginRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  subdomain: z.string(),
  description: z.string(),
  status: pluginStatusSchema,
  manifestVersion: z.string(),
  apiVersion: z.string(),
  minCoreVersion: z.string(),
  scopesRequested: z.array(pluginScopeSchema),
  scopesOptional: z.array(pluginScopeSchema),
  contributes: pluginContributesSchema,
  subscribes: z.array(z.string()),
  configSchema: z.record(z.unknown()),
});
export type PluginRegistryEntry = z.infer<typeof pluginRegistryEntrySchema>;

// ─── Activation par utilisateur ───

export const userPluginActivationSchema = z.object({
  pluginId: z.string().uuid(),
  profileId: z.string().uuid(),
  enabled: z.boolean(),
  grantedScopes: z.array(pluginScopeSchema),
  config: z.record(z.unknown()),
});
export type UserPluginActivation = z.infer<typeof userPluginActivationSchema>;

/** Catalogue enrichi de l'état d'activation du profil courant (écran « Mes apps »). */
export const pluginCatalogueItemSchema = pluginRegistryEntrySchema.extend({
  activation: userPluginActivationSchema.pick({ enabled: true, grantedScopes: true, config: true }).nullable(),
});
export type PluginCatalogueItem = z.infer<typeof pluginCatalogueItemSchema>;

// ─── Corps de requête ───

export const activatePluginBodySchema = z.object({
  profileId: z.string().uuid(),
  grantedScopes: z.array(pluginScopeSchema).default([]),
  config: z.record(z.unknown()).default({}),
});
export type ActivatePluginBody = z.infer<typeof activatePluginBodySchema>;

export const deactivatePluginBodySchema = z.object({
  profileId: z.string().uuid(),
});

// ─── Compatibilité de version (semver simplifié `major.minor.patch`) ───

function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map((n) => parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/** Compare deux versions : -1 si a<b, 0 si égales, 1 si a>b. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Le cœur (`coreVersion`) satisfait-il le `minCoreVersion` demandé par le plugin ? */
export function satisfiesMinCore(minCoreVersion: string, coreVersion: string = CORE_VERSION): boolean {
  return compareVersions(coreVersion, minCoreVersion) >= 0;
}
