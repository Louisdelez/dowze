import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RankJumpService } from './rank-jump.service';

const uuid = z.string().uuid();
const dayBody = z.object({ score: z.number().min(0).max(1) });

@Controller('rank-jump')
@UseGuards(SupabaseAuthGuard)
export class RankJumpController {
  constructor(private readonly service: RankJumpService) {}

  /** Éligibilité + saut actif éventuel. */
  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  /** Lance un mois intensif (si éligible). */
  @Post(':profileId/start')
  start(@Param('profileId') profileId: string) {
    return this.service.start(uuid.parse(profileId));
  }

  /** Enregistre le résultat du jour et avance (finalise à J28). */
  @Post(':profileId/day')
  day(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { score } = parseOr400(dayBody, body);
    return this.service.submitDay(uuid.parse(profileId), score);
  }

  /** Abandonne le saut en cours (retour au rang, sans pénalité). */
  @Post(':profileId/abandon')
  abandon(@Param('profileId') profileId: string) {
    return this.service.abandon(uuid.parse(profileId));
  }

  /** Vue du saut d'un enfant (responsable, par le code = accountId). */
  @Get('child/:accountId')
  childView(@Param('accountId') accountId: string) {
    return this.service.viewForAccount(uuid.parse(accountId));
  }

  /** Confirmation du responsable (par le code enfant = accountId) : lance le mois intensif. */
  @Post('child/:accountId/consent')
  consent(@Param('accountId') accountId: string) {
    return this.service.parentConsent(uuid.parse(accountId));
  }

  /** Valide un re-test de rétention (ancrage post-saut). */
  @Post(':profileId/retention/:id')
  retention(@Param('profileId') profileId: string, @Param('id') id: string, @Body() body: unknown) {
    const { score } = parseOr400(dayBody, body);
    return this.service
      .doRetention(uuid.parse(profileId), uuid.parse(id), score)
      .then(() => this.service.view(uuid.parse(profileId)));
  }

  /** A1 — génère le pré-test above-level (contenu du rang visé). */
  @Post(':profileId/pretest/generate')
  pretestGenerate(@Param('profileId') profileId: string) {
    return this.service.generatePretest(uuid.parse(profileId));
  }

  /** A1 — enregistre le score du pré-test. */
  @Post(':profileId/pretest')
  pretestSubmit(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { score } = parseOr400(dayBody, body);
    return this.service.submitPretest(uuid.parse(profileId), score);
  }

  /** A3 — check-in humeur (1-5). */
  @Post(':profileId/mood')
  mood(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { mood } = parseOr400(z.object({ mood: z.number().min(1).max(5) }), body);
    return this.service.checkinMood(uuid.parse(profileId), mood);
  }

  /** A3 — WHO-5 hebdo (0-100). */
  @Post(':profileId/who5')
  who5(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { score } = parseOr400(z.object({ score: z.number().min(0).max(100) }), body);
    return this.service.submitWho5(uuid.parse(profileId), score);
  }
}
