import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { placementAnswerRequestSchema, placementStartRequestSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PlacementService } from './placement.service';

@Controller('placement')
@UseGuards(SupabaseAuthGuard)
export class PlacementController {
  constructor(private readonly service: PlacementService) {}

  /** Démarre un placement adaptatif → première question. */
  @Post('start')
  start(@Body() body: unknown) {
    const { profileId } = parseOr400(placementStartRequestSchema, body);
    return this.service.start(profileId);
  }

  /** Répond à la question courante → correction + question suivante ou résultat. */
  @Post('answer')
  answer(@Body() body: unknown) {
    const { sessionId, answer, responseTimeMs, timedOut } = parseOr400(
      placementAnswerRequestSchema,
      body,
    );
    return this.service.answer(sessionId, answer, responseTimeMs, timedOut);
  }
}
