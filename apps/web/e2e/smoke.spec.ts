import { test, expect } from '@playwright/test';

/** Smoke e2e : l'app se charge et la navigation (barre latérale) fonctionne. */
test('la page d’accueil présente Dowze', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Apprendre');
  await expect(page.getByRole('link', { name: 'Dowze' })).toBeVisible();
});

test('le tableau de bord « Aujourd’hui » se charge', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Aujourd');
  // La barre latérale groupée est présente.
  await expect(page.getByText('Apprendre')).toBeVisible();
});

test('navigation vers la séance depuis la barre latérale', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Ma séance' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ma séance');
});

test('navigation vers le pont .json', async ({ page }) => {
  await page.goto('/bridge');
  await expect(page.getByRole('heading', { name: 'Le pont .json' })).toBeVisible();
});
