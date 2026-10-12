import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '8';
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

test('GAP 25: compatibility is honest about insufficient data and never fabricates a score', async ({
  browser,
}) => {
  const pageA = await (await browser.newContext()).newPage();
  const pageB = await (await browser.newContext()).newPage();
  await signup(pageA, 'compata');
  await signup(pageB, 'compatb');

  await pageA.goto('/#taste-partners');
  await pageA.getByLabel("Partner's username").fill(`compatb_${suffix}`);
  await pageA.getByRole('button', { name: 'Send request', exact: true }).click();

  await pageB.goto('/#taste-partners');
  await pageB.getByRole('button', { name: 'Accept', exact: true }).click();

  await pageA.reload();
  await pageA.getByRole('button', { name: 'Compare taste', exact: true }).click();
  await expect(
    pageA.getByText('Not enough shared answers yet', { exact: false })
  ).toBeVisible();

  await pageA.close();
  await pageB.close();
});
