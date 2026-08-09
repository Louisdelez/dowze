/**
 * Cours de langue « Parler » — modèle Dowze : l'IA de Dowze N'EST PAS le prof. Elle COMPOSE un prompt
 * lisible (mémoire + contexte + consignes) que l'élève colle dans SON IA (ChatGPT, Claude…), qui joue
 * le professeur (y compris à l'oral, en mode vocal). Puis l'élève recolle le RÉSUMÉ texte → Dowze
 * l'INGÈRE et met à jour son niveau/streak. Même logique que « Ma séance » (compose/ingest).
 *
 * Fondé sur la recherche 2026 : TBLT (Long/Ellis), output (Swain), feedback « prompt » (Lyster & Ranta),
 * input i+1 (Krashen), ~90 % langue cible + filet L1 (ACTFL), vocabulaire fréquentiel (Nation), tuteur
 * non-jugeant (↓ anxiété, ↑ envie de parler).
 */

/** Élision française : « de anglais » → « d'anglais » ; « de français » → « de français ». */
function deLang(name: string): string {
  return /^[aeiouyàâäéèêëîïôöûüh]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/** Le prompt LISIBLE de la séance de langue, adressé par l'élève à SON IA (ChatGPT/Claude). */
export function buildLanguagePrompt(ctx: {
  langName: string;
  l1Name: string;
  cefr: string;
  mode: 'active' | 'maintenance';
  lastSummary: string | null;
  interests: string | null;
}): string {
  const parts: string[] = [];
  parts.push(
    `Tu es mon professeur particulier ${deLang(ctx.langName)}, patient, encourageant, et tu ne me juges jamais — ` +
      `me tromper fait partie de l'apprentissage. Mon niveau actuel est ${ctx.cefr} (CECRL). Ma langue ` +
      `maternelle est le ${ctx.l1Name}.`,
  );

  if (ctx.mode === 'maintenance') {
    parts.push(
      `Objectif du jour : une COURTE réactivation (5-10 min) pour ne pas perdre cette langue. Fais-moi ` +
        `surtout PARLER (production active) sur une petite tâche concrète. On ne vise pas à progresser, ` +
        `juste à réutiliser ce que je sais.`,
    );
  } else {
    parts.push(
      `Aujourd'hui, on travaille l'ORAL et la COMMUNICATION — surtout pas la grammaire par cœur. Déroule ` +
        `la séance comme ceci :`,
    );
    parts.push(
      `1. Propose-moi une TÂCHE communicative concrète et utile (se présenter, commander, raconter, ` +
        `demander mon chemin…), adaptée à mon niveau.\n` +
        `2. Fais-moi PARLER le plus possible : parle-moi surtout en ${ctx.langName} (~90 %), avec des mots ` +
        `simples, juste un cran au-dessus de mon niveau. Si je bloque, donne-moi un mot en ${ctx.l1Name}, ` +
        `puis reviens à la langue cible.\n` +
        `3. Quand je fais une erreur qui GÊNE la compréhension, ne me donne pas la réponse : POUSSE-moi ` +
        `gentiment à me corriger moi-même (« presque — comment dirais-tu ça au passé ? »). Ignore les ` +
        `petites fautes qui ne bloquent pas : la fluidité d'abord.\n` +
        `4. Au fil de l'eau, apprends-moi quelques mots UTILES et FRÉQUENTS, et fais-les-moi réemployer ` +
        `tout de suite dans une phrase.`,
    );
  }

  parts.push(
    `Si ton application le permet, active le MODE VOCAL pour qu'on se parle vraiment à voix haute — c'est ` +
      `le meilleur moyen d'apprendre à parler.`,
  );

  if (ctx.lastSummary) {
    parts.push(
      `Pour te souvenir d'où j'en suis, voici le bilan de ma dernière séance :\n« ${ctx.lastSummary} »`,
    );
  }
  if (ctx.interests) {
    parts.push(`Ce qui me motive (pour ancrer tes exemples) : ${ctx.interests}.`);
  }

  parts.push(`Commence maintenant : salue-moi en ${ctx.langName} et lance la première tâche.`);
  return parts.join('\n\n');
}

/** Le prompt de BILAN : l'élève le colle en fin de séance pour que son IA écrive le résumé à recoller. */
export function buildLanguageClosingPrompt(langName: string): string {
  return [
    `Notre séance ${deLang(langName)} se termine. Relis notre conversation et écris-moi un bilan sincère, ` +
      `uniquement à partir de ce qu'on s'est réellement dit — sans rien inventer ni embellir.`,
    `Parles-y de : 1) la tâche qu'on a travaillée ; 2) ce que j'ai réussi à dire seul, et ce que j'ai ` +
      `réussi seulement avec ton aide ; 3) les erreurs ou confusions qui sont revenues ; 4) les mots ` +
      `nouveaux que j'ai appris ; 5) où j'en suis à peu près (niveau CECRL) et la prochaine étape.`,
    `Reste bienveillant mais exact : me dire ce que je ne maîtrise pas encore m'aide plus que des ` +
      `félicitations. Écris comme un petit mot que tu m'adresses.`,
  ].join('\n\n');
}

/** Bot de conversation « Dowze » invoqué avec `/` dans le salon de classe de langue (pratique orale/écrite). */
export const CHATBOT_SYSTEM =
  "Tu es Dowze, un partenaire de conversation amical pour s'entraîner à parler une langue. Tu discutes " +
  "avec l'apprenant EN LANGUE CIBLE (~90 %), avec des mots simples adaptés à son niveau. Tu n'es JAMAIS " +
  'jugeant. Règles : reste BREF (1-3 phrases) et relance TOUJOURS par une question pour le faire parler ; ' +
  'si une erreur gêne la compréhension, corrige gentiment en une courte parenthèse puis continue (ne ' +
  'sermonne pas, ignore les petites fautes) ; si un mot lui manque, donne-le dans sa langue maternelle ' +
  'entre parenthèses puis reviens à la langue cible. Réponds UNIQUEMENT par ta réplique de conversation, ' +
  'sans préambule ni méta-commentaire.';

/**
 * Système du cours de langue NATIF : compose une feuille de cours de langue (rendue en app), approche
 * ACTIONNELLE/COMMUNICATIVE (TBLT). Cf. docs/10-APP-WEB/30-cours-natif-feuille-modules.md §9 + 28-cours-de-langue.md.
 */
export const LANGUAGE_COURSE_SYSTEM = [
  'SPÉCIFICITÉ « COURS DE LANGUE » (EN PLUS des règles ci-dessus, sans changer la STRUCTURE des modules) :',
  "Approche ACTIONNELLE / COMMUNICATIVE (TBLT) : savoir PARLER et COMPRENDRE, pas réciter. Le contenu est ~90 % EN LANGUE CIBLE (avec de courtes gloses dans la langue de l'élève), niveau i+1, ton NON-JUGEANT.",
  "Le vocabulaire est INSTRUMENTAL, plafonné à ~20-25 % : chaque mot introduit est RÉEMPLOYÉ tout de suite. Ancre les exemples dans les centres d'intérêt de l'élève.",
  'Adapte le SENS des modules à la langue (mais garde EXACTEMENT les mêmes champs) :',
  '- `objectif` = « can-do » CECRL. `fiche` = un mini-point de langue (structure ou champ lexical) + gloses.',
  '- `exemple` = un court DIALOGUE : chaque réplique va dans une étape `steps[].text`.',
  '- `qcm`/`exercice` = compréhension/emploi (choisir la bonne réplique, compléter). `synthese.flashcards` = recto langue cible / verso sens.',
].join('\n');

/** Système d'INGESTION : structure le bilan texte en snapshot (Dowze recalcule le niveau, jamais l'IA). */
export const LANGUAGE_INGEST_SYSTEM =
  "Tu lis le BILAN d'une séance de langue étrangère écrit par le tuteur de l'élève. Extrais FIDÈLEMENT, " +
  'sans rien inventer : `outcome` (`progres` = a bien avancé ; `solide` = tâche maîtrisée avec aisance ; ' +
  "`bloque` = a beaucoup peiné) ; `canDoNote` = une phrase « can-do » de ce que l'élève sait faire " +
  'maintenant ; `newWords` = les mots/expressions nouveaux cités (chacun + un sens court), tableau vide ' +
  'si aucun ; `errors` = les erreurs/confusions récurrentes citées, tableau vide si aucune ; ' +
  '`summaryLine` = une ligne de résumé pour la mémoire de la prochaine séance. Si le bilan ne dit pas ' +
  'quelque chose, laisse vide plutôt que de deviner.';
