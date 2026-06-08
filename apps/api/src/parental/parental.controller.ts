import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ParentalService } from './parental.service';

const guardianBody = z.object({
  minorAccountId: z.string().uuid(),
  email: z.string().email(),
});

const consentBody = z.object({
  guardianId: z.string().uuid(),
  status: z.enum(['en-attente', 'accorde', 'refuse']),
});

@Controller('parental')
@UseGuards(SupabaseAuthGuard)
export class ParentalController {
  constructor(private readonly service: ParentalService) {}

  @Post('guardians')
  registerGuardian(@Body() body: unknown) {
    const input = parseOr400(guardianBody, body);
    return this.service.registerGuardian(input.minorAccountId, input.email);
  }

  @Post('consent')
  setConsent(@Body() body: unknown) {
    const input = parseOr400(consentBody, body);
    return this.service.setConsent(input.guardianId, input.status, new Date().toISOString());
  }

  @Get('summary/:minorAccountId')
  summary(@Param('minorAccountId') minorAccountId: string) {
    return this.service.summary(minorAccountId);
  }
}
