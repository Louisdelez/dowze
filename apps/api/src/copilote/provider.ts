import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { AiProvider } from '@dowze/schemas';
import type { Env } from '../config/env';

/**
 * Registre de fournisseurs : (provider, modelId, apiKey) → modèle du Vercel AI SDK.
 * Une seule abstraction pour tous les fournisseurs — on ne réécrit rien par modèle.
 */
export function resolveModel(
  provider: AiProvider,
  modelId: string,
  apiKey: string,
  _env?: Env,
): LanguageModelV1 {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case 'mistral':
      return createMistral({ apiKey })(modelId);
    case 'deepseek':
      return createDeepSeek({ apiKey })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId);
  }
}

/** Clé API du fournisseur en mode « crédits » (clé de la plateforme), ou undefined si absente. */
export function platformKeyFor(provider: AiProvider, env: Env): string | undefined {
  switch (provider) {
    case 'openai':
      return env.OPENAI_API_KEY;
    case 'google':
      return env.GOOGLE_GENERATIVE_AI_API_KEY;
    case 'mistral':
      return env.MISTRAL_API_KEY;
    case 'deepseek':
      return env.DEEPSEEK_API_KEY;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY;
  }
}
