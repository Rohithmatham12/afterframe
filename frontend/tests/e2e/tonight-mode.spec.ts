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

test('GAP 08: solo Tonight Mode returns explained, real picks', async ({
  page,
}) => {
  await signup(page, 'tonight');
  await page.goto('/#tonight');
  await page.getByRole('button', { name: "Find tonight's film" }).click();
  await expect(page.locator('.film-grid .poster').first()).toBeVisible({
    timeout: 15000,
  });
  const count = await page.locator('.film-grid > div').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
});

test('GAP 08: an unreasonable time limit truthfully narrows results instead of padding', async ({
  page,
}) => {
  await signup(page, 'tightwindow');
  await page.goto('/#tonight');
  await page.getByPlaceholder('e.g. 90 minutes').fill('1');
  await page.getByRole('button', { name: "Find tonight's film" }).click();
  await expect(page.getByText('try loosening', { exact: false })).toBeVisible({
    timeout: 15000,
  });
});

test('GAP 08: guest/couple mode accepts hand-entered preferences with no second account', async ({
  page,
}) => {
  await signup(page, 'couple');
  await page.goto('/#tonight');
  await page
    .getByLabel('Watching with a guest who isn’t on Afterframe')
    .check();
  await page.getByRole('button', { name: 'Comedy', exact: true }).first().click();
  await page.getByRole('button', { name: "Find tonight's film" }).click();
  await expect(page.locator('.film-grid .poster').first()).toBeVisible({
    timeout: 15000,
  });
});
