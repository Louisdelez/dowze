import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { ModerationService } from './moderation.service';

const reportBody = z.object({
  source: z.enum(['automod', 'ml-toxicite', 'signalement-humain']),
  severity: z.enum(['faible', 'moyen', 'grave', 'critique']),
  contentRef: z.string().min(1),
  authorId: z.string().uuid().nullable().default(null),
  victimId: z.string().uuid().nullable().default(null),
});

const actBody = z.object({
  actorId: z.string().uuid(),
  kind: z.enum(['aucune', 'avertissement', 'masquage', 'suspension', 'escalade']),
  reason: z.string().default(''),
});

@Controller('moderation')
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  @Post('incidents')
  report(@Body() body: unknown) {
    return this.service.report(parseOr400(reportBody, body));
  }

  @Get('incidents')
  listForReview() {
    return this.service.listForReview();
  }

  @Post('incidents/:id/action')
  act(@Param('id') id: string, @Body() body: unknown) {
    const input = parseOr400(actBody, body);
    return this.service.act(id, input.actorId, input.kind, input.reason);
  }
}
