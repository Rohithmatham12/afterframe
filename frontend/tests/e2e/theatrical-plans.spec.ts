import { test, expect, type Page, type Browser } from '@playwright/test';
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

async function username(page: Page): Promise<string> {
  await page.goto('/#settings');
  const value = await page
    .getByLabel('Username', { exact: true })
    .inputValue();
  return value;
}

test('GAP 23: group theatrical planning — create, invite, vote, decide, and a stranger never sees it', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(180000);
  const creatorCtx = await browser.newContext();
  const inviteeCtx = await browser.newContext();
  const strangerCtx = await browser.newContext();
  const creator = await creatorCtx.newPage();
  const invitee = await inviteeCtx.newPage();
  const stranger = await strangerCtx.newPage();
  try {
    await signup(creator, 'planner');
    await signup(invitee, 'plannee');
    await signup(stranger, 'outsider');
    const inviteeUsername = await username(invitee);

    // The Matrix, TMDB 603 — unused by any other spec in this suite.
    await creator.goto('/#film/603');
    await expect(
      creator.getByText('Afterframe doesn')
    ).toHaveCount(0); // not yet on a plan page
    await creator.getByRole('button', { name: 'Plan a group outing' }).click();
    await creator
      .getByLabel('Note (optional)', { exact: true })
      .fill(`Group outing ${suffix}`);
    await creator.getByRole('button', { name: 'Create plan', exact: true }).click();
    await expect(creator).toHaveURL(/#plan\//);

    // The honest "no live showtimes" disclosure is always visible.
    await expect(
      creator.getByText('licensed showtime provider', { exact: false })
    ).toBeVisible();
    await expect(
      creator.getByRole('link', { name: 'Find showtimes' })
    ).toHaveAttribute('href', /google\.com\/search/);

    await creator.getByPlaceholder('e.g. Friday 7:30pm').fill('Friday 7:30pm');
    await creator.getByRole('button', { name: 'Add time', exact: true }).click();
    await expect(creator.getByText('Friday 7:30pm')).toBeVisible();

    await creator
      .getByPlaceholder('username to invite')
      .fill(inviteeUsername);
    await creator.getByRole('button', { name: 'Invite', exact: true }).click();
    await expect(creator.getByText('@' + inviteeUsername)).toBeVisible();

    const planURL = creator.url();

    // A stranger who was never invited can't reach the plan at all.
    await stranger.goto(planURL);
    await expect(
      stranger.getByText('Not found or not permitted', { exact: false })
    ).toBeVisible();

    // The invitee sees it, accepts, and votes.
    await invitee.goto(planURL);
    await expect(invitee.getByRole('button', { name: 'Accept' })).toBeVisible();
    await invitee.getByRole('button', { name: 'Accept' }).click();
    await expect(invitee.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    await invitee.getByRole('button', { name: 'Vote', exact: true }).click();
    await expect(invitee.getByRole('button', { name: 'Voted' })).toBeVisible();

    // The creator sees the vote land, then decides.
    await creator.reload();
    await expect(creator.getByText('1 vote')).toBeVisible();
    await creator
      .getByRole('button', { name: 'Decide this one', exact: true })
      .click();
    await expect(creator.getByText('Decided', { exact: true })).toBeVisible();
    await expect(creator.getByText('Friday 7:30pm — decided')).toBeVisible();

    // The decision is a real persisted group outcome, visible to everyone
    // in the group on reload — never a fabricated booking confirmation.
    await invitee.reload();
    await expect(invitee.getByText('Friday 7:30pm — decided')).toBeVisible();

    // Still invisible to the never-invited stranger, decided or not.
    await stranger.goto(planURL);
    await expect(
      stranger.getByText('Not found or not permitted', { exact: false })
    ).toBeVisible();
  } finally {
    await creatorCtx.close();
    await inviteeCtx.close();
    await strangerCtx.close();
  }
});
