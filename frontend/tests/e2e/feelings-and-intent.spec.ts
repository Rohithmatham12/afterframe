import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '2';
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

test('GAP 04: a viewing carries its own feelings, and logging stays optional without them', async ({
  page,
}) => {
  await signup(page, 'feels');
  await page.goto('/#film/550');
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-10-10');
  // Deliberately skip feelings to prove the loop stays optional.
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/#film/603');
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-10-11');
  await page.getByRole('button', { name: 'comforted', exact: true }).click();
  await page.getByRole('button', { name: 'inspired', exact: true }).click();
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/#diary');
  await expect(page.locator('.diary article').first()).toContainText(
    'comforted'
  );
  await expect(page.locator('.diary article').first()).toContainText(
    'inspired'
  );
  await expect(page.locator('.diary article').last()).not.toContainText(
    'comforted'
  );
});

test('GAP 07: watchlist intent is optional, editable, and filterable', async ({
  page,
}) => {
  await signup(page, 'intent');
  await page.goto('/#film/680');
  await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Added' })).toBeVisible();

  await page.goto('/#watchlist');
  await expect(page.getByLabel('Saved for')).toHaveValue('');
  await page.getByLabel('Saved for').selectOption('rainy_day');

  await page.getByRole('button', { name: 'Date night', exact: true }).click();
  await expect(
    page.getByText('Nothing saved for that reason yet')
  ).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByLabel('Saved for')).toHaveValue('rainy_day');
});
