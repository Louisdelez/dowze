import { Injectable } from '@nestjs/common';
import { z, type ZodTypeAny } from 'zod';
import type {
  AiField,
  ComposePluginBody,
  ComposePluginResult,
  IngestPluginBody,
  IngestPluginResult,
} from '@dowze/schemas';
import { CopiloteService } from '../copilote/copilote.service';

const INGEST_SYSTEM =
  "Tu es le module d'ingestion de Dowze. À partir du résumé écrit par l'utilisateur, tu extrais " +
  "FIDÈLEMENT les informations demandées — sans jamais rien inventer. Si une information n'apparaît pas " +
  "dans le résumé, laisse le champ vide ou nul. Tu ne donnes AUCUN conseil : tu ne fais qu'extraire.";

@Injectable()
export class PluginAiService {
  constructor(private readonly copilote: CopiloteService) {}

  /**
   * compose — DÉTERMINISTE, sans coût : à partir du contexte fourni par le plugin, Dowze assemble un
   * prompt LISIBLE que l'utilisateur donnera à SON IA (ChatGPT/Claude). L'IA de Dowze orchestre, le coach
   * reste l'IA de l'élève. Renvoie aussi un « closingPrompt » pour le résumé de fin (→ ingest).
   */
  compose(body: ComposePluginBody): ComposePluginResult {
    const lines: string[] = [];
    lines.push(`Tu es mon accompagnateur pour « ${body.title} ».`);
    if (body.goal) lines.push(`Mon objectif : ${body.goal}.`);
    if (body.level) lines.push(`Mon niveau : ${body.level}.`);
    if (body.context.length > 0) {
      lines.push('');
      lines.push('Contexte :');
      for (const c of body.context) lines.push(`- ${c.label} : ${c.value}`);
    }
    if (body.instructions) {
      lines.push('');
      lines.push(`Consignes : ${body.instructions}`);
    }
    lines.push('');
    lines.push(
      'Prépare-moi un plan concret et progressif, étape par étape, adapté à mon niveau, en français. ' +
        'Explique brièvement le pourquoi de chaque étape. Termine par UNE question pour vérifier que ' +
        "j'ai bien compris.",
    );
    const prompt = lines.join('\n');
    const closingPrompt =
      "Quand j'aurai terminé, aide-moi à résumer en quelques points : ce que j'ai fait, ce qui a bien " +
      'marché, ce qui a été difficile, et ce que je retiens pour la prochaine fois.';
    return { prompt, closingPrompt };
  }

  /**
   * ingest — texte → structuré : le plugin fournit un résumé + la liste des champs à extraire ; Dowze
   * construit le schéma, appelle `generateStructured` (crédits/BYOK réutilisés) et renvoie le snapshot.
   * Le plugin possède l'interprétation (il met à jour SA progression). Dowze ne fait qu'extraire.
   */
  async ingest(body: IngestPluginBody): Promise<IngestPluginResult> {
    const schema = buildSchemaFromFields(body.fields);
    const prompt =
      `Application : ${body.sourceApp}\nRésumé de l'utilisateur :\n"""\n${body.summary}\n"""\n\n` +
      'Extrais les informations structurées demandées.';
    const { object, creditsSpent } = await this.copilote.generateStructured<
      Record<string, unknown>
    >(body.profileId, {
      schema,
      schemaName: 'PluginSnapshot',
      system: INGEST_SYSTEM,
      prompt,
      ref: `${body.sourceApp}:ingest`,
      modelId: body.modelId,
    });
    return { snapshot: object, creditsSpent };
  }
}

/** Construit un schéma Zod à partir de la spec de champs sérialisable du plugin. */
function buildSchemaFromFields(fields: AiField[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) {
    let t: ZodTypeAny;
    switch (f.type) {
      case 'number':
        t = z.number();
        break;
      case 'integer':
        t = z.number().int();
        break;
      case 'boolean':
        t = z.boolean();
        break;
      case 'stringArray':
        t = z.array(z.string());
        break;
      case 'string':
      default:
        t = z.string();
        break;
    }
    if (f.description) t = t.describe(f.description);
    if (f.optional) t = t.optional();
    shape[f.key] = t;
  }
  return z.object(shape) as unknown as z.ZodType<Record<string, unknown>>;
}
