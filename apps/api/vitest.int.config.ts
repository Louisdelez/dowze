import { defineConfig } from 'vitest/config';

/**
 * Config des tests d'INTÉGRATION (Postgres réel via Testcontainers).
 * Séparée du run unitaire : nécessite Docker + `@testcontainers/postgresql`.
 * Lancer avec : `npm run test:int`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.int.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
