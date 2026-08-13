import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SpecializationService } from './specialization.service';

const uuid = z.string().uuid();
const discBody = z.object({ discipline: z.string().min(1) });

@Controller('specialization')
@UseGuards(SupabaseAuthGuard)
export class SpecializationController {
  constructor(private readonly service: SpecializationService) {}

  @Get(':profileId')
  view(@Param('profileId') profileId: string) {
    return this.service.view(uuid.parse(profileId));
  }

  /** Choisit une discipline comme voie (guidée ou libre). */
  @Post(':profileId/choose')
  choose(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { discipline } = parseOr400(discBody, body);
    return this.service.choose(uuid.parse(profileId), discipline);
  }

  /** Retire une voie (« respec » — rien n'est perdu). */
  @Post(':profileId/drop')
  drop(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { discipline } = parseOr400(discBody, body);
    return this.service.drop(uuid.parse(profileId), discipline);
  }

  /** Plan de spécialisation d'une discipline (jalons/projets). */
  @Get(':profileId/plan/:discipline')
  plan(@Param('profileId') profileId: string, @Param('discipline') discipline: string) {
    return this.service.getPlan(uuid.parse(profileId), decodeURIComponent(discipline));
  }

  /** Le guide-IA génère (ou régénère) le plan. */
  @Post(':profileId/plan/:discipline/generate')
  generate(@Param('profileId') profileId: string, @Param('discipline') discipline: string) {
    return this.service.generatePlan(uuid.parse(profileId), decodeURIComponent(discipline));
  }

  /** Valide un jalon (débloque le badge). */
  @Post(':profileId/milestone/done')
  milestoneDone(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { discipline, milestoneId } = parseOr400(
      z.object({ discipline: z.string().min(1), milestoneId: z.string().min(1) }),
      body,
    );
    return this.service.completeMilestone(uuid.parse(profileId), discipline, milestoneId);
  }
}
