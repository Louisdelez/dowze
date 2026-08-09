import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { composePluginBodySchema, ingestPluginBodySchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PluginScopeGuard, RequirePluginScope } from '../plugins/plugin-scope.guard';
import { PluginAiService } from './plugin-ai.service';

/**
 * IA/RAG scopée pour plugins — versionnée `/v1/`. Un plugin (scope `ai:infer`) compose un prompt et ingère
 * un résumé via l'IA de Dowze (crédits/BYOK réutilisés), sans réimplémenter l'IA. Modèle compose/ingest :
 * Dowze orchestre, le coach reste l'IA de l'élève.
 */
@Controller('v1/ai')
@UseGuards(SupabaseAuthGuard)
export class PluginAiController {
  constructor(private readonly service: PluginAiService) {}

  /** Contexte du plugin → prompt lisible (déterministe, sans coût). */
  @Post('compose')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('ai:infer')
  compose(@Body() body: unknown) {
    return this.service.compose(parseOr400(composePluginBodySchema, body));
  }

  /** Résumé texte + champs → snapshot structuré (via l'IA, facturé/scopé). */
  @Post('ingest')
  @UseGuards(PluginScopeGuard)
  @RequirePluginScope('ai:infer')
  ingest(@Body() body: unknown) {
    return this.service.ingest(parseOr400(ingestPluginBodySchema, body));
  }
}
