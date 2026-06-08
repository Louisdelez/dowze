import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { CommunityService } from './community.service';
import { formClasses, type Candidate } from './matching';

const createClasseBody = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  locale: z.string().min(2),
  timezone: z.string().min(1),
  type: z.string().min(1),
});

const joinBody = z.object({ profileId: z.string().uuid() });

const messageBody = z.object({
  authorId: z.string().uuid(),
  body: z.string().min(1).max(8000),
});

const formClassesBody = z.object({
  targetSize: z.number().int().positive().max(200).default(24),
  candidates: z
    .array(
      z.object({
        profileId: z.string().uuid(),
        locale: z.string().min(2),
        timezone: z.string().min(1),
        type: z.string().min(1),
        level: z.number(),
      }),
    )
    .default([]),
});

@Controller('community')
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Get('classes')
  listClasses() {
    return this.service.listClasses();
  }

  @Post('classes')
  createClasse(@Body() body: unknown) {
    return this.service.createClasse(parseOr400(createClasseBody, body));
  }

  @Post('classes/:id/join')
  join(@Param('id') id: string, @Body() body: unknown) {
    return this.service.join(id, parseOr400(joinBody, body).profileId);
  }

  @Get('classes/:id/messages')
  messages(@Param('id') id: string) {
    return this.service.listClasseMessages(id);
  }

  @Post('classes/:id/messages')
  postMessage(@Param('id') id: string, @Body() body: unknown) {
    const input = parseOr400(messageBody, body);
    return this.service.postClasseMessage(id, input.authorId, input.body);
  }

  /** Affectation en classes (pur, sans persistance) — proposition de regroupement. */
  @Post('form-classes')
  formClasses(@Body() body: unknown) {
    const input = parseOr400(formClassesBody, body);
    return formClasses(input.candidates as Candidate[], input.targetSize);
  }
}
