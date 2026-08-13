import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { activatePluginBodySchema, deactivatePluginBodySchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PluginsService } from './plugins.service';
import { PluginScopeGuard, RequirePluginScope } from './plugin-scope.guard';

const uuid = z.string().uuid();

/**
 * API de la plateforme de plugins — versionnée `/v1/` (contrat stable, politique
 * de dépréciation N/N-1). Catalogue, activation/désactivation par utilisateur,
 * et une route de démonstration protégée par le middleware de scopes.
 */
@Controller('v1/plugins')
@UseGuards(SupabaseAuthGuard)
export class PluginsController {
  constructor(private readonly service: PluginsService) {}

  /** Catalogue brut des plugins installables. */
  @Get()
  catalogue() {
    return this.service.catalogue();
  }

  /** Catalogue enrichi de l'état d'activation du profil (écran « Mes apps »). */
  @Get('mine/:profileId')
  mine(@Param('profileId') profileId: string) {
    return this.service.catalogueForProfile(uuid.parse(profileId));
  }

  /** Active un plugin pour un profil (octroi de scopes + config validée). */
  @Post(':pluginId/activate')
  activate(@Param('pluginId') pluginId: string, @Body() body: unknown) {
    const parsed = parseOr400(activatePluginBodySchema, body);
    return this.service.activate(uuid.parse(pluginId), parsed);
  }

  /** Désactive (révoque) un plugin pour un profil. */
  @Post(':pluginId/deactivate')
  deactivate(@Param('pluginId') pluginId: string, @Body() body: unknown) {
    const { profileId } = parseOr400(deactivatePluginBodySchema, body);
    return this.service.deactivate(uuid.parse(pluginId), profileId);
  }

  /**
   * Démonstration du middleware de scopes : ne répond `{ ok: true }` que si le
   * profil a accordé `calendar:read` à ce plugin — sinon 403. Preuve P1 que
   * l'accès est bien gouverné par les scopes accordés. (Les vraies routes
   * scopées `calendar:write` / `ai:infer` arrivent en P2/P3.)
   */
  @Get(':pluginId/scope-check/:profileId')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('calendar:read')
  scopeCheck(@Param('pluginId') pluginId: string, @Param('profileId') profileId: string) {
    return { ok: true, pluginId: uuid.parse(pluginId), profileId: uuid.parse(profileId) };
  }
}
