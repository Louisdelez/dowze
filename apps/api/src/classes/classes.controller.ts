import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ClassesService } from './classes.service';

const uuid = z.string().uuid();

@Controller('classes')
@UseGuards(SupabaseAuthGuard)
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  /** Ma classe assignée (+ canal). */
  @Get('mine/:profileId')
  mine(@Param('profileId') profileId: string) {
    return this.service.myClass(uuid.parse(profileId));
  }

  /** (Ré)assigner toutes les classes de l'année — réservé aux modérateurs. */
  @Post('assign/:profileId')
  assign(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { schoolYear } = parseOr400(
      z.object({ schoolYear: z.number().int().default(2026) }),
      body,
    );
    return this.service.assignAll(uuid.parse(profileId), schoolYear);
  }
}
