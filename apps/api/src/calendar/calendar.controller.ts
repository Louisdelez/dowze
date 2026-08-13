import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { createCalendarEntryBodySchema, declareRecurringBodySchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PluginScopeGuard, RequirePluginScope } from '../plugins/plugin-scope.guard';
import { CalendarService } from './calendar.service';

const uuid = z.string().uuid();

/**
 * API de contribution au planning — versionnée `/v1/`. Un plugin (scope `calendar:write`) déclare des
 * **activités récurrentes** et des **entrées ponctuelles** ; le cœur les orchestre/projette. L'identité
 * du plugin est portée par `sourceApp` (résolue par le middleware de scopes).
 */
@Controller('v1/calendar')
@UseGuards(SupabaseAuthGuard)
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  /** Déclarer/actualiser une activité récurrente (ex. « sport 3×/sem »). */
  @Post('recurring')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('calendar:write')
  declareRecurring(@Body() body: unknown) {
    return this.service.declareRecurring(parseOr400(declareRecurringBodySchema, body));
  }

  /** Retirer une activité récurrente (ownership plugin). */
  @Delete('recurring/:profileId/:sourceApp/:sourceRef')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('calendar:write')
  removeRecurring(
    @Param('profileId') profileId: string,
    @Param('sourceApp') sourceApp: string,
    @Param('sourceRef') sourceRef: string,
  ) {
    return this.service.removeRecurring(uuid.parse(profileId), sourceApp, sourceRef);
  }

  /** Lister les activités récurrentes d'un profil (lecture par l'utilisateur). */
  @Get('recurring/:profileId')
  listRecurring(@Param('profileId') profileId: string) {
    return this.service.listRecurring(uuid.parse(profileId));
  }

  /** Créer une entrée ponctuelle (match, événement) — conflit vérifié, émet `calendar.entry.created`. */
  @Post('entries')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('calendar:write')
  createEntry(@Body() body: unknown) {
    return this.service.createEntry(parseOr400(createCalendarEntryBodySchema, body));
  }

  @Delete('entries/:profileId/:id')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('calendar:write')
  removeEntry(@Param('profileId') profileId: string, @Param('id') id: string) {
    return this.service.removeEntry(uuid.parse(profileId), uuid.parse(id));
  }

  @Get('entries/:profileId')
  listEntries(@Param('profileId') profileId: string) {
    return this.service.listEntries(uuid.parse(profileId));
  }
}
