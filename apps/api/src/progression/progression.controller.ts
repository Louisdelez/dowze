import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProgressionService } from './progression.service';

const observeBody = z.object({
  profileId: z.string().uuid(),
  skillId: z.string().uuid(),
  correct: z.boolean(),
});

@Controller('progression')
@UseGuards(SupabaseAuthGuard)
export class ProgressionController {
  constructor(private readonly service: ProgressionService) {}

  @Get(':profileId')
  get(@Param('profileId') profileId: string) {
    return this.service.getMastery(profileId);
  }

  @Post('observe')
  observe(@Body() body: unknown) {
    const input = parseOr400(observeBody, body);
    return this.service.observe(input.profileId, input.skillId, input.correct, new Date().toISOString());
  }
}
