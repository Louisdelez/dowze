/**
 * @dowze/core — logique de domaine pure (sans I/O), point d'entrée.
 *
 * Contient (à partir du jalon 2.20.0) : la loi de clôture R1-R8 du graphe de
 * compétences, la répétition espacée (SM-2), le knowledge tracing (BKT), le
 * calcul de planning déterministe, et le pipeline de validation du `.json` retour.
 * Tout est testé en isolation (Vitest), sans base de données.
 */
import { SCHEMAS_VERSION } from '@dowze/schemas';

export const CORE_VERSION = '2.19.0' as const;

export { SCHEMAS_VERSION };
