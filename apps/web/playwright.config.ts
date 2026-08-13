import { defineConfig, devices } from '@playwright/test';

/**
 * Tests e2e (Playwright). Lance le serveur Next puis exécute les specs.
 * Exécution : `npm run build && npm run start` puis `npm run test:e2e -w @dowze/web`
 * (après `npx playwright install` pour les navigateurs).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  // Le canal `chrome` pilote le Google Chrome installé sur la machine, pas le Chromium embarqué.
  projects: [
    {
      name: 'google-chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
