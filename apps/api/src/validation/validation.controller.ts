import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { ValidationService } from './validation.service';

const selfBody = z.object({
  profileId: z.string().uuid(),
  skillId: z.string().uuid(),
  verdicts: z
    .array(
      z.object({
        criterionId: z.string().min(1),
        met: z.boolean(),
        comment: z.string().default(''),
      }),
    )
    .default([]),
});

const peerBody = z.object({
  reviewerId: z.string().uuid(),
  learnerId: z.string().uuid(),
  skillId: z.string().uuid(),
  passed: z.boolean(),
});

@Controller('validation')
export class ValidationController {
  constructor(private readonly service: ValidationService) {}

  @Get('rubric/:skillId')
  rubric(@Param('skillId') skillId: string) {
    return this.service.getRubric(skillId);
  }

  @Post('self')
  self(@Body() body: unknown) {
    const input = parseOr400(selfBody, body);
    return this.service.selfValidate(input.profileId, input.skillId, input.verdicts);
  }

  @Post('peer')
  peer(@Body() body: unknown) {
    const input = parseOr400(peerBody, body);
    return this.service.peerReview(input.reviewerId, input.learnerId, input.skillId, input.passed);
  }

  @Get('badge/:skillId/:learnerId')
  badge(@Param('skillId') skillId: string, @Param('learnerId') learnerId: string) {
    return this.service.badge(skillId, learnerId);
  }
}
