import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import {
  composeRequestSchema,
  ingestRequestSchema,
  updateSettingsSchema,
} from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { CopiloteService } from './copilote.service';
import { CreditsService } from './credits.service';

const uuid = z.string().uuid();

const grantSchema = z
  .object({
    profileId: z.string().uuid(),
    credits: z.number().positive().max(1_000_000),
    reason: z.string().max(60).default('grant'),
    ref: z.string().max(120).optional(),
  })
  .strict();

@Controller('copilote')
@UseGuards(SupabaseAuthGuard)
export class CopiloteController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly copilote: CopiloteService,
    private readonly credits: CreditsService,
  ) {}

  /** Catalogue des modèles disponibles (multi-fournisseurs). */
  @Get('models')
  models() {
    return this.copilote.models();
  }

  /** Réglages Copilote de l'élève (jamais la clé BYOK en clair). */
  @Get('settings/:profileId')
  getSettings(@Param('profileId') profileId: string) {
    return this.copilote.getSettings(uuid.parse(profileId));
  }

  @Post('settings')
  updateSettings(@Body() body: unknown) {
    return this.copilote.updateSettings(parseOr400(updateSettingsSchema, body));
  }

  /** Compose le prompt LISIBLE du jour (déterministe, sans coût). */
  @Post('compose')
  compose(@Body() body: unknown) {
    const { profileId } = parseOr400(composeRequestSchema, body);
    return this.copilote.compose(profileId);
  }

  /** Ingère le résumé de séance (texte) → snapshot → BKT + carnet. */
  @Post('ingest')
  ingest(@Body() body: unknown) {
    return this.copilote.ingest(parseOr400(ingestRequestSchema, body));
  }

  /** Solde de crédits Dowze. */
  @Get('balance/:profileId')
  async balance(@Param('profileId') profileId: string) {
    const id = uuid.parse(profileId);
    return { profileId: id, balance: await this.credits.balance(id) };
  }

  /**
   * Créditer un solde. Protégé par un jeton d'administration (en attendant le
   * webhook Stripe). Sans `COPILOTE_ADMIN_TOKEN` configuré, l'endpoint est désactivé.
   */
  @Post('credits/grant')
  async grant(@Headers('x-admin-token') token: string | undefined, @Body() body: unknown) {
    if (!this.env.COPILOTE_ADMIN_TOKEN) {
      throw new ServiceUnavailableException('Octroi de crédits désactivé (Stripe non configuré).');
    }
    if (token !== this.env.COPILOTE_ADMIN_TOKEN) throw new ForbiddenException();
    const { profileId, credits, reason, ref } = parseOr400(grantSchema, body);
    const balance = await this.credits.grant(profileId, credits, reason, ref);
    return { profileId, balance };
  }
}
