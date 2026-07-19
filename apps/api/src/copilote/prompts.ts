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
    ? `La dernière fois, on en était là : « ${ctx.lastNote} ». Commence par une courte question pour voir ce qu'il m'en reste, puis on avance.`
    : `C'est notre toute première séance sur cette compétence : pars du début, sans rien supposer de connu.`;

  return [
    `Tu es mon professeur particulier pour cette séance. On travaille une seule compétence aujourd'hui : « ${ctx.title} ».`,
    reprise,
    `Fonctionne comme un tuteur : pose-moi une question à la fois, laisse-moi chercher par moi-même, aide-moi avec des indices quand je bloque, et corrige-moi tout de suite quand je me trompe. Quand c'est utile, illustre avec un exemple concret, ou propose-moi une flashcard ou une petite question pour m'entraîner.`,
    `Adapte ton niveau au mien : j'estime ma maîtrise à ${ctx.pct}% et j'ai déjà validé ${ctx.masteredCount} compétence(s).`,
    `À la fin, je te demanderai un court bilan de la séance : garde donc en tête, au fil de l'échange, ce que je réussis vraiment et ce sur quoi je bute.`,
  ].join('\n\n');
}

/**
 * Le prompt de BILAN : à copier par l'élève À LA FIN de la séance et à coller dans
 * son IA (Claude/ChatGPT) pour qu'elle rédige le résumé — que l'élève recolle ensuite
 * dans Dowze. Texte clair optimisé pour être ensuite structuré par le Copilote.
 */
export function buildClosingPrompt(skillTitle: string): string {
  return [
    `Notre séance sur « ${skillTitle} » se termine. Relis notre conversation, puis écris-moi un bilan sincère de ce qu'on vient de faire — uniquement à partir de ce qu'on s'est réellement dit, sans rien deviner ni embellir. Si un point n'a pas été abordé, ou si tu n'as pas assez d'éléments pour en juger, dis-le franchement plutôt que de combler les trous.`,
    `Ton but n'est pas de me faire plaisir mais de m'aider à voir où j'en suis vraiment : garde un ton bienveillant, mais reste exact. Me dire clairement ce que je ne maîtrise pas encore m'aide plus que des félicitations.`,
    `Écris comme un mot que tu m'adresses, en quelques paragraphes qui s'enchaînent, en t'appuyant sur des moments précis de la séance. Prends soin d'y parler de :`,
    `1. ce qu'on a travaillé aujourd'hui ;\n2. ce que j'ai réussi tout seul, et ce que j'ai réussi seulement avec ton aide ;\n3. ce que je n'ai pas encore réussi, et les erreurs ou confusions qui sont revenues ;\n4. comment je semblais me sentir pendant qu'on avançait (confiance, doute, frustration, enthousiasme…) ;\n5. la prochaine étape que tu me conseilles pour continuer à progresser.`,
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
