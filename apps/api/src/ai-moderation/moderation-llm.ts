import { generateObject } from 'ai';
import { z } from 'zod';
import type { AiProvider } from '@dowze/schemas';
import { resolveModel } from '../copilote/provider';
import type { ClassifyResult } from './classify';

/**
 * IA de modération dédiée (LLM). Détecte harcèlement / insultes / menaces / contenu inapproprié /
 * grooming dans un contexte scolaire avec mineurs. Suspecte et signale — ne décide JAMAIS de sanction.
 * Doc 26 §7.3. Sortie structurée (Zod) pour un traitement fiable.
 */

const MOD_SCHEMA = z.object({
  flagged: z.boolean(),
  category: z.enum(['insulte', 'menace', 'harcelement', 'inapproprie']).nullable(),
  severity: z.enum(['moyen', 'grave', 'critique']),
  reason: z.string(),
});

const MOD_SYSTEM = `Tu es l'IA de modération de Dowze, une école en ligne fréquentée par des mineurs.
Analyse le message d'un utilisateur et détecte : insultes, harcèlement, menaces, contenu sexuel ou
sollicitation inappropriée (grooming). Tu SUSPECTES et SIGNALES — tu ne sanctionnes jamais.

Règles :
- Ne signale PAS un simple désaccord, une critique polie, de l'humour bon enfant, ni la seule
  mention d'une identité (origine, orientation, religion). Évite les faux positifs.
- Signale le harcèlement même implicite ou tournant (rabaissement répété, exclusion, incitation à
  se faire du mal), les menaces, et toute sollicitation sexuelle envers un mineur.
- severity : "moyen" (insulte isolée), "grave" (harcèlement, sollicitation), "critique" (menace
  crédible, incitation au suicide, grooming explicite).
- Réponds en te limitant au schéma. Si rien à signaler : flagged=false, category=null.
- Le champ reason est une explication courte en français, à destination d'un modérateur humain et
  du parent (sans citer d'insulte crue inutilement).`;

export async function classifyWithLlm(
  text: string,
  cfg: { provider: AiProvider; model: string; apiKey: string },
): Promise<ClassifyResult> {
  const lm = resolveModel(cfg.provider, cfg.model, cfg.apiKey);
  const { object } = await generateObject({
    model: lm,
    schema: MOD_SCHEMA,
    schemaName: 'Moderation',
    system: MOD_SYSTEM,
    prompt: text,
    temperature: 0,
  });
  return {
    flagged: object.flagged && object.category !== null,
    category: object.category,
    reason: object.reason || 'Signalé par l’IA de modération.',
    severity: object.severity,
    match: null,
  };
}
