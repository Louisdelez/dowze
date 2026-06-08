import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DiagnosticService } from './diagnostic.service';

const runBody = z.object({
  profileId: z.string().uuid(),
  demonstratedSkillIds: z.array(z.string().uuid()).default([]),
});

@Controller('diagnostic')
@UseGuards(SupabaseAuthGuard)
export class DiagnosticController {
  constructor(private readonly service: DiagnosticService) {}

  @Post()
  run(@Body() body: unknown) {
    const input = parseOr400(runBody, body);
    return this.service.run(input.profileId, input.demonstratedSkillIds, new Date().toISOString());
  }
}
