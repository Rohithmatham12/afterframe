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
  await page.getByLabel('List title').fill('Weekend discoveries');
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(
    page.getByRole('heading', { name: 'Weekend discoveries' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
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
});
test('E multi-user spoiler-safe discovery: follow, payload non-disclosure and explicit reveal', async ({page,browser}) => {
 const authorContext=await browser.newContext();const author=await authorContext.newPage();await signup(author,'author');await film(author);await author.getByRole('button',{name:'Write review'}).click();await author.getByLabel('Before watching · spoiler-safe').fill('A rich and unsettling atmosphere');await author.getByLabel('After watching · plot discussion').fill('PRIVATE_PLOT_'+suffix);await author.getByLabel('After reflection · deeper interpretation').fill('PRIVATE_REFLECTION_'+suffix);await author.getByRole('button',{name:'Publish review'}).click();await expect(author.getByRole('dialog')).toHaveCount(0);
 await signup(page,'spoilers');await page.goto('/#people');await page.getByLabel('Search people').fill('author_'+suffix);await page.getByRole('button',{name:'Follow',exact:true}).click();await expect(page.getByRole('button',{name:'Unfollow',exact:true})).toBeVisible();await page.goto('/#feed');await expect(page.getByText('A rich and unsettling atmosphere')).toBeVisible();expect(await page.content()).not.toContain('PRIVATE_PLOT_'+suffix);let payload=await responseJSON(page,'feed');expect(JSON.stringify(payload.body)).not.toContain('PRIVATE_PLOT_'+suffix);expect(JSON.stringify(payload.body)).not.toContain('PRIVATE_REFLECTION_'+suffix);
 await film(page);await log(page);await page.goto('/#feed');await expect(page.getByText('PRIVATE_PLOT_'+suffix)).toBeVisible();expect(await page.content()).not.toContain('PRIVATE_REFLECTION_'+suffix);await page.getByRole('button',{name:'Open deeper reflection'}).click();await expect(page.getByText('PRIVATE_REFLECTION_'+suffix)).toBeVisible();await page.reload();await expect(page.getByText('PRIVATE_REFLECTION_'+suffix)).toBeVisible();payload=await responseJSON(page,'feed');expect(JSON.stringify(payload.body)).toContain('PRIVATE_REFLECTION_'+suffix);await authorContext.close();
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
