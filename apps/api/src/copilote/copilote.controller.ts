import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  composeRequestSchema,
  courseCloseRequestSchema,
  ingestRequestSchema,
  updateSettingsSchema,
} from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard, safeEqual } from '../auth/supabase-auth.guard';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { CopiloteService } from './copilote.service';
import { CreditsService } from './credits.service';
import { LocalAiService } from './local-ai.service';

interface AuthedRequest {
  accountAuthId?: string;
}

const localResultSchema = z
  .object({ result: z.unknown().optional(), error: z.string().max(2000).optional() })
  .strict();

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
    private readonly localAi: LocalAiService,
  ) {}

  /** Dowze Desktop récupère le prochain travail destiné à Ollama sur CETTE machine. */
  @Get('local/jobs/next')
  async nextLocalJob(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new ForbiddenException();
    return { job: await this.localAi.next(req.accountAuthId) };
  }

  /** Dowze Desktop remet le résultat local; aucune adresse Ollama n'est exposée au serveur. */
  @Post('local/jobs/:id/result')
  async completeLocalJob(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!req.accountAuthId) throw new ForbiddenException();
    const value = parseOr400(localResultSchema, body);
    return this.localAi.complete(req.accountAuthId, uuid.parse(id), value.result, value.error);
  }

  /** Catalogue des modèles disponibles (multi-fournisseurs). */
  @Get('models')
  models() {
    return this.copilote.models();
  }

  /** Catalogue des modèles d'embedding (mémoire sémantique). */
  @Get('embedding-models')
  embeddingModels() {
    return this.copilote.embeddingModels();
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

  /** Cours NATIF : l'IA de Dowze génère la feuille A4 à modules (rendue en app). `null` si tout maîtrisé. */
  @Post('cours')
  @Throttle({ default: { ttl: 60_000, limit: 6 } }) // coûteux (LLM) — le cache absorbe les réouvertures
  cours(@Body() body: unknown) {
    const { profileId } = parseOr400(composeRequestSchema, body);
    return this.copilote.runCourse(profileId);
  }

  /** Clôture du cours natif : idempotente (1/jour/compétence) → Dowze recalcule la maîtrise (BKT+FSRS+carnet). */
  @Post('cours/cloture')
  closeCourse(@Body() body: unknown) {
    const { profileId, skillId, outcome, note } = parseOr400(courseCloseRequestSchema, body);
    return this.copilote.closeCourse(profileId, skillId, outcome, note);
  }

  /** Ingère le résumé de séance (texte) → snapshot → BKT + carnet. */
  @Post('ingest')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // coûteux (LLM)
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
    // Comparaison en temps constant (pas d'oracle temporel sur le secret).
    if (!token || !safeEqual(token, this.env.COPILOTE_ADMIN_TOKEN)) throw new ForbiddenException();
    const { profileId, credits, reason, ref } = parseOr400(grantSchema, body);
    const balance = await this.credits.grant(profileId, credits, reason, ref);
    return { profileId, balance };
  }
}
