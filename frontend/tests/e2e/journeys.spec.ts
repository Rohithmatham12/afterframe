import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const round = process.env.SIMULATION_ROUND || '1';
const suffix = Date.now().toString(36);
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
  await page
    .getByLabel('Username', { exact: true })
    .fill(`${persona}_${suffix}`);
  await page.getByLabel('Display name', { exact: true }).fill(persona);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();
}
async function film(page: Page, id = 550) {
  await page.goto('/#film/' + id);
  await expect(
    page.getByRole('button', { name: 'Log this film' })
  ).toBeVisible();
}
async function log(page: Page, rating = '4', memory = false) {
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-10-10');
  await page.getByLabel('Rating', { exact: true }).selectOption(rating);
  await page
    .getByLabel('Diary notes', { exact: true })
    .fill('A beautiful first impression');
  if (memory) {
    await page.getByText('Add a private memory', { exact: false }).click();
    await page
      .getByLabel('A moment that stayed', { exact: true })
      .fill('Rain against the neon window');
    await page.getByLabel('A feeling', { exact: true }).fill('unsettled');
    await page
      .getByLabel('Where you were, who you were with', { exact: true })
      .fill('with college friends in winter');
  }
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function responseJSON(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const k = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'));
    const token = k ? JSON.parse(localStorage.getItem(k)!).access_token : '';
    const r = await fetch('http://127.0.0.1:8080/v1/' + path, {
      headers: { Authorization: 'Bearer ' + token },
    });
    return { status: r.status, body: await r.json() };
  }, path);
}
test('A casual viewer: signup, five logs, watchlist, list and returning session', async ({
  page,
}) => {
  await signup(page, 'casual');
  await page.goto('/#discover');
  await page.getByLabel('Search films', { exact: true }).fill('Fight Club');
  await expect(
    page.getByRole('button', { name: 'Open Fight Club', exact: true }).first()
  ).toBeVisible();
  for (const id of [550, 603, 680, 13, 27205]) {
    await film(page, id);
    await log(page);
  }
  for (const id of [157336, 807]) {
    await film(page, id);
    await page.getByRole('button', { name: 'Watchlist', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Added' })
    ).toBeVisible();
  }
  await page.goto('/#diary');
  await expect(page.locator('.diary article')).toHaveCount(5);
  await page.goto('/#lists');
  await page.getByRole('button', { name: 'Create list' }).click();
  await page.getByLabel('List title').fill('Weekend discoveries ' + suffix);
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(
    page.getByRole('heading', { name: 'Weekend discoveries ' + suffix })
  ).toBeVisible();
  if (process.env.MOBILE === '1')
    await page
      .locator('summary')
      .filter({ hasText: /^More$/ })
      .click();
  await page
    .getByRole('button', { name: 'Sign out', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByLabel('Email', { exact: true })
    .fill(`casual-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Sign in', exact: true })
    .last()
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#diary');
  await expect(page.locator('.diary article')).toHaveCount(5);
  await page.reload();
  await expect(page.locator('.diary article')).toHaveCount(5);
});
test('B cinephile: ranked list, reorder, layered review, rewatch and edit', async ({
  page,
}) => {
  await signup(page, 'cinephile');
  await page.goto('/#lists');
  await page.getByRole('button', { name: 'Create list' }).click();
  await page.getByLabel('List title').fill('Changing favorites ' + suffix);
  await page.getByLabel('Ranked', { exact: true }).check();
  for (const title of ['Fight Club', 'The Matrix']) {
    await page.getByLabel('Find a film for this list').fill(title);
    await page.getByRole('button', { name: 'Search films for list' }).click();
    await page
      .getByRole('button', { name: 'Add ' + title + ' (1999)', exact: true })
      .click();
  }
  await page.getByRole('button', { name: 'Move The Matrix up' }).click();
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await film(page);
  await log(page);
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('A rewatch', { exact: true }).check();
  await page.getByLabel('Rating', { exact: true }).selectOption('4.5');
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Write review' }).click();
  await page
    .getByLabel('Before watching · spoiler-safe')
    .fill('A rich and unsettling atmosphere');
  await page
    .getByLabel('After watching · plot discussion')
    .fill('PRIVATE_PLOT_' + suffix);
  await page
    .getByLabel('After reflection · deeper interpretation')
    .fill('PRIVATE_REFLECTION_' + suffix);
  await page.getByRole('button', { name: 'Publish review' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#diary');
  await expect(page.locator('.diary article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByLabel('Diary notes').fill('A corrected diary note');
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('A corrected diary note')).toBeVisible();
});
test('C Memory Vault: keyword, fuzzy recall, edit, ownership and deletion', async ({
  page,
  browser,
}) => {
  await signup(page, 'memory');
  await film(page);
  await log(page, '4', true);
  await page.goto('/#memories');
  await page.getByLabel('Search your memories').fill('neonn');
  await expect(page.locator('.memory-card')).toHaveCount(1);
  await expect(page.getByText('Rain against the neon window')).toBeVisible();
  const resurfaced = await responseJSON(page, 'resurface');
  expect(resurfaced.body.length).toBeGreaterThan(0);
  const own = await responseJSON(page, 'memories?q=neon');
  expect(own.body).toHaveLength(1);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signup(otherPage, 'outsider');
  const leak = await responseJSON(otherPage, 'memories?q=neon');
  expect(leak.body).toEqual([]);
  await other.close();
  await page.getByRole('button', { name: 'Edit memory' }).click();
  await page
    .getByLabel('Moment', { exact: true })
    .fill('A lighthouse in the fog');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Search your memories').fill('lighthouse');
  await expect(page.getByText('A lighthouse in the fog')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete memory' }).click();
  await expect(page.locator('.memory-card')).toHaveCount(0);
  const gone = await responseJSON(page, 'memories?q=lighthouse');
  expect(gone.body).toEqual([]);
});
test('D Taste Timeline: reflection without rewatch, comparison and persisted history', async ({
  page,
}) => {
  await signup(page, 'taste');
  await film(page);
  await log(page, '3');
  await page.getByRole('button', { name: 'Reflect', exact: true }).click();
  await page.getByLabel('Rating', { exact: true }).selectOption('5');
  await page.getByLabel('What changed?').fill('Its meaning stayed with me');
  await page.getByRole('button', { name: 'Save reflection' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#timeline');
  await expect(page.locator('.timeline article')).toHaveCount(2);
  await expect(page.getByText('Then me / Now me')).toBeVisible();
  await page.reload();
  await expect(page.locator('.timeline article')).toHaveCount(2);
  const diary = await responseJSON(page, 'diary');
  expect(diary.body).toHaveLength(1);
  const history = await responseJSON(page, 'timeline');
  expect(history.body.map((x: { rating: number }) => x.rating)).toEqual([5, 3]);
  await film(page);
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('A rewatch', { exact: true }).check();
  await page.getByLabel('Rating', { exact: true }).selectOption('4.5');
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await responseJSON(page, 'diary')).body).toHaveLength(2);
  expect((await responseJSON(page, 'film-state?film_id=550')).body.rating).toBe(
    4.5
  );
  await page.goto('/#timeline');
  await expect(page.locator('.timeline article')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.timeline article')).toHaveCount(3);
});
test('E multi-user spoiler-safe discovery: follow, payload non-disclosure and explicit reveal', async ({
  page,
  browser,
}) => {
  const authorContext = await browser.newContext();
  const author = await authorContext.newPage();
  await signup(author, 'author');
  await film(author);
  await author.getByRole('button', { name: 'Write review' }).click();
  await author
    .getByLabel('Before watching · spoiler-safe')
    .fill('A rich and unsettling atmosphere');
  await author
    .getByLabel('After watching · plot discussion')
    .fill('PRIVATE_PLOT_' + suffix);
  await author
    .getByLabel('After reflection · deeper interpretation')
    .fill('PRIVATE_REFLECTION_' + suffix);
  await author.getByRole('button', { name: 'Publish review' }).click();
  await expect(author.getByRole('dialog')).toHaveCount(0);
  await signup(page, 'spoilers');
  await page.goto('/#people');
  await page.getByLabel('Search people').fill('author_' + suffix);
  await page
    .locator('.person')
    .filter({ hasText: '@author_' + suffix })
    .getByRole('button', { name: 'Follow', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Unfollow', exact: true })
  ).toBeVisible();
  await page.goto('/#feed');
  await expect(
    page.getByText('A rich and unsettling atmosphere')
  ).toBeVisible();
  expect(await page.content()).not.toContain('PRIVATE_PLOT_' + suffix);
  let payload = await responseJSON(page, 'feed');
  expect(JSON.stringify(payload.body)).not.toContain('PRIVATE_PLOT_' + suffix);
  expect(JSON.stringify(payload.body)).not.toContain(
    'PRIVATE_REFLECTION_' + suffix
  );
  await film(page);
  await log(page);
  const watchedFeed = await responseJSON(page, 'feed');
  expect(watchedFeed.body[0].allowed_layer).toBe(2);
  await page.goto('/#feed');
  await expect(page.getByText('PRIVATE_PLOT_' + suffix)).toBeVisible();
  expect(await page.content()).not.toContain('PRIVATE_REFLECTION_' + suffix);
  await page
    .locator('.review')
    .filter({ hasText: '@author_' + suffix })
    .getByRole('button', { name: 'Open deeper reflection' })
    .click();
  await expect(page.getByText('PRIVATE_REFLECTION_' + suffix)).toBeVisible();
  await page.reload();
  await expect(page.getByText('PRIVATE_REFLECTION_' + suffix)).toBeVisible();
  payload = await responseJSON(page, 'feed');
  expect(JSON.stringify(payload.body)).toContain(
    'PRIVATE_REFLECTION_' + suffix
  );
  const review = page
    .locator('.review')
    .filter({ hasText: '@author_' + suffix });
  await review
    .getByRole('button', { name: 'Like review', exact: true })
    .click();
  await expect(
    review.getByRole('button', { name: 'Unlike review', exact: true })
  ).toBeVisible();
  await review.getByRole('button', { name: 'Discussion', exact: true }).click();
  await review
    .getByLabel('Comment', { exact: true })
    .fill('A thoughtful perspective ' + suffix);
  await review.getByRole('button', { name: 'Post comment' }).click();
  await expect(
    review.getByText('A thoughtful perspective ' + suffix)
  ).toBeVisible();
  const notifications = await responseJSON(author, 'notifications');
  expect(notifications.body.length).toBeGreaterThanOrEqual(3);
  expect(JSON.stringify(notifications.body)).not.toContain('PRIVATE_PLOT_');
  await page.goto('/#people');
  await page.getByLabel('Search people').fill('author_' + suffix);
  page.once('dialog', (d) => d.accept());
  await page
    .locator('.person')
    .filter({ hasText: '@author_' + suffix })
    .getByRole('button', { name: 'Block', exact: true })
    .click();
  await expect(
    page.locator('.person').filter({ hasText: '@author_' + suffix })
  ).toHaveCount(0);
  const blockedFeed = await responseJSON(page, 'feed');
  expect(blockedFeed.body).toEqual([]);
  await authorContext.close();
});
test('responsive and accessibility audit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.film-grid .poster').first()).toBeVisible();
  for (const width of [375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: `../docs/testing/round-${round}-${width}.png`,
      fullPage: false,
    });
  }
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});

test('account privacy, avatar validation and complete local erasure', async ({
  page,
  browser,
}) => {
  await signup(page, 'account');
  await film(page);
  await log(page, '4', true);
  await page.goto('/#settings');
  await page.getByLabel('Make my profile and social activity private').check();
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Profile saved' })
  ).toBeVisible();
  await page.getByLabel('Profile photo').setInputFiles({
    name: 'invalid.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<script>bad</script>'),
  });
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'use a PNG or JPEG no larger than 512 × 512 pixels' })
  ).toBeVisible();
  await page.getByLabel('Profile photo').setInputFiles('public/icon-192.png');
  await expect(
    page.getByRole('status').filter({ hasText: 'Photo saved' })
  ).toBeVisible();
  const me = await responseJSON(page, 'me');
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await signup(other, 'privacy');
  const hidden = await responseJSON(other, 'profile?user_id=' + me.body.id);
  expect(hidden.status).toBe(404);
  await stranger.close();
  await page.getByText('Delete my account', { exact: true }).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page
    .getByRole('button', { name: 'Permanently delete account' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByLabel('Email', { exact: true })
    .fill(`account-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Sign in', exact: true })
    .last()
    .click();
  await expect(page.getByText('Invalid login credentials')).toBeVisible();
});

test('authenticated accessibility, navigation and offline fallback', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await signup(page, 'accessibility');
  for (const area of [
    'diary',
    'watchlist',
    'lists',
    'memories',
    'timeline',
    'settings',
    'notifications',
  ]) {
    await page.goto('/#' + area);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Finding your next frame…')).toHaveCount(0);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations, area).toEqual([]);
  }
  await page.goto('/#diary');
  await page.goto('/#timeline');
  await page.goBack();
  await expect(page).toHaveURL(/#diary$/);
  await page.goForward();
  await expect(page).toHaveURL(/#timeline$/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('You’re offline')).toBeVisible();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

async function mutate(
  page: Page,
  area: string,
  body: unknown,
  method = 'POST'
) {
  return page.evaluate(
    async ({ area, body, method }) => {
      const key = Object.keys(localStorage).find((k) =>
        k.endsWith('-auth-token')
      );
      const token = key
        ? JSON.parse(localStorage.getItem(key)!).access_token
        : '';
      const response = await fetch('http://127.0.0.1:8080/v1/' + area, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: method === 'DELETE' ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { area, body, method }
  );
}

test('release edges: reviews, explicit unwatched reveal, ownership and deletion', async ({
  page,
  browser,
}) => {
  await signup(page, 'editor');
  await film(page);
  await page.getByRole('button', { name: 'Write review' }).click();
  await page
    .getByLabel('Before watching · spoiler-safe')
    .fill('静かな映画 — café <script>not code</script> ' + suffix);
  await page
    .getByLabel('After watching · plot discussion')
    .fill('Secret turn ' + suffix);
  await page
    .getByLabel('After reflection · deeper interpretation')
    .fill('Secret meaning ' + suffix);
  await page.getByRole('button', { name: 'Publish review' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const own = (await responseJSON(page, 'reviews?film_id=550')).body.find(
    (r: { username: string }) => r.username === 'editor_' + suffix
  );
  const second = await browser.newContext();
  const reader = await second.newPage();
  await signup(reader, 'edge_reader');
  await film(reader);
  const review = reader
    .locator('.review')
    .filter({ hasText: '@editor_' + suffix });
  await expect(review.getByText('Secret turn ' + suffix)).toHaveCount(0);
  expect(
    (
      await mutate(reader, 'reviews', {
        id: own.id,
        film_id: 550,
        safe: 'hijack',
      })
    ).status
  ).toBe(404);
  expect((await mutate(reader, 'reviews/' + own.id, {}, 'DELETE')).status).toBe(
    404
  );
  reader.once('dialog', (d) => d.accept());
  await review
    .getByRole('button', { name: 'Reveal spoilers', exact: true })
    .click();
  await expect(review.getByText('Secret turn ' + suffix)).toBeVisible();
  expect((await responseJSON(reader, 'diary')).body).toHaveLength(0);
  await reader.reload();
  await expect(
    reader
      .locator('.review')
      .filter({ hasText: '@editor_' + suffix })
      .getByText('Secret turn ' + suffix)
  ).toBeVisible();
  reader.once('dialog', (d) =>
    d.accept('Spoiler in safe text — automated local test')
  );
  await reader
    .locator('.review')
    .filter({ hasText: '@editor_' + suffix })
    .getByRole('button', { name: 'Report', exact: true })
    .click();
  await expect(
    reader.getByRole('status').filter({ hasText: 'Report submitted' })
  ).toBeVisible();
  const authored = page
    .locator('.review')
    .filter({ hasText: '@editor_' + suffix });
  await authored.getByRole('button', { name: 'Edit review' }).click();
  await page
    .getByLabel('Before watching · spoiler-safe')
    .fill('Updated introduction ' + suffix);
  await page.getByRole('button', { name: 'Publish review' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    authored.getByText('Updated introduction ' + suffix)
  ).toBeVisible();
  expect(
    (await mutate(page, 'reviews', { film_id: 550, safe: 'x'.repeat(10001) }))
      .status
  ).toBe(400);
  page.once('dialog', (d) => d.accept());
  await authored.getByRole('button', { name: 'Delete review' }).click();
  await expect(
    page.locator('.review').filter({ hasText: '@editor_' + suffix })
  ).toHaveCount(0);
  await reader.reload();
  await expect(
    reader.locator('.review').filter({ hasText: '@editor_' + suffix })
  ).toHaveCount(0);
  await second.close();
});

test('release edges: private lists, sharing, likes, unfollow and read notifications', async ({
  page,
  browser,
}) => {
  await signup(page, 'collector');
  const me = (await responseJSON(page, 'me')).body;
  const list = await mutate(page, 'lists', {
    title: 'Private collection ' + suffix,
    private: true,
    ranked: true,
    film_ids: [550, 603],
  });
  expect(list.status).toBe(200);
  const second = await browser.newContext();
  const reader = await second.newPage();
  await signup(reader, 'list_reader');
  await reader.goto('/#lists/' + list.body.id);
  await expect(
    reader.getByRole('heading', { name: 'Private collection ' + suffix })
  ).toHaveCount(0);
  expect(
    (
      await mutate(reader, 'lists', {
        id: list.body.id,
        title: 'hijack',
        film_ids: [550],
      })
    ).status
  ).toBe(404);
  expect(
    (await mutate(reader, 'list-like', { id: list.body.id, enabled: true }))
      .status
  ).not.toBe(200);
  expect(
    (
      await mutate(page, 'lists', {
        id: list.body.id,
        title: 'Shared collection ' + suffix,
        private: false,
        ranked: true,
        film_ids: [603, 550],
      })
    ).status
  ).toBe(200);
  await reader.reload();
  await expect(
    reader.getByRole('heading', { name: 'Shared collection ' + suffix })
  ).toBeVisible();
  await reader.getByRole('button', { name: 'Like · 0', exact: true }).click();
  await expect(
    reader.getByRole('button', { name: 'Unlike · 1', exact: true })
  ).toBeVisible();
  await reader.goto('/#people');
  await reader.getByLabel('Search people').fill('collector_' + suffix);
  const person = reader
    .locator('.person')
    .filter({ hasText: '@collector_' + suffix });
  await person.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(
    person.getByRole('button', { name: 'Unfollow', exact: true })
  ).toBeVisible();
  await person.getByRole('button', { name: 'Unfollow', exact: true }).click();
  await expect(
    person.getByRole('button', { name: 'Follow', exact: true })
  ).toBeVisible();
  expect(
    (
      await responseJSON(
        reader,
        'following?user_id=' + (await responseJSON(reader, 'me')).body.id
      )
    ).body
  ).toHaveLength(0);
  await page.goto('/#notifications');
  await expect(page.locator('.notification')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(
    page.locator('.notification').getByText(/· Read$/)
  ).toBeVisible();
  expect(
    (await responseJSON(page, 'notifications')).body.every(
      (n: { read: boolean }) => n.read
    )
  ).toBe(true);
  expect((await responseJSON(reader, 'profile?user_id=' + me.id)).status).toBe(
    200
  );
  await page.goto('/#lists/' + list.body.id);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Shared collection ' + suffix })
  ).toHaveCount(0);
  await second.close();
});

test('release edges: diary pagination, filters, network retry, double click and session tabs', async ({
  page,
  context,
}) => {
  await signup(page, 'history');
  await film(page);
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-11-02');
  await page
    .getByLabel('Diary notes', { exact: true })
    .fill('Retry remains one viewing');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Save viewing' })
  ).toBeEnabled();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Save viewing' }).dblclick();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await responseJSON(page, 'diary')).body).toHaveLength(1);
  for (let n = 0; n < 51; n++) {
    const saved = await mutate(page, 'diary', {
      film_id: 550,
      watched_on: '2024-10-10',
      rating: 4,
      notes: 'History ' + n,
      request_id: crypto.randomUUID(),
    });
    expect(saved.status).toBe(200);
  }
  await page.goto('/#diary');
  await expect(page.locator('.diary article')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.diary article')).toHaveCount(2);
  expect((await responseJSON(page, 'diary?month=2024-11')).body).toHaveLength(
    1
  );
  expect((await responseJSON(page, 'diary?month=2020-01')).body).toHaveLength(
    0
  );
  const entry = (await responseJSON(page, 'diary?month=2024-11')).body[0];
  expect((await mutate(page, 'diary/' + entry.id, {}, 'DELETE')).status).toBe(
    200
  );
  expect((await responseJSON(page, 'diary?month=2024-11')).body).toHaveLength(
    0
  );
  const tab = await context.newPage();
  await tab.goto('/#settings');
  await expect(tab.getByLabel('Username', { exact: true })).toHaveValue(
    'history_' + suffix
  );
  await page.goto('/#discover');
  if (process.env.MOBILE === '1')
    await page
      .locator('summary')
      .filter({ hasText: /^More$/ })
      .click();
  await page
    .getByRole('button', { name: 'Sign out', exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    tab.getByRole('button', { name: 'Sign in', exact: true })
  ).toBeVisible();
  await tab.close();
});

test('accessibility: keyboard dialog, reduced motion, text spacing and narrow reflow', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' })
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Sign in', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Close dialog' })
  ).toBeFocused();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => !!document.activeElement?.closest('dialog'))
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true })
  ).toBeFocused();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({
    content:
      '* {letter-spacing:.12em !important;word-spacing:.16em !important;line-height:1.5 !important} p {margin-bottom:2em !important}',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: '../docs/testing/accessibility-320-text-spacing.png',
  });
});

test('auth recovery and watchlist ownership edge cases', async ({
  page,
  browser,
  request,
}) => {
  await signup(page, 'recovery');
  const email = `recovery-${suffix}@example.test`;
  const me = (await responseJSON(page, 'me')).body;
  for (const id of [550, 603])
    expect(
      (
        await mutate(page, 'watchlist', {
          film_id: id,
          enabled: true,
          private: true,
        })
      ).status
    ).toBe(200);
  const second = await browser.newContext();
  const outsider = await second.newPage();
  await signup(outsider, 'watch_outsider');
  expect((await responseJSON(outsider, 'watchlist')).body).toHaveLength(0);
  expect(
    (await mutate(outsider, 'watchlist', { film_id: 550, enabled: false }))
      .status
  ).toBe(200);
  expect((await responseJSON(page, 'watchlist')).body).toHaveLength(2);
  expect(
    (
      await mutate(outsider, 'me', {
        username: me.username,
        name: 'duplicate',
        bio: '',
        private: false,
        resurface: true,
      })
    ).status
  ).toBe(409);
  await second.close();
  expect(
    (await mutate(page, 'watchlist', { film_id: 550, enabled: false })).status
  ).toBe(200);
  expect((await responseJSON(page, 'watchlist')).body).toHaveLength(1);
  const rejected = await request.get('http://127.0.0.1:8080/v1/memories', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  expect(rejected.status()).toBe(401);
  await page.goto('/#discover');
  if (process.env.MOBILE === '1')
    await page
      .locator('summary')
      .filter({ hasText: /^More$/ })
      .click();
  await page
    .getByRole('button', { name: 'Sign out', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send recovery email' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Check your email' })
  ).toBeVisible();
  let messages: { ID: string }[] = [];
  await expect
    .poll(async () => {
      const response = await request.get(
        'http://127.0.0.1:8025/api/v1/search',
        { params: { query: 'to:' + email } }
      );
      messages = (await response.json()).messages || [];
      return messages.length;
    })
    .toBeGreaterThan(0);
  const mail = await (
    await request.get('http://127.0.0.1:8025/api/v1/message/' + messages[0].ID)
  ).json();
  const match = String(mail.HTML).match(/href="([^"]+)"/);
  expect(!!match).toBe(true);
  const link = match![1].replaceAll('&amp;', '&');
  const target = new URL(link);
  expect(target.hostname).toBe('127.0.0.1');
  expect(target.port).toBe('54321');
  try {
    await page.goto(link);
  } catch {
    throw new Error('Recovery navigation failed; token omitted');
  }
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await page
    .getByLabel('New password', { exact: true })
    .fill(password + 'Changed');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  expect((await responseJSON(page, 'me')).status).toBe(200);
});
