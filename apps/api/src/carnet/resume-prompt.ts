/**
 * Construit le **prompt de reprise** (PUR) : l'IA externe est sans mémoire ;
 * l'intra lui rend le contexte entre deux sessions (carnet de bord).
 * (cf. docs/10-APP-WEB/03-prompts-et-continuite.md)
 */
export interface ResumeContext {
  nextSkillTitle: string | null;
  masteredCount: number;
  lastNote?: string | null;
}

export function buildResumePrompt(ctx: ResumeContext): string {
  return [
    'Tu es mon tuteur Dowze. Reprends ma session là où je me suis arrêté.',
    `Compétences déjà maîtrisées : ${ctx.masteredCount}.`,
    ctx.nextSkillTitle
      ? `Prochaine compétence à travailler : « ${ctx.nextSkillTitle} ».`
      : 'Tronc commun terminé : on aborde la spécialisation.',
    ctx.lastNote ? `Dernière note de mon carnet : « ${ctx.lastNote} ».` : '',
    'Fais-moi penser (méthode socratique) ; ne donne pas la réponse toute faite.',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}
