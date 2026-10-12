import { test, expect, type Page, type Browser } from '@playwright/test';
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

async function rate(page: Page, filmPath: string, stars: string) {
  await page.goto(filmPath);
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-01-01');
  await page.getByLabel('Rating', { exact: true }).selectOption(stars);
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function joinFrenchCinema(page: Page) {
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Show tribes' }).click();
  await page.getByRole('button', { name: 'French cinema' }).click();
}

test('GAP 10: global vs tribe taste are shown side by side, suppressed below the minimum sample, and never fabricated', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(180000);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [p1, p2, p3, p4] = pages;
  try {
    await signup(p1, 'tribe1');
    await signup(p2, 'tribe2');
    await signup(p3, 'tribe3');
    await signup(p4, 'tribe4');

    // Amelie, TMDB 194 — a real French film, unused elsewhere in this suite.
    const film = '/#film/194';

    // p1 joins "French cinema" in Settings; it's off by default.
    await p1.goto('/#settings');
    await p1.getByRole('button', { name: 'Show tribes' }).click();
    const frenchChip = p1.getByRole('button', { name: 'French cinema' });
    await expect(frenchChip).toHaveAttribute('aria-pressed', 'false');
    await frenchChip.click();
    await expect(frenchChip).toHaveAttribute('aria-pressed', 'true');

    // Only p1 and p2 rate it at first — sample size 2, below the minimum —
    // the film page must show "not enough ratings," never a fabricated number.
    // Each later recheck uses reload(), not goto(film): the SPA router only
    // refetches on an actual hashchange, and the hash never changes here
    // (p1 stays on the same film page throughout) — a plain goto(same-url)
    // is a browser no-op, matching ordinary "someone else changed
    // something, I refresh to see it" behavior rather than real-time push.
    await rate(p1, film, '5');
    await rate(p2, film, '5');
    await p1.goto(film);
    await p1.reload();
    await expect(
      p1.getByText('Afterframe community: not enough ratings yet (2)')
    ).toBeVisible();

    // A third rating crosses the minimum sample: a real global average appears.
    await rate(p3, film, '1');
    await p1.reload();
    await expect(
      p1.getByText('Afterframe community: 3.7 (3 ratings)')
    ).toBeVisible();

    // p2 and p4 also join French cinema (p3 does not), and p4 rates it —
    // three tribe members now, crossing the minimum sample for the tribe
    // score too. The tribe average (5.0) is a real, *different* number
    // from the global one (3.7), since p3's low rating is correctly
    // excluded — it never joined the tribe.
    await joinFrenchCinema(p2);
    await joinFrenchCinema(p4);
    await rate(p4, film, '5');

    await p1.reload();
    await p1.getByLabel('Compare against a tribe').selectOption('french_cinema');
    await expect(
      p1.getByText('French cinema: 5.0 (3 ratings)')
    ).toBeVisible();
    await expect(
      p1.getByText('Afterframe community: 4.0 (4 ratings)')
    ).toBeVisible();

    // Deselecting the tribe drops back to just the global score.
    await p1.getByLabel('Compare against a tribe').selectOption('');
    await expect(
      p1.getByText('French cinema: 5.0 (3 ratings)')
    ).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
