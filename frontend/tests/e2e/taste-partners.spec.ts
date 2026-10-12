import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '7';
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

test('GAP 08 completion: a real consent flow connects two Afterframe accounts for Tonight Mode', async ({
  browser,
}) => {
  const pageA = await (await browser.newContext()).newPage();
  const pageB = await (await browser.newContext()).newPage();

  await signup(pageA, 'partnera');
  await signup(pageB, 'partnerb');

  // B answers the quiz so there's real taste to share.
  await pageB.goto('/#quiz');
  await pageB.getByRole('button', { name: 'Like', exact: true }).click();
  await pageB.getByRole('button', { name: 'Finish quiz', exact: true }).click();
  await expect(pageB.getByText('Your early taste map')).toBeVisible();

  // A requests a connection to B.
  await pageA.goto('/#taste-partners');
  await pageA
    .getByLabel("Partner's username")
    .fill(`partnerb_${suffix}`);
  await pageA.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(pageA.getByText('Request sent.')).toBeVisible();
  await expect(pageA.getByText('you invited', { exact: false })).toBeVisible();

  // Before acceptance, Tonight Mode with that partner must be refused.
  await pageA.goto('/#tonight');
  await pageA
    .getByLabel('Watching with a connected Afterframe partner')
    .check();
  await pageA
    .getByPlaceholder('their @username')
    .fill(`partnerb_${suffix}`);
  await pageA.getByRole('button', { name: "Find tonight's film" }).click();
  await expect(
    pageA.getByText("don't have an accepted taste-sharing connection", {
      exact: false,
    })
  ).toBeVisible();

  // B sees the invite and accepts it.
  await pageB.goto('/#taste-partners');
  await expect(pageB.getByText('invited you', { exact: false })).toBeVisible();
  await pageB.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(pageB.getByText('accepted')).toBeVisible();

  // Now Tonight Mode with the connected partner must succeed.
  await pageA.goto('/#tonight');
  await pageA
    .getByLabel('Watching with a connected Afterframe partner')
    .check();
  await pageA
    .getByPlaceholder('their @username')
    .fill(`partnerb_${suffix}`);
  await pageA.getByRole('button', { name: "Find tonight's film" }).click();
  await expect(pageA.locator('.film-grid .poster').first()).toBeVisible({
    timeout: 15000,
  });

  await pageA.close();
  await pageB.close();
});
