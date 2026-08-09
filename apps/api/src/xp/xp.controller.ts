import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { XpService } from './xp.service';

const uuid = z.string().uuid();

@Controller('xp')
@UseGuards(SupabaseAuthGuard)
export class XpController {
  constructor(private readonly service: XpService) {}

  /** Niveau + XP + barre de progression + série. */
  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  /** Connexion quotidienne (idempotent : 1×/jour). */
  @Post(':profileId/daily')
  daily(@Param('profileId') profileId: string) {
    return this.service.daily(uuid.parse(profileId));
  }

  /** Heartbeat de temps actif (secondes actives validées côté client, plafonné côté serveur). */
  @Post(':profileId/active')
  active(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { seconds } = parseOr400(z.object({ seconds: z.number().min(0).max(120) }), body);
    return this.service.active(uuid.parse(profileId), seconds);
  }
}
