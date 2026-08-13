import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PluginScope } from '@dowze/schemas';
import { PluginsService } from './plugins.service';

export const PLUGIN_SCOPE_KEY = 'plugin_scope';

/**
 * Décore une route plugin avec le scope requis. La route ne passe que si
 * l'utilisateur a **accordé** ce scope à ce plugin (moindre privilège, révocable).
 *
 * `@RequirePluginScope('calendar:write')`
 */
export const RequirePluginScope = (scope: PluginScope): MethodDecorator =>
  SetMetadata(PLUGIN_SCOPE_KEY, scope);

interface RequestLike {
  params: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

/**
 * Middleware de scopes : à placer APRÈS `SupabaseAuthGuard`. Résout le plugin
 * (`:pluginId`, en-tête `x-dowze-plugin`, ou `sourceApp` du corps) et le profil
 * (`:profileId`, en-tête `x-dowze-profile`, ou `profileId` du corps), puis
 * vérifie que le scope requis a bien été **accordé**. Refuse sinon (403). C'est
 * le point d'application « moindre privilège » du contrat plugin.
 */
@Injectable()
export class PluginScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plugins: PluginsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<PluginScope | undefined>(
      PLUGIN_SCOPE_KEY,
      context.getHandler(),
    );
    if (!required) return true; // route non scopée

    const req = context.switchToHttp().getRequest<RequestLike>();
    const body = req.body ?? {};

    const profileId =
      req.params.profileId ??
      req.headers['x-dowze-profile'] ??
      (body.profileId as string | undefined);

    // Identité du plugin : id direct, ou slug (path / en-tête / corps) à résoudre.
    let pluginId = req.params.pluginId;
    if (!pluginId) {
      const slug =
        req.params.sourceApp ??
        req.headers['x-dowze-plugin'] ??
        (body.sourceApp as string | undefined);
      if (slug) pluginId = (await this.plugins.idBySlug(slug)) ?? undefined;
    }

    if (!pluginId || !profileId) {
      throw new ForbiddenException('identité plugin/profil manquante');
    }

    const granted = await this.plugins.grantedScopes(profileId, pluginId);
    if (granted === null) throw new ForbiddenException('plugin non activé pour ce profil');
    if (!granted.includes(required)) {
      throw new ForbiddenException(`scope « ${required} » non accordé`);
    }
    return true;
  }
}
