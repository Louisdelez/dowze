import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ScheduleService } from './schedule.service';

const uuid = z.string().uuid();
const configBody = z.object({
  activeDays: z.array(z.number().int().min(0).max(6)).min(1),
  dayStartMin: z.number().int().min(0).max(1439),
  dayEndMin: z.number().int().min(1).max(1440),
  intensity: z.enum(['leger', 'moyen', 'soutenu']),
});
const vacBody = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
  label: z.string().max(60).default('Vacances'),
});

@Controller('schedule')
@UseGuards(SupabaseAuthGuard)
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  @Post(':profileId/preset')
  preset(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { preset } = parseOr400(z.object({ preset: z.string().min(1) }), body);
    return this.service.setPreset(uuid.parse(profileId), preset);
  }

  @Post(':profileId/config')
  config(@Param('profileId') profileId: string, @Body() body: unknown) {
    const c = parseOr400(configBody, body);
    return this.service.setConfig(uuid.parse(profileId), c);
  }

  @Post(':profileId/vacation')
  addVacation(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { startDate, endDate, label } = parseOr400(vacBody, body);
    return this.service.addVacation(uuid.parse(profileId), startDate, endDate, label);
  }

  @Post(':profileId/vacation/:id/remove')
  removeVacation(@Param('profileId') profileId: string, @Param('id') id: string) {
    return this.service.removeVacation(uuid.parse(profileId), uuid.parse(id));
  }
}
