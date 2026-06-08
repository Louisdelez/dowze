import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SpacedRepetitionService } from './spaced-repetition.service';

const reviewBody = z.object({
  profileId: z.string().uuid(),
  skillId: z.string().uuid(),
  grade: z.number().int().min(0).max(5),
});

@Controller('reviews')
export class SpacedRepetitionController {
  constructor(private readonly service: SpacedRepetitionService) {}

  @Post()
  review(@Body() body: unknown) {
    const input = parseOr400(reviewBody, body);
    return this.service.review(input.profileId, input.skillId, input.grade, new Date().toISOString());
  }
}
