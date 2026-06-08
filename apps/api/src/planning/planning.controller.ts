import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { PlanningService } from './planning.service';

const generateBody = z.object({
  profileId: z.string().uuid(),
  weekStartIso: z.string().datetime({ offset: true }),
});

@Controller('planning')
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  @Post('generate')
  generate(@Body() body: unknown) {
    const input = parseOr400(generateBody, body);
    return this.service.generateWeek(input.profileId, input.weekStartIso, new Date().toISOString());
  }
}
