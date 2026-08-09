import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { expeditionProposalSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GuidedExpeditionsService } from './guided-expeditions.service';

const uuid = z.string().uuid();

const proposeBody = z.object({ profileId: z.string().uuid() }).strict();
const chooseBody = z
  .object({ profileId: z.string().uuid(), proposal: expeditionProposalSchema })
  .strict();
const advanceBody = z
  .object({ bilan: z.string().max(8000).optional() })
  .strict();

@Controller('expeditions/guided')
@UseGuards(SupabaseAuthGuard)
export class GuidedExpeditionsController {
  constructor(private readonly service: GuidedExpeditionsService) {}

  /** 3 propositions d'expédition (IA), calibrées au dossier de l'élève. */
  @Post('propose')
  propose(@Body() body: unknown) {
    const { profileId } = parseOr400(proposeBody, body);
    return this.service.propose(profileId);
  }

  /** L'élève choisit une expédition → création. */
  @Post('choose')
  choose(@Body() body: unknown) {
    const { profileId, proposal } = parseOr400(chooseBody, body);
    return this.service.choose(profileId, proposal);
  }

  /** Les expéditions de l'élève. */
  @Get('mine/:profileId')
  mine(@Param('profileId') profileId: string) {
    return this.service.listMine(uuid.parse(profileId));
  }

  /** Guidage de la phase courante (explication + prompt + pistes). */
  @Post(':id/phase-guide')
  phaseGuide(@Param('id') id: string) {
    return this.service.phaseGuide(uuid.parse(id));
  }

  /** Bilan de phase + passage à la phase suivante. */
  @Post(':id/advance')
  advance(@Param('id') id: string, @Body() body: unknown) {
    const { bilan } = parseOr400(advanceBody, body);
    return this.service.advance(uuid.parse(id), bilan);
  }
}
