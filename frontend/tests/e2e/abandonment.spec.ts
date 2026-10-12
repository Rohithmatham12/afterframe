import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '3';
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

test('GAP 20: a paused film can be resumed, and finishing it for real clears the abandonment record', async ({
  page,
}) => {
  await signup(page, 'abandon');
  // Fight Club, TMDB 550, runtime 139.
  await page.goto('/#film/550');

  await page.getByRole('button', { name: 'Paused', exact: true }).click();
  await page.getByLabel('Stopped at (minutes, optional)').fill('42');
  await page.getByLabel('Reason (optional)').selectOption('too_intense');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Paused at 42 min · Too intense')).toBeVisible();

  // A film's runtime caps how much progress can be logged against it.
  await page.getByRole('button', { name: 'Mark abandoned' }).click();
  await page.getByLabel('Stopped at (minutes, optional)').fill('999');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText("exceed the film's runtime")).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // Resuming works: back to "started", so the resolved chip and its "Resume"
  // action are gone (the base started/paused/abandoned controls return).
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark abandoned' })).toHaveCount(0);

  // Finishing it for real (an actual diary log) must resolve the abandonment
  // record entirely — never shown as both paused and completed.
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-10-10');
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark abandoned' })).toHaveCount(0);
});
