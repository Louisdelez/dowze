import { Module } from '@nestjs/common';
import { CopiloteModule } from '../copilote/copilote.module';
import { PluginsModule } from '../plugins/plugins.module';
import { PluginScopeGuard } from '../plugins/plugin-scope.guard';
import { PluginAiController } from './plugin-ai.controller';
import { PluginAiService } from './plugin-ai.service';

/**
 * IA/RAG scopée pour plugins (P3) — proxy scopé `ai:infer` vers le `CopiloteService` (compose/ingest,
 * crédits/BYOK réutilisés). Importe `CopiloteModule` (l'IA) et `PluginsModule` (identité/scopes).
 */
@Module({
  imports: [CopiloteModule, PluginsModule],
  controllers: [PluginAiController],
  providers: [PluginAiService, PluginScopeGuard],
})
export class PluginAiModule {}
