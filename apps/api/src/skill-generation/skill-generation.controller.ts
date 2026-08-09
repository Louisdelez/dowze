import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SkillGenerationService } from './skill-generation.service';

const goalBody = z.object({ goal: z.string().min(3).max(300) });

@Controller('skills')
@UseGuards(SupabaseAuthGuard)
export class SkillGenerationController {
  constructor(private readonly service: SkillGenerationService) {}

  /** Prochaine compétence à travailler — étend l'Atlas si l'élève a atteint le bord du graphe. */
  @Get('next-or-grow/:profileId')
  nextOrGrow(@Param('profileId') profileId: string) {
    return this.service.nextOrGrow(profileId);
  }

  /** Force la croissance de l'Atlas au bord atteint par l'élève (admin/diagnostic). */
  @Post('grow/:profileId')
  grow(@Param('profileId') profileId: string) {
    return this.service.growForLearner(profileId);
  }

  /** « Je veux apprendre X » — fabrique la cible + le chemin de prérequis manquant (voisinage amont). */
  @Post('toward-goal/:profileId')
  towardGoal(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { goal } = parseOr400(goalBody, body);
    return this.service.growTowardGoal(profileId, goal);
  }

  /** GraphRAG vectoriel : embarque les nœuds du graphe pour la récupération sémantique (admin). */
  @Post('embed-graph/:profileId')
  embedGraph(@Param('profileId') profileId: string) {
    return this.service.embedGraph(profileId);
  }
}
