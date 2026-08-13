import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { PluginScopeGuard } from './plugin-scope.guard';

/**
 * Plateforme de PLUGINS (P1) — registre, activation par utilisateur, scopes.
 * Réutilise `RealtimeModule` (Redis pub/sub) comme bus d'événements pour
 * diffuser `plugin.activated` / `plugin.deactivated` aux flux de l'utilisateur.
 */
@Module({
  imports: [RealtimeModule],
  controllers: [PluginsController],
  providers: [PluginsService, PluginScopeGuard],
  exports: [PluginsService],
})
export class PluginsModule {}
