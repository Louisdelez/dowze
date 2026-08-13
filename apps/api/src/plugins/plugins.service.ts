import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import {
  pluginContributesSchema,
  satisfiesMinCore,
  type ActivatePluginBody,
  type PluginCatalogueItem,
  type PluginRegistryEntry,
  type PluginScope,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { pluginRegistry, userPluginActivation } from '../db/schema';
import { RealtimeService } from '../realtime/realtime.service';

type RegistryRow = typeof pluginRegistry.$inferSelect;
type ActivationRow = typeof userPluginActivation.$inferSelect;

/** Statuts d'un plugin visibles au catalogue (installable / bientôt retiré). */
const VISIBLE_STATUSES = ['active', 'deprecated'];

@Injectable()
export class PluginsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly realtime: RealtimeService,
  ) {}

  /** Registre → projection publique (typée, `contributes` validé). */
  private toEntry(row: RegistryRow): PluginRegistryEntry {
    const contributes = pluginContributesSchema.safeParse(row.contributes);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      subdomain: row.subdomain,
      description: row.description,
      status: (row.status as PluginRegistryEntry['status']) ?? 'draft',
      manifestVersion: row.manifestVersion,
      apiVersion: row.apiVersion,
      minCoreVersion: row.minCoreVersion,
      scopesRequested: (row.scopesRequested ?? []) as PluginScope[],
      scopesOptional: (row.scopesOptional ?? []) as PluginScope[],
      contributes: contributes.success
        ? contributes.data
        : { calendarEntryTypes: [], navTiles: [] },
      subscribes: row.subscribes ?? [],
      configSchema: (row.configSchema ?? {}) as Record<string, unknown>,
    };
  }

  /** Catalogue brut (plugins installables). */
  async catalogue(): Promise<PluginRegistryEntry[]> {
    const rows = await this.db
      .select()
      .from(pluginRegistry)
      .where(inArray(pluginRegistry.status, VISIBLE_STATUSES));
    return rows.map((r) => this.toEntry(r));
  }

  /** Catalogue enrichi de l'état d'activation d'un profil (écran « Mes apps »). */
  async catalogueForProfile(profileId: string): Promise<PluginCatalogueItem[]> {
    const [rows, activations] = await Promise.all([
      this.db.select().from(pluginRegistry).where(inArray(pluginRegistry.status, VISIBLE_STATUSES)),
      this.db
        .select()
        .from(userPluginActivation)
        .where(eq(userPluginActivation.profileId, profileId)),
    ]);
    const byPlugin = new Map<string, ActivationRow>(activations.map((a) => [a.pluginId, a]));
    return rows.map((r) => {
      const a = byPlugin.get(r.id);
      return {
        ...this.toEntry(r),
        activation: a
          ? {
              enabled: a.enabled,
              grantedScopes: (a.grantedScopes ?? []) as PluginScope[],
              config: (a.config ?? {}) as Record<string, unknown>,
            }
          : null,
      };
    });
  }

  private async getById(pluginId: string): Promise<RegistryRow> {
    const [row] = await this.db
      .select()
      .from(pluginRegistry)
      .where(eq(pluginRegistry.id, pluginId));
    if (!row) throw new NotFoundException('plugin inconnu');
    return row;
  }

  /** Résout l'id d'un plugin depuis son slug ('fitness') — pour l'identité d'app des appels de contribution. */
  async idBySlug(slug: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: pluginRegistry.id })
      .from(pluginRegistry)
      .where(eq(pluginRegistry.slug, slug));
    return row?.id ?? null;
  }

  /**
   * Scopes accordés par un profil à un plugin — ou `null` si le plugin n'est pas
   * activé (ou désactivé). Utilisé par le middleware de scopes.
   */
  async grantedScopes(profileId: string, pluginId: string): Promise<PluginScope[] | null> {
    const [a] = await this.db
      .select()
      .from(userPluginActivation)
      .where(
        and(
          eq(userPluginActivation.profileId, profileId),
          eq(userPluginActivation.pluginId, pluginId),
        ),
      );
    if (!a || !a.enabled) return null;
    return (a.grantedScopes ?? []) as PluginScope[];
  }

  /**
   * Active un plugin pour un profil : vérifie compatibilité (min_core_version),
   * moindre privilège (scopes ⊆ requis∪optionnels, tous les requis accordés),
   * valide la config contre le `configSchema`, puis upsert + émet un événement.
   */
  async activate(pluginId: string, body: ActivatePluginBody): Promise<PluginCatalogueItem> {
    const plugin = await this.getById(pluginId);
    if (plugin.status !== 'active') {
      throw new ConflictException('plugin non installable (statut ≠ active)');
    }
    if (!satisfiesMinCore(plugin.minCoreVersion)) {
      throw new ConflictException(
        `version du cœur insuffisante (requis ≥ ${plugin.minCoreVersion})`,
      );
    }

    const requested = (plugin.scopesRequested ?? []) as PluginScope[];
    const optional = (plugin.scopesOptional ?? []) as PluginScope[];
    const allowed = new Set<PluginScope>([...requested, ...optional]);
    const granted = body.grantedScopes;

    const unknown = granted.filter((s) => !allowed.has(s));
    if (unknown.length > 0) {
      throw new BadRequestException(`scopes non déclarés par le plugin : ${unknown.join(', ')}`);
    }
    const missingRequired = requested.filter((s) => !granted.includes(s));
    if (missingRequired.length > 0) {
      throw new BadRequestException(`scopes requis manquants : ${missingRequired.join(', ')}`);
    }
    this.validateConfig(plugin.configSchema as Record<string, unknown>, body.config);

    await this.db
      .insert(userPluginActivation)
      .values({
        profileId: body.profileId,
        pluginId,
        enabled: true,
        grantedScopes: granted,
        config: body.config,
      })
      .onConflictDoUpdate({
        target: [userPluginActivation.profileId, userPluginActivation.pluginId],
        set: { enabled: true, grantedScopes: granted, config: body.config, updatedAt: new Date() },
      });

    await this.realtime.publishToUser(body.profileId, {
      type: 'plugin.activated',
      pluginId,
      slug: plugin.slug,
    });

    return {
      ...this.toEntry(plugin),
      activation: { enabled: true, grantedScopes: granted, config: body.config },
    };
  }

  /** Désactive (révoque) un plugin pour un profil — idempotent, non destructif. */
  async deactivate(
    pluginId: string,
    profileId: string,
  ): Promise<{ pluginId: string; enabled: false }> {
    const plugin = await this.getById(pluginId);
    await this.db
      .update(userPluginActivation)
      .set({ enabled: false, updatedAt: new Date() })
      .where(
        and(
          eq(userPluginActivation.profileId, profileId),
          eq(userPluginActivation.pluginId, pluginId),
        ),
      );
    await this.realtime.publishToUser(profileId, {
      type: 'plugin.deactivated',
      pluginId,
      slug: plugin.slug,
    });
    return { pluginId, enabled: false };
  }

  /**
   * Validation minimale de la config utilisateur contre le `configSchema`
   * (JSON Schema restreint : `required`, `enum`, `type` integer + min/max).
   * Suffisant pour P1 ; un validateur complet pourra remplacer ceci.
   */
  private validateConfig(schema: Record<string, unknown>, config: Record<string, unknown>): void {
    if (!schema || typeof schema !== 'object' || Object.keys(schema).length === 0) return;
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    for (const key of required) {
      if (!(key in config))
        throw new BadRequestException(`config : champ requis « ${key} » manquant`);
    }
    const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    for (const [key, value] of Object.entries(config)) {
      const spec = props[key];
      if (!spec) continue;
      if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
        throw new BadRequestException(
          `config : « ${key} » doit être parmi ${JSON.stringify(spec.enum)}`,
        );
      }
      if (spec.type === 'integer') {
        if (!Number.isInteger(value))
          throw new BadRequestException(`config : « ${key} » doit être un entier`);
        const n = value as number;
        if (typeof spec.minimum === 'number' && n < spec.minimum) {
          throw new BadRequestException(`config : « ${key} » ≥ ${spec.minimum}`);
        }
        if (typeof spec.maximum === 'number' && n > spec.maximum) {
          throw new BadRequestException(`config : « ${key} » ≤ ${spec.maximum}`);
        }
      }
    }
  }
}
