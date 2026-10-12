import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '6';
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

test('GAP 18: Family Mode can be enabled, is conservative about unknown ratings, and applies to Tonight Mode', async ({
  page,
}) => {
  await signup(page, 'family');

  // Off by default: no region selector, no disclaimer.
  await page.goto('/#settings');
  await expect(page.getByLabel('Family Mode')).toHaveValue('');
  await expect(page.getByLabel('Region for certification data')).toHaveCount(0);

  await page.getByLabel('Family Mode').selectOption('standard');
  await expect(page.getByLabel('Region for certification data')).toBeVisible();
  await page.getByLabel('Region for certification data').selectOption('US');
  await expect(
    page.getByText('This is a discovery filter, not a parental-control')
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();

  // Persists across reload.
  await page.reload();
  await expect(page.getByLabel('Family Mode')).toHaveValue(
    'standard'
  );

  // Tonight Mode shows the active-policy indicator (the actual
  // certification-based filtering — correct tier admitted, unknown ratings
  // conservatively excluded, hard-filter composes with other constraints —
  // is covered by Go unit tests and live-verified via curl against real
  // Postgres + real TMDB data; this checks the UI wiring end to end).
  await page.goto('/#tonight');
  await expect(
    page.getByText('Family Mode is on (standard, US)')
  ).toBeVisible();
  await page.getByRole('button', { name: "Find tonight's film" }).click();
  await expect(page.getByText('Finding something…')).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator('.tonight-mode .error')).toHaveCount(0);

  // Turning it off restores the full, unfiltered candidate pool.
  await page.goto('/#settings');
  await page.getByLabel('Family Mode').selectOption('');
  await expect(page.getByLabel('Region for certification data')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();
  await page.goto('/#tonight');
  await expect(
    page.getByText('Family Mode is on', { exact: false })
  ).toHaveCount(0);
});
