import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { generateTestRequestSchema, submitTestRequestSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TestsService } from './tests.service';

@Controller('tests')
@UseGuards(SupabaseAuthGuard)
export class TestsController {
  constructor(private readonly service: TestsService) {}

  /** Génère un test de révision (hebdo par défaut). */
  @Post('generate')
  generate(@Body() body: unknown) {
    const { profileId, kind } = parseOr400(generateTestRequestSchema, body);
    return this.service.generate(profileId, kind);
  }

  /** Soumet les résultats (formatif → FSRS, pas de note de maîtrise). */
  @Post('submit')
  submit(@Body() body: unknown) {
    const { testId, profileId, results } = parseOr400(submitTestRequestSchema, body);
    return this.service.submit(testId, profileId, results);
  }
}
