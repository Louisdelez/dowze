import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { ExpeditionsService } from './expeditions.service';

const createBody = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  grandeQuestion: z.string().min(1),
  durationWeeks: z.number().int().min(2).max(6).default(3),
  skillIds: z.array(z.string().uuid()).default([]),
});

@Controller('expeditions')
export class ExpeditionsController {
  constructor(private readonly service: ExpeditionsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.service.create(parseOr400(createBody, body));
  }

  @Post(':id/advance')
  advance(@Param('id') id: string) {
    return this.service.advance(id);
  }
}
