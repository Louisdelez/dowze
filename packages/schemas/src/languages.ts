import { z } from 'zod';

/**
 * Cours de langue « Parler » — priorité à la COMMUNICATION (TBLT), tuteur IA vocal non-jugeant, une
 * langue active à la fois, anciennes langues en maintenance. Cf. recherche 2026 (Long/Ellis TBLT,
 * Swain output, Nation seuil lexical, Cepeda espacement, Schmid attrition, Dörnyei ideal L2 self).
 */

/** Bande CECRL déduite du niveau continu (0→5). */
export function cefrOf(level: number): string {
  if (level >= 5) return 'C1';
  if (level >= 4) return 'B2';
  if (level >= 3) return 'B1';
  if (level >= 2) return 'A2';
  if (level >= 1) return 'A1';
  return 'A1';
}

/** Une proposition de langue (choix géographique) + son « pourquoi » projectif et concret. */
export const languageProposalSchema = z.object({
  lang: z.string(), // code court : en, de, es…
  name: z.string(), // nom affiché : anglais, allemand…
  pitch: z.string(), // 1-2 lignes : projectif + autonome + concret (jamais « tu dois »)
});
export type LanguageProposal = z.infer<typeof languageProposalSchema>;

/** L'état d'une langue apprise. */
export const learnerLanguageSchema = z.object({
  lang: z.string(),
  name: z.string(),
  status: z.enum(['active', 'maintenance']),
  level: z.number(), // 0→5
  cefr: z.string(), // A1…C1
  streak: z.number().int(),
  reasonPitch: z.string(),
  /** Maintenance due aujourd'hui (récupération espacée orientée production). */
  maintenanceDue: z.boolean(),
});
export type LearnerLanguage = z.infer<typeof learnerLanguageSchema>;

/** Vue de la page « Cours de langue ». */
export const languagesViewSchema = z.object({
  active: learnerLanguageSchema.nullable(),
  maintenance: z.array(learnerLanguageSchema),
  /** Propositions géographiques (si aucune langue active, ou pour la suivante). */
  proposals: z.array(languageProposalSchema),
  /** Catalogue complet pour un choix 100 % libre. */
  catalogue: z.array(z.object({ lang: z.string(), name: z.string() })),
  /** L'IA autorise-t-elle une NOUVELLE langue (langue active assez avancée) ? */
  canChooseNew: z.boolean(),
  /** Niveau requis (CECRL) pour débloquer la suivante — affiché honnêtement. */
  unlockCefr: z.string(),
  /** Durée conseillée de la séance du jour (minutes, selon l'âge). */
  dailyMinutes: z.number().int(),
  /** Projection can-do réaliste (« à ton rythme, B1 dans ~18 mois »). */
  projection: z.string(),
});
export type LanguagesView = z.infer<typeof languagesViewSchema>;

/**
 * La séance composée : un prompt LISIBLE que l'élève colle dans SON IA (ChatGPT/Claude), qui joue le
 * professeur (y compris à l'oral). Dowze ne fait PAS la conversation — même modèle que « Ma séance ».
 */
export const languageComposeSchema = z.object({
  lang: z.string(),
  name: z.string(),
  cefr: z.string(),
  mode: z.enum(['active', 'maintenance']),
  prompt: z.string(), // à copier dans son IA
  closingPrompt: z.string(), // à copier en fin de séance pour obtenir le bilan à recoller
});
export type LanguageCompose = z.infer<typeof languageComposeSchema>;

/** Résultat de l'ingestion du résumé (Dowze recalcule le niveau, jamais l'IA) : avancement + streak. */
export const languageIngestResultSchema = z.object({
  levelBefore: z.number(),
  levelAfter: z.number(),
  cefr: z.string(),
  streak: z.number().int(),
  outcome: z.enum(['progres', 'solide', 'bloque']),
  canDoNote: z.string(),
  newWords: z.array(z.object({ word: z.string(), meaning: z.string() })),
});
export type LanguageIngestResult = z.infer<typeof languageIngestResultSchema>;

/** Une classe de langue (canal « langue cible only »). */
export const languageClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetLang: z.string(),
  targetLangName: z.string(),
  channelId: z.string().nullable(),
  members: z.array(z.object({ profileId: z.string(), name: z.string(), level: z.number() })),
  /** L'apprenant a-t-il le niveau (A2 solide min) pour parler ici ? */
  canParticipate: z.boolean(),
  charter: z.string(), // charte visible du canal
});
export type LanguageClass = z.infer<typeof languageClassSchema>;
