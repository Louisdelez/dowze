import type { ExpeditionPhase } from '@dowze/schemas';

/** Système : proposer 3 expéditions différenciées, calibrées à l'élève. */
export const EXPEDITION_PROPOSE_SYSTEM = [
  "Tu es le Copilote de Dowze. Tu proposes 3 EXPÉDITIONS (projets d'apprentissage) à un élève.",
  'Chaque expédition = un titre accrocheur + une GRANDE QUESTION ouverte (non googlable, faisable, éthique)',
  '+ ce que l’élève produira (audience réelle) + ce qu’il apprendra.',
  'Les 3 doivent être RÉELLEMENT DIFFÉRENCIÉES : varie le domaine, le type de produit (créer / enquêter /',
  'défendre) et le registre. Jamais 3 variantes cosmétiques. Calibre au niveau et aux intérêts de l’élève.',
  'Français, clair et motivant.',
].join(' ');

export function expeditionProposePrompt(ctx: {
  resume: string;
  interets: string[];
  age: number | null;
}): string {
  const lignes = [
    ctx.age !== null ? `Âge de l'élève : ${ctx.age} ans.` : null,
    ctx.resume ? `Ce que Dowze sait de lui : ${ctx.resume}` : null,
    ctx.interets.length > 0 ? `Ses intérêts : ${ctx.interets.join(', ')}.` : null,
  ].filter(Boolean);
  return (
    (lignes.length > 0
      ? lignes.join('\n')
      : "On sait peu de choses sur l'élève ; propose large et engageant.") +
    '\n\nPropose 3 expéditions différenciées.'
  );
}

const PHASE_INTENT: Record<ExpeditionPhase, string> = {
  etincelle:
    "ÉTINCELLE (l'accroche) : rends la grande idée vivante (histoire, fait surprenant, tension réelle) pour faire SENTIR sa valeur, reliée à ce que l'élève aime.",
  question:
    "QUESTION : aide l'élève à s'approprier/reformuler la grande question et à lister ses sous-questions (ouverte, non googlable, faisable).",
  defi: 'DÉFI : transforme la question en enquête concrète vers un produit ; apprends à CHERCHER et ÉVALUER les sources (méthode SIFT, lecture latérale), avec des pistes de départ.',
  acte: "ACTE : construis le produit authentique, avec un cycle critique & révision (un pair) avant la version publique. L'IA aide à structurer, ne rédige pas à la place.",
  trace:
    "TRACE : consigne la preuve et une méta-réflexion (cycle de Gibbs). C'est la pièce évaluée et la mémoire de l'app.",
};

/** Système : guider une phase d'expédition (7 règles du tutorat IA). */
export const EXPEDITION_PHASE_SYSTEM = [
  "Tu es le Copilote de Dowze. Tu prépares le GUIDAGE d'une phase d'expédition pour un élève.",
  'Produis : (1) une explication brève de la phase et comment l’aborder ;',
  "(2) un PROMPT prêt à coller dans l'IA-prof de l'élève, en mode socratique (une question à la fois,",
  "l'élève tente d'abord, des indices pas des solutions, on estompe l'aide) ;",
  '(3) des pistes de départ concrètes. Français, simple et chaleureux.',
].join(' ');

export function expeditionPhasePrompt(ctx: {
  title: string;
  grandeQuestion: string;
  phase: ExpeditionPhase;
}): string {
  return [
    `Expédition : « ${ctx.title} »`,
    `Grande question : ${ctx.grandeQuestion}`,
    `Phase à guider : ${PHASE_INTENT[ctx.phase]}`,
  ].join('\n');
}
