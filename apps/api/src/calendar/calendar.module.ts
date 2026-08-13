import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { PluginsModule } from '../plugins/plugins.module';
import { PluginScopeGuard } from '../plugins/plugin-scope.guard';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

/**
 * Contribution au planning (P2) — activités récurrentes & entrées ponctuelles des plugins.
 * Importe `PluginsModule` (identité/scopes) et `RealtimeModule` (bus d'événements). Exporte
 * `CalendarService` pour que `ScheduleModule` fusionne les récurrents dans la vue du calendrier.
 */
@Module({
  imports: [RealtimeModule, PluginsModule],
  controllers: [CalendarController],
  providers: [CalendarService, PluginScopeGuard],
  exports: [CalendarService],
})
export class CalendarModule {}
