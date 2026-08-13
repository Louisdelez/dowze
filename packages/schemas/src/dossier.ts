import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * Le DOSSIER ÉLÈVE : l'IA de Dowze lit la présentation libre de l'élève et en
 * extrait un modèle d'apprenant structuré (Open Learner Model), que l'élève
 * VALIDE ensuite (human-in-the-loop). Garde-fous anti-invention : chaque champ
 * porte sa provenance ; ce qui n'est pas dit reste vide et va dans `aPreciser`.
 * (cf. docs/10-APP-WEB/19-onboarding-profil-placement.md)
 */

/** Statut d'un champ extrait : déclaré (dit), inféré (déduit) ou inconnu (non dit). */
export const provenanceStatutSchema = z.enum(['declare', 'infere', 'inconnu']);
export type ProvenanceStatut = z.infer<typeof provenanceStatutSchema>;

/** Un champ tracé : sa valeur, la citation source, et s'il est déclaré/inféré/inconnu. */
export const champTraceSchema = z
  .object({
    valeur: z.string().describe('La valeur extraite ; chaîne vide si non renseignée.'),
    source: z
      .string()
      .nullable()
      .describe('Citation EXACTE de la portion de texte qui justifie la valeur ; null si non dit.'),
    statut: provenanceStatutSchema.describe(
      'declare = dit explicitement ; infere = déduit ; inconnu = non dit (valeur vide).',
    ),
  })
  .strict();
export type ChampTrace = z.infer<typeof champTraceSchema>;

const themeSourceSchema = z
  .object({
    theme: z.string().describe('Un intérêt / une passion / un objectif, en quelques mots.'),
    source: z.string().nullable().describe('Citation source ; null si inféré.'),
  })
  .strict();

/** Le dossier structuré produit par l'IA (sortie stricte, portable multi-modèles). */
export const dossierSchema = z
  .object({
    prenom: z.string().describe("Le prénom de l'élève ; chaîne vide si non donné."),
    objectifPrincipal: champTraceSchema.describe("L'objectif principal en une phrase."),
    interets: z
      .array(themeSourceSchema)
      .describe(
        'Passions, hobbies, centres d’intérêt (funds of knowledge). Tableau vide si aucun.',
      ),
    objectifs: z
      .array(themeSourceSchema)
      .describe('Objectifs / rêves / ce que l’élève veut apprendre. Tableau vide si aucun.'),
    niveau: champTraceSchema.describe('Niveau ressenti / dernière classe suivie, si mentionné.'),
    langues: z.array(z.string()).describe('Langues parlées / maternelle. Tableau vide si aucune.'),
    contraintes: z
      .array(themeSourceSchema)
      .describe('Contraintes (temps, accessibilité, besoins). Tableau vide si aucune.'),
    preferences: z
      .array(z.string())
      .describe('Préférences DÉCLARÉES (format, rythme) — jamais un style figé. Vide si aucune.'),
    resumePedagogique: z
      .string()
      .describe(
        "Un court paragraphe, comme un prof qui présente l'élève : qui il est, ce qui le motive, " +
          'comment l’accrocher. Uniquement à partir de ce qui est dit.',
      ),
    aPreciser: z
      .array(z.string())
      .describe('Informations utiles NON fournies, à demander plus tard. Tableau vide si complet.'),
  })
  .strict();
export type Dossier = z.infer<typeof dossierSchema>;

/** La requête : la présentation de l'élève (champs + grand texte libre). */
export const presentationInputSchema = z
  .object({
    profileId: uuidSchema,
    prenom: z.string().max(80).default(''),
    nom: z.string().max(80).default(''),
    birthDate: z.string().date().nullable().default(null),
    languages: z.array(z.string().max(60)).max(10).default([]),
    location: z.string().max(120).default(''),
    objectif: z.string().max(500).default(''),
    presentation: z.string().min(1).max(8000),
  })
  .strict();
export type PresentationInput = z.infer<typeof presentationInputSchema>;

/** Le dossier stocké, tel que renvoyé par l'API (structuré + méta). */
export const dossierViewSchema = z.object({
  profileId: uuidSchema,
  structured: dossierSchema,
  validated: z.boolean().default(false),
});
export type DossierView = z.infer<typeof dossierViewSchema>;
