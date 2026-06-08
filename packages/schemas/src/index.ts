/**
 * @dowze/schemas — source de vérité unique des types du domaine Dowze.
 * Schémas Zod partagés par le frontend, le backend et la validation du pont `.json`.
 */

export const SCHEMAS_VERSION = '2.19.0' as const;

export * from './common';
export * from './skill';
export * from './cursus';
export * from './profile';
export * from './progression';
export * from './spaced-repetition';
export * from './planning';
export * from './content';
export * from './validation';
export * from './bridge';
export * from './account';
export * from './community';
export * from './moderation';
