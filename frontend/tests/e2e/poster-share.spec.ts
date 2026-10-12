import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '4';
const password = 'Local-film-test-2026!';
const longExcerpt =
  'This film completely rearranged how I think about memory and grief, ' +
  'in a way that snuck up on me about halfway through the second act and ' +
  'never really let go afterward, even days later, long after the credits ' +
  'had finished rolling and the lights had come back up in the room.';

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

async function writeReview(page: Page) {
  // Fight Club, TMDB 550 — has a real poster image.
  await page.goto('/#film/550');
  await page.getByRole('button', { name: 'Write review', exact: true }).click();
  await page
    .getByLabel('Before watching · spoiler-safe', { exact: true })
    .fill('No spoilers, just vibes.');
  await page
    .getByLabel('After watching · plot discussion', { exact: true })
    .fill(longExcerpt);
  await page.getByRole('button', { name: 'Publish review', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('GAP 16: a one-tap poster renders with a truncated excerpt and downloads as an image', async ({
  page,
}) => {
  await signup(page, 'poster');
  await writeReview(page);

  await page.getByRole('button', { name: 'Share poster', exact: true }).click();
  const canvas = page.getByRole('img', { name: /Poster preview for Fight Club/ });
  await expect(canvas).toBeVisible();

  // The download link only activates once the canvas has actually rendered
  // a real image (aria-disabled flips false), not immediately on open.
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveAttribute(
    'aria-disabled',
    'false',
    { timeout: 10000 }
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download image' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^afterframe-550-poster\.png$/);
  const path = await download.path();
  expect(path).toBeTruthy();

  // Switching aspect ratio re-renders without crashing or losing the review data.
  await page.getByLabel('Aspect ratio').selectOption('story');
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveAttribute(
    'aria-disabled',
    'false',
    { timeout: 10000 }
  );

  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('GAP 16: a poster image that fails to load falls back gracefully instead of breaking', async ({
  page,
}) => {
  await signup(page, 'posterfail');
  await writeReview(page);

  // Simulate a missing/unreachable poster image (CORS failure, dead CDN
  // link, etc.) by aborting the TMDB image request — the generator must
  // still produce a complete, downloadable poster via its gradient fallback.
  await page.route('https://image.tmdb.org/**', (route) => route.abort());

  await page.getByRole('button', { name: 'Share poster', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('img', { name: /Poster preview for Fight Club/ })
  ).toBeVisible();
  await expect(dialog.getByText("Could not render")).toHaveCount(0);
  await expect(dialog.getByText('browser has no canvas support')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download image' })).toHaveAttribute(
    'aria-disabled',
    'false',
    { timeout: 10000 }
  );
});
