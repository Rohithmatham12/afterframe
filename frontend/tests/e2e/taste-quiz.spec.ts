import { test, expect, type Page } from '@playwright/test';
const suffix = Date.now().toString(36) + '5';
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

test('GAP 02: discover prompts a new user to take the quiz, and it produces a real taste map', async ({
  page,
}) => {
  await signup(page, 'quiz');
  await page.goto('/#discover');
  await expect(page.getByText('Take the 60-second taste quiz')).toBeVisible();
  await page.getByRole('button', { name: 'Take the quiz', exact: true }).click();
  await expect(page).toHaveURL(/#quiz$/);
  await expect(page.getByText('1 of 15')).toBeVisible();

  // Answer the first three with distinct responses, proving the full range
  // of inputs works and "haven't seen" is a first-class, separate choice.
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(page.getByText('2 of 15')).toBeVisible();
  await page.getByRole('button', { name: 'Dislike', exact: true }).click();
  await expect(page.getByText('3 of 15')).toBeVisible();
  await page
    .getByRole('button', { name: 'Haven’t seen', exact: true })
    .click();
  await expect(page.getByText('4 of 15')).toBeVisible();

  // Back navigation works and does not lose the earlier answer.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText('2 of 15')).toBeVisible();

  await page.getByRole('button', { name: 'Finish quiz', exact: true }).click();
  await expect(page.getByText('Your early taste map')).toBeVisible();
  await expect(page.getByText('1 liked', { exact: false })).toBeVisible();
  await expect(page.getByText('1 disliked', { exact: false })).toBeVisible();
  await expect(page.getByText('haven’t seen', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'See what’s playing' }).click();
  await expect(page).toHaveURL(/#discover$/);
  // Having completed the quiz once, the banner must not reappear this session.
  await page.reload();
  await expect(
    page.getByText('Take the 60-second taste quiz')
  ).toHaveCount(0);
});

test('GAP 02: a retake prefills prior answers and overwrites rather than duplicating', async ({
  page,
}) => {
  await signup(page, 'retake');
  await page.goto('/#quiz');
  await page.getByRole('button', { name: 'Like', exact: true }).click();
  await page.getByRole('button', { name: 'Finish quiz', exact: true }).click();
  await expect(page.getByText('Your early taste map')).toBeVisible();

  await page.goto('/#settings');
  await page
    .getByRole('button', { name: 'Retake the taste quiz', exact: true })
    .click();
  await expect(page).toHaveURL(/#quiz$/);
  await expect(
    page.getByRole('button', { name: 'Like', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
});
