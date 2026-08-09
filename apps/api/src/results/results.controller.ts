import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { rankChoiceSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ResultsService } from './results.service';

const uuid = z.string().uuid();
const voteBody = z.object({ choice: rankChoiceSchema });

@Controller('results')
@UseGuards(SupabaseAuthGuard)
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  /** « Mes résultats » de l'élève (maîtrise/croissance, sans note ni rang). */
  @Get('me/:profileId')
  me(@Param('profileId') profileId: string) {
    return this.service.forProfile(uuid.parse(profileId));
  }

  /** Vue du responsable : suivi d'un enfant via son code (= accountId). */
  @Get('child/:accountId')
  child(@Param('accountId') accountId: string) {
    return this.service.forChildAccount(uuid.parse(accountId));
  }

  /** Vote de l'élève sur une montée de rang proposée (accepter / consolider). */
  @Post('rank/vote/:profileId')
  vote(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { choice } = parseOr400(voteBody, body);
    return this.service.voteRank(uuid.parse(profileId), choice);
  }

  /** Confirmation du responsable (par le code enfant = accountId). */
  @Post('rank/child/:accountId/vote')
  parentVote(@Param('accountId') accountId: string, @Body() body: unknown) {
    const { choice } = parseOr400(voteBody, body);
    return this.service.parentVoteRank(uuid.parse(accountId), choice);
  }
}
