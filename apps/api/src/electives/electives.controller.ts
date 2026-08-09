import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ElectivesService } from './electives.service';

const uuid = z.string().uuid();
const disc = z.object({ label: z.string().min(1).max(80), disciplineHint: z.string().max(60).default('') });
const startBody = z.object({ disciplines: z.array(disc).length(5), round: z.number().int().min(1).max(5).default(1) });
const journalBody = z.object({
  discipline: z.string().min(1).max(80),
  did: z.string().max(2000).default(''),
  liked: z.string().max(2000).default(''),
  disliked: z.string().max(2000).default(''),
  intensity: z.number().int().min(1).max(5).default(3),
});
const chooseBody = z.object({
  label: z.string().min(1).max(80),
  disciplineHint: z.string().max(60).default(''),
  mode: z.enum(['plaisir', 'pro']).default('plaisir'),
});

@Controller('electives')
@UseGuards(SupabaseAuthGuard)
export class ElectivesController {
  constructor(private readonly service: ElectivesService) {}

  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  @Post(':profileId/discovery/start')
  startDiscovery(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { disciplines, round } = parseOr400(startBody, body);
    return this.service.startDiscovery(uuid.parse(profileId), disciplines, round);
  }

  @Post(':profileId/discovery/next')
  next(@Param('profileId') profileId: string) {
    return this.service.nextDiscipline(uuid.parse(profileId));
  }

  @Post(':profileId/journal')
  journal(@Param('profileId') profileId: string, @Body() body: unknown) {
    const e = parseOr400(journalBody, body);
    return this.service.addJournal(uuid.parse(profileId), e);
  }

  @Post(':profileId/analyze')
  analyze(@Param('profileId') profileId: string) {
    return this.service.analyze(uuid.parse(profileId));
  }

  @Post(':profileId/choose')
  choose(@Param('profileId') profileId: string, @Body() body: unknown) {
    const c = parseOr400(chooseBody, body);
    return this.service.choose(uuid.parse(profileId), c);
  }

  @Post(':profileId/mode')
  mode(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { mode } = parseOr400(z.object({ mode: z.enum(['plaisir', 'pro']) }), body);
    return this.service.setMode(uuid.parse(profileId), mode);
  }

  @Post(':profileId/change/propose')
  proposeChange(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { target } = parseOr400(z.object({ target: z.string().min(1).max(80) }), body);
    return this.service.proposeChange(uuid.parse(profileId), target);
  }

  @Post(':profileId/change/confirm')
  confirmChange(@Param('profileId') profileId: string) {
    return this.service.confirmChange(uuid.parse(profileId));
  }

  @Post(':profileId/change/cancel')
  cancelChange(@Param('profileId') profileId: string) {
    return this.service.cancelChange(uuid.parse(profileId));
  }

  @Post(':profileId/exit')
  exit(@Param('profileId') profileId: string) {
    return this.service.exit(uuid.parse(profileId));
  }

  @Post(':profileId/plan/generate')
  generatePlan(@Param('profileId') profileId: string) {
    return this.service.generatePlan(uuid.parse(profileId));
  }

  @Post(':profileId/milestone/done')
  milestoneDone(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { milestoneId } = parseOr400(z.object({ milestoneId: z.string().min(1) }), body);
    return this.service.completeMilestone(uuid.parse(profileId), milestoneId);
  }
}
