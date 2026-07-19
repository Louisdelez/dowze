/**
 * Composition des prompts LISIBLES du Copilote (déterministe, côté serveur).
 * Aucun `.json` : du texte clair, pensé pour activer les modes « Étude » des IA
 * grand public (ChatGPT Study Mode / Claude Learning) et se clôturer par un résumé.
 */

export interface SessionPromptCtx {
  title: string;
  pct: number;
  masteredCount: number;
  lastNote: string | null;
}

/** Le prompt du jour, à copier dans l'IA de l'élève. */
export function buildSessionPrompt(ctx: SessionPromptCtx): string {
  const reprise = ctx.lastNote
    ? `Reprise — la dernière fois : « ${ctx.lastNote} ». Commence par une courte question de rappel là-dessus avant d'avancer.`
    : `C'est notre première séance sur cette compétence.`;

  return [
    `Tu es mon professeur particulier. Nous travaillons UNE compétence aujourd'hui : « ${ctx.title} ».`,
    reprise,
    `Passe en mode « étude » / tuteur : interroge-moi une question à la fois, ne me donne pas les réponses tout de suite, fais-moi réfléchir, et corrige-moi immédiatement. Si tu peux, propose-moi des flashcards ou un petit quiz sur cette compétence.`,
    `Adapte-toi à mon niveau (j'estime ma maîtrise à ${ctx.pct}% ; j'ai déjà validé ${ctx.masteredCount} compétence(s)).`,
    `IMPORTANT — à la toute fin de la séance, écris-moi un court RÉSUMÉ DE SÉANCE en français simple : ce qu'on a vu, ce que j'ai réussi ou pas, mes erreurs, mon ressenti, et la prochaine étape. Ce résumé, je le recollerai dans Dowze pour garder la mémoire de ma progression.`,
  ].join('\n\n');
}

/** Consigne système du Copilote pour EXTRAIRE le snapshot du résumé (texte → structuré). */
export const EXTRACTION_SYSTEM = [
  "Tu es le Copilote de Dowze. Tu ne notes pas l'élève : tu EXTRAIS des faits d'un résumé de séance rédigé par une autre IA.",
  "Reste STRICTEMENT fidèle au résumé : n'invente aucune information. Si le résumé ne permet pas de conclure sur un point, dis-le dans `uncertainty` et reste prudent sur `outcome`.",
  'Écris en français, de façon concise et bienveillante.',
].join(' ');

/** Le message utilisateur : le résumé brut à structurer. */
export function extractionPrompt(summary: string): string {
  return `Voici le résumé de séance à structurer :\n\n"""\n${summary}\n"""`;
}
