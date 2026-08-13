import { test, expect } from '@playwright/test';

/** Smoke public : l'app se charge dans un profil Chrome isolé, donc non authentifié. */
test('la bibliothèque publique présente Dowze', async ({ page }) => {
  await page.goto('/store');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bibliothèque');
  await expect(page.getByText('Un compte, un compagnon, partout.')).toBeVisible();
});

test('le compagnon reste accessible dans le Store', async ({ page }) => {
  await page.goto('/store');
  await expect(page.getByRole('button', { name: 'Compagnon Dowze' })).toBeVisible();
});

test('un clic sur le compagnon conserve la provenance', async ({ page }) => {
  await page.goto('/store');
  await page.getByRole('button', { name: 'Compagnon Dowze' }).click();
  await expect(page).toHaveURL(/\/compagnon\?from=%2Fstore$/);
});

test('le compagnon propose la connexion hors session', async ({ page }) => {
  await page.goto('/compagnon');
  await expect(page.getByText('Connecte-toi pour retrouver ton compagnon')).toBeVisible();
});

test('la racine de Dowze ouvre le système du compagnon', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/compagnon$/);
});

test('une fonction Académie reste dans la même application', async ({ page }) => {
  await page.goto('/planning');
  await expect(page).toHaveURL(/\/planning$/);
  await expect(
    page.getByRole('heading', { name: 'Connecte-toi pour voir ton planning' }),
  ).toBeVisible();
});
