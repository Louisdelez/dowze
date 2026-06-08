import { zodToJsonSchema } from 'zod-to-json-schema';
import { bridgePayloadSchemaByOperation, type BridgeOperation } from '@dowze/schemas';

// Signature simplifiée : évite l'instanciation de type trop profonde (TS2589)
// due au générique de zod-to-json-schema appliqué à l'union des payloads.
const toJsonSchema = zodToJsonSchema as unknown as (
  schema: unknown,
  name?: string,
) => Record<string, unknown>;

/**
 * Construction du contenu du `.json` ALLER : le JSON Schema attendu (dérivé du
 * schéma Zod du payload), le prompt système, et un exemple few-shot.
 * Fonctions PURES (testables sans Nest).
 */

/** JSON Schema du retour attendu pour une opération (transmis à l'IA). */
export function responseSchemaFor(op: BridgeOperation): Record<string, unknown> {
  return toJsonSchema(bridgePayloadSchemaByOperation[op], op);
}

const SYSTEM_PROMPTS: Record<BridgeOperation, string> = {
  'generer-competence':
    "Génère la compétence demandée AINSI QUE toute sa chaîne de prérequis jusqu'aux racines " +
    '(loi de clôture : aucun prérequis manquant, profondeurs décroissantes, pas de cycle).',
  'generer-ossature':
    'Génère un fragment cohérent du graphe de compétences (voisinage local), sans trou ni cycle.',
  'generer-expedition':
    'Conçois une expédition (2-6 semaines) autour d\'une grande question, gabarit Étincelle→Question→Défi→Acte→Trace.',
  'generer-grille':
    'Produis la grille (rubrique binaire) d\'une compétence : critères observables, démontrables, sans QCM.',
  'generer-cours':
    'Rédige une leçon avec objectifs explicites et exemples résolus (réduire la charge cognitive).',
  'generer-plan':
    'Propose des entrées de planning réalistes et bienveillantes pour la période demandée.',
};

export function promptFor(
  op: BridgeOperation,
  ctx: { seed: string; instruction?: string },
): string {
  return [
    "Tu es le générateur de l'Atlas Dowze. Réponds UNIQUEMENT par un JSON conforme au schéma fourni.",
    SYSTEM_PROMPTS[op],
    `Graine déterministe : ${ctx.seed}`,
    ctx.instruction ? `Demande : ${ctx.instruction}` : '',
  ]
    .filter((s) => s.length > 0)
    .join('\n\n');
}

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000001';

/** Exemple minimal valide par opération (few-shot). */
export function exampleFor(op: BridgeOperation): unknown {
  switch (op) {
    case 'generer-competence':
      return {
        skill: {
          id: SAMPLE_UUID,
          slug: 'exemple-competence',
          title: 'Exemple',
          kind: 'savoir-faire',
          depth: 0,
          isRoot: true,
        },
        closure: [],
      };
    case 'generer-ossature':
      return {
        skills: [
          { id: SAMPLE_UUID, slug: 'racine', title: 'Racine', kind: 'savoir', depth: 0, isRoot: true },
        ],
      };
    case 'generer-grille':
      return {
        rubric: {
          skillId: SAMPLE_UUID,
          criteria: [{ id: 'critere-1', label: 'Sait démontrer X', required: true }],
        },
      };
    case 'generer-cours':
      return {
        lesson: {
          skillId: SAMPLE_UUID,
          title: 'Leçon exemple',
          sections: [{ heading: 'Introduction', body: 'Contenu…' }],
        },
      };
    case 'generer-plan':
      return { entries: [] };
    case 'generer-expedition':
      return {
        expedition: {
          id: SAMPLE_UUID,
          slug: 'exemple-expedition',
          title: 'Exemple',
          grandeQuestion: 'Pourquoi… ?',
          fils: ['fondations'],
          durationWeeks: 3,
        },
      };
  }
}
