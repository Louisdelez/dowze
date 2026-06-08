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
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
