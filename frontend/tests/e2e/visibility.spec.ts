import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + 'v';
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

async function log(page: Page, filmID: number, date: string, visibility: string) {
  await page.goto(`/#film/${filmID}`);
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill(date);
  await page.getByLabel('Who can see this').selectOption(visibility);
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('GAP 11: a diary entry is Private, Followers-only, or Public, and the viewer sees only what they are owed', async ({
  browser,
}) => {
  const author = await (await browser.newContext()).newPage();
  const stranger = await (await browser.newContext()).newPage();
  const follower = await (await browser.newContext()).newPage();
  await signup(author, 'visauthor');
  await signup(stranger, 'visstranger');
  await signup(follower, 'visfollower');

  await log(author, 550, '2024-10-10', 'private'); // Fight Club
  await log(author, 603, '2024-10-11', 'followers'); // The Matrix
  await log(author, 680, '2024-10-12', 'public'); // Pulp Fiction

  async function openAuthorProfile(page: Page) {
    await page.goto('/#people');
    await page.getByLabel('Search people').fill(`visauthor_${suffix}`);
    const card = page.locator('.person').filter({ hasText: `@visauthor_${suffix}` });
    await card.getByRole('link').click();
    return card;
  }

  // A stranger sees only the public entry — never the private or followers one.
  await openAuthorProfile(stranger);
  await expect(stranger.getByLabel('Open Pulp Fiction')).toBeVisible();
  await expect(stranger.getByLabel('Open The Matrix')).toHaveCount(0);
  await expect(stranger.getByLabel('Open Fight Club')).toHaveCount(0);

  // A follower gains the followers-only entry too, but never the private one.
  await follower.goto('/#people');
  await follower.getByLabel('Search people').fill(`visauthor_${suffix}`);
  const followerCard = follower
    .locator('.person')
    .filter({ hasText: `@visauthor_${suffix}` });
  await followerCard.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(
    followerCard.getByRole('button', { name: 'Unfollow', exact: true })
  ).toBeVisible();
  await followerCard.getByRole('link').click();
  await expect(follower.getByLabel('Open Pulp Fiction')).toBeVisible();
  await expect(follower.getByLabel('Open The Matrix')).toBeVisible();
  await expect(follower.getByLabel('Open Fight Club')).toHaveCount(0);

  // The owner always sees all three in their own diary.
  await author.goto('/#diary');
  await expect(author.locator('.diary article')).toHaveCount(3);

  await author.close();
  await stranger.close();
  await follower.close();
});
