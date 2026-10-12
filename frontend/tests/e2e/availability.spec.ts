import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '4';
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

test('GAP 24: streaming availability shows JustWatch attribution and respects region', async ({
  page,
}) => {
  await signup(page, 'stream');
  await page.goto('/#film/603');
  const section = page.locator('.availability');
  await expect(section).toBeVisible();
  await expect(
    section.getByRole('link', { name: 'JustWatch' })
  ).toHaveAttribute('href', 'https://www.justwatch.com');
  await section.getByLabel('Region').selectOption('GB');
  await expect(section.getByText('Checked', { exact: false })).toBeVisible();
});

test('GAP 24: availability-change notifications are opt-in and persist', async ({
  page,
}) => {
  await signup(page, 'notifyavail');
  await page.goto('/#settings');
  const toggle = page.getByLabel(
    /Notify me when a watchlisted film.s streaming availability changes/
  );
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel(
      /Notify me when a watchlisted film.s streaming availability changes/
    )
  ).toBeChecked();
});
