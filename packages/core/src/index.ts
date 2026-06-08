/**
 * @dowze/core — logique de domaine pure (sans I/O).
 *
 * Loi de clôture du graphe (zéro trou), BKT (maîtrise), SM-2 (révision espacée),
 * planning déterministe, validation par paliers, et pipeline de validation du
 * pont `.json`. Tout est testé en isolation, sans base de données.
 */

export const CORE_VERSION = '2.34.0' as const;
export { SCHEMAS_VERSION } from '@dowze/schemas';

// Cursus
export * from './cursus/expedition';

// Graphe & loi de clôture
export * from './closure/graph';
export * from './closure/closure';
export * from './closure/frontier';
export * from './closure/diagnostic';

// Suivi de maîtrise & révision
export * from './bkt/bkt';
export * from './sm2/sm2';

// Planning
export * from './planning/planning';
export * from './planning/timer';

// Pont .json
export * from './bridge/prototype-guard';
export * from './bridge/validate';
export * from './bridge/build';

// Validation par paliers
export * from './validation/tier';

// Utilitaires
export * from './util/math';
export * from './util/date';
