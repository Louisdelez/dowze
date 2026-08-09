import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { generateExercisesRequestSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ExercisesService } from './exercises.service';

@Controller('exercises')
@UseGuards(SupabaseAuthGuard)
export class ExercisesController {
  constructor(private readonly service: ExercisesService) {}

  /** Génère des items (flashcard/QCM/short/cloze) ancrés sur une compétence. */
  @Post('generate')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // coûteux (LLM)
  generate(@Body() body: unknown) {
    return this.service.generate(parseOr400(generateExercisesRequestSchema, body));
  }
}
