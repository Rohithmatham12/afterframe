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

test('GAP 19: viewing context is optional and shown in the diary', async ({
  page,
}) => {
  await signup(page, 'ctx');
  await page.goto('/#film/550');
  await page.getByRole('button', { name: 'Log this film' }).click();
  await page.getByLabel('Watched on', { exact: true }).fill('2024-10-10');
  await page.getByLabel('Who was this for?').selectOption('date_night');
  await page.getByRole('button', { name: 'Save viewing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#diary');
  await expect(page.locator('.diary article').first()).toContainText(
    'Date night'
  );
});

test('GAP 09: review tone is author-selected and filterable in the feed', async ({
  page,
}) => {
  await signup(page, 'tone');
  await page.goto('/#film/603');
  await page.getByRole('button', { name: 'Write review' }).click();
  await page
    .getByLabel('Before watching · spoiler-safe', { exact: true })
    .fill('A quiet character study worth your evening.');
  await page
    .getByLabel('How would you describe this review?')
    .selectOption('insightful');
  await page.getByRole('button', { name: 'Publish review', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/#feed');
  await expect(page.getByText('Insightful')).toBeVisible();
  await page.getByRole('button', { name: 'Funny', exact: true }).click();
  await expect(
    page.getByText('A quiet character study worth your evening.')
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(
    page.getByText('A quiet character study worth your evening.')
  ).toBeVisible();
});
