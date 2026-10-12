import { test, expect } from '@playwright/test';
const suffix = Date.now().toString(36) + '9';
const password = 'Local-film-test-2026!';

test('GAP 01: TMDB rating and community reviews are shown, clearly labelled, and never presented as native', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create account' }).click();
  await page
    .getByLabel('Email', { exact: true })
    .fill(`tmdbcontent-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await page
    .getByLabel('Username', { exact: true })
    .fill(`tmdbcontent_${suffix}`);
  await page.getByLabel('Display name', { exact: true }).fill('tmdbcontent');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();

  // Fight Club, TMDB 550 — forced fresh in this session's live verification,
  // has real vote data and real community reviews.
  await page.goto('/#film/550');
  await expect(page.getByText(/TMDB rating: \d\.\d\/10 \(/)).toBeVisible();

  await page
    .getByText(/TMDB community reviews \(\d+\)/)
    .click();
  await expect(
    page.getByText('own community wrote — not Afterframe users', {
      exact: false,
    })
  ).toBeVisible();
  await expect(page.getByText(/TMDB community review ·/).first()).toBeVisible();

  // "A little perspective" (Afterframe's own reviews) stays a visibly
  // separate section, never merged with TMDB's.
  await expect(page.getByRole('heading', { name: 'A little perspective' })).toBeVisible();
});
