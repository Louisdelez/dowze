/**
 * @dowze/schemas — source de vérité unique des types du domaine Dowze.
 * Schémas Zod partagés par le frontend, le backend et la validation du pont `.json`.
 */

export const SCHEMAS_VERSION = '2.47.0' as const;

export * from './common';
export * from './skill';
export * from './cursus';
export * from './profile';
export * from './progression';
export * from './spaced-repetition';
export * from './planning';
export * from './content';
export * from './course';
export * from './validation';
export * from './bridge';
export * from './copilote';
export * from './account';
export * from './community';
export * from './moderation';
export * from './dossier';
export * from './placement';
export * from './exercises';
export * from './tests';
export * from './results';
export * from './rank-jump';
export * from './specialization';
export * from './xp';
export * from './social';
export * from './protections';
export * from './classes';
export * from './translation';
export * from './languages';
export * from './electives';
export * from './budget';
export * from './schedule';
export * from './plugins';
export * from './calendar';
export * from './plugin-ai';
