import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '1';
const password = 'Local-film-test-2026!';

async function freshAccount(page: Page, persona: string) {
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
}

test('settings never shows a raw generated id as the username label', async ({
  page,
}) => {
  await freshAccount(page, 'label');
  // The field itself must start from the backend's "film_..." placeholder so this
  // test is meaningful, but nothing on the page should render it as a finished name.
  await expect(page.getByText(/^film_[a-f0-9]{20}$/)).toHaveCount(0);
  await expect(
    page.getByText('still using a generated username', { exact: false })
  ).toBeVisible();
});

test('typing an uppercase username gives a specific message, not a native format error', async ({
  page,
}) => {
  await freshAccount(page, 'format');
  const input = page.getByLabel('Username', { exact: true });
  await input.fill('Strike_' + suffix);
  await expect(
    page.getByText('Available.', { exact: true })
  ).toBeVisible();
  // The browser's own validation bubble ("Please match the requested format")
  // is not an accessibility-tree element our copy controls; what matters is that
  // our own status text — not that bubble — is what explains the field.
  await input.fill('ab');
  await expect(page.getByText('Use at least 3 characters.')).toBeVisible();
  await input.fill('strike@movies');
  await expect(
    page.getByText('Remove the @ symbol.', { exact: false })
  ).toBeVisible();
  // Preserves what the user typed through a failed validation round.
  await expect(input).toHaveValue('strike@movies');
});

test('a taken username offers suggestions and blocks submission until resolved', async ({
  page,
  browser,
}) => {
  await freshAccount(page, 'claim');
  await page.getByLabel('Username', { exact: true }).fill('clash_' + suffix);
  await page.getByLabel('Display name', { exact: true }).fill('Claimer');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();

  const second = await browser.newPage();
  await freshAccount(second, 'rival');
  const input = second.getByLabel('Username', { exact: true });
  await input.fill('clash_' + suffix);
  await expect(second.getByText('That username is taken.')).toBeVisible();
  await expect(
    second.getByRole('button', { name: 'Save profile', exact: true })
  ).toBeDisabled();
  const suggestion = second.getByRole('button', { name: /clash_/ }).first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(second.getByText('Available.', { exact: true })).toBeVisible();
  await expect(
    second.getByRole('button', { name: 'Save profile', exact: true })
  ).toBeEnabled();
  await second.close();
});
