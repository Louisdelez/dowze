import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CarnetService } from './carnet.service';

const entryBody = z.object({
  profileId: z.string().uuid(),
  note: z.string().min(1).max(4000),
  skillId: z.string().uuid().nullable().default(null),
});

@Controller('carnet')
@UseGuards(SupabaseAuthGuard)
export class CarnetController {
  constructor(private readonly service: CarnetService) {}

  @Post()
  add(@Body() body: unknown) {
    const input = parseOr400(entryBody, body);
    return this.service.addEntry(input.profileId, input.note, input.skillId);
  }

  @Get(':profileId')
  list(@Param('profileId') profileId: string) {
    return this.service.list(profileId);
  }

  @Get(':profileId/prompt')
  prompt(@Param('profileId') profileId: string) {
    return this.service.resumePrompt(profileId);
  }
}
