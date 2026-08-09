import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { translateInputSchema } from '@dowze/schemas';
import { z } from 'zod';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TranslationService } from './translation.service';

const uuid = z.string().uuid();

@Controller('translate')
@UseGuards(SupabaseAuthGuard)
export class TranslationController {
  constructor(private readonly service: TranslationService) {}

  @Post(':profileId')
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // coûteux (LLM, LowCost)
  translate(@Param('profileId') profileId: string, @Body() body: unknown) {
    const input = parseOr400(translateInputSchema, body);
    return this.service.translate(uuid.parse(profileId), input.text, input.targetLang);
  }
}
