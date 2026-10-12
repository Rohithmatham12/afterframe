import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
const suffix = Date.now().toString(36) + 'a';
const password = 'Local-film-test-2026!';

async function signup(page: Page, persona: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create account' }).click();
  await page
    .getByLabel('Email', { exact: true })
    .fill(`${persona}-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(`${persona}_${suffix}`);
  await page.getByLabel('Display name', { exact: true }).fill(persona);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();
}

test('GAP 15: a real Letterboxd diary.csv imports matched films and reports unmatched ones honestly', async ({
  page,
}, testInfo) => {
  await signup(page, 'importer');

  const csv = [
    'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
    '2024-10-11,Fight Club,1999,https://boxd.it/x,4.5,,,2020-01-15',
    '2024-10-12,The Matrix,1999,https://boxd.it/y,5,Yes,,2020-02-20',
    '2024-10-13,Zzzqxv Nonexistent Film Title 99999,2099,https://boxd.it/z,,,,2020-03-01',
  ].join('\n');
  mkdirSync(testInfo.outputDir, { recursive: true });
  const csvPath = join(testInfo.outputDir, 'diary.csv');
  writeFileSync(csvPath, csv);

  await page.goto('/#import');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await expect(page.getByText('3 viewings ready to import')).toBeVisible();
  await page
    .getByRole('button', { name: 'Import 3 viewings', exact: true })
    .click();
  await expect(page.getByText('Imported 2 viewings. 1 skipped.')).toBeVisible({
    timeout: 15000,
  });
  await page.getByText('Skipped entries', { exact: true }).click();
  await expect(
    page.getByText('no confident match found', { exact: false })
  ).toBeVisible();

  await page.getByRole('button', { name: 'View your diary' }).click();
  await expect(page).toHaveURL(/#diary$/);
  await expect(page.locator('.diary article')).toHaveCount(2);

  // Re-uploading the same file must not duplicate entries.
  await page.goto('/#import');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await page
    .getByRole('button', { name: 'Import 3 viewings', exact: true })
    .click();
  await expect(page.getByText('Imported 2 viewings. 1 skipped.')).toBeVisible({
    timeout: 15000,
  });
  await page.goto('/#diary');
  await expect(page.locator('.diary article')).toHaveCount(2);
});
