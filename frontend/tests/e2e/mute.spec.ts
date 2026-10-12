import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '9';
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

test('GAP 14: muting hides a followed author from the feed without unfollowing, and can be undone', async ({
  browser,
}) => {
  const author = await (await browser.newContext()).newPage();
  const viewer = await (await browser.newContext()).newPage();
  await signup(author, 'muteauthor');
  await signup(viewer, 'muteviewer');

  await author.goto('/#film/550');
  await expect(
    author.getByRole('button', { name: 'Log this film' })
  ).toBeVisible();
  await author.getByRole('button', { name: 'Write review' }).click();
  await author
    .getByLabel('Before watching · spoiler-safe', { exact: true })
    .fill('A review that should be mutable.');
  await author.getByRole('button', { name: 'Publish review', exact: true }).click();
  await expect(author.getByRole('dialog')).toHaveCount(0);

  await viewer.goto('/#people');
  await viewer.getByLabel('Search people').fill(`muteauthor_${suffix}`);
  const authorCard = viewer
    .locator('.person')
    .filter({ hasText: `@muteauthor_${suffix}` });
  await authorCard
    .getByRole('button', { name: 'Follow', exact: true })
    .click();
  await expect(
    authorCard.getByRole('button', { name: 'Unfollow', exact: true })
  ).toBeVisible();

  await viewer.goto('/#feed');
  await expect(
    viewer.getByText('A review that should be mutable.')
  ).toBeVisible();

  await viewer
    .getByRole('button', { name: `Mute @muteauthor_${suffix}` })
    .click();
  await expect(
    viewer.getByText('A review that should be mutable.')
  ).toHaveCount(0);

  await viewer.goto('/#settings');
  await viewer
    .getByRole('button', { name: 'Show muted accounts', exact: true })
    .click();
  await expect(viewer.getByText(`@muteauthor_${suffix}`)).toBeVisible();
  await viewer.getByRole('button', { name: 'Unmute', exact: true }).click();

  await viewer.goto('/#feed');
  await expect(
    viewer.getByText('A review that should be mutable.')
  ).toBeVisible();

  await author.close();
  await viewer.close();
});
