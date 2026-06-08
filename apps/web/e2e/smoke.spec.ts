import { test, expect } from '@playwright/test';

/** Smoke e2e : l'app se charge et la navigation fonctionne. */
test('la page d’accueil présente Dowze', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Apprendre');
  await expect(page.getByRole('link', { name: 'Dowze' })).toBeVisible();
});

test('navigation vers le tableau de bord', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Tableau de bord' }).first().click();
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
});

test('navigation vers le pont .json', async ({ page }) => {
  await page.goto('/bridge');
  await expect(page.getByRole('heading', { name: 'Le pont .json' })).toBeVisible();
});
