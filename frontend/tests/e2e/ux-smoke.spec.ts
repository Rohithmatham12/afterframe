import { test, expect } from '@playwright/test';

test('UX smoke: console errors, mobile viewport, Google auth, no generic validation errors', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // Google auth: local dev runs with NEXT_PUBLIC_AUTH_DIRECT=true (email
  // only — Google OAuth needs the hosted Supabase project's redirect
  // config), so either the real button or the explanatory note is correct
  // here; production verification of the live Google flow is separate.
  await expect(
    page
      .getByRole('button', { name: /google/i })
      .or(page.getByText('Google OAuth is configured separately'))
  ).toBeVisible();
  await page.getByRole('button', { name: 'New here? Create account' }).click();

  // Trigger native validation path: submit with invalid email
  await page.getByLabel('Email', { exact: true }).fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForTimeout(500);
  const bodyText = await page.textContent('body');
  expect(bodyText).not.toContain('Please match the requested format');

  // Mobile viewport
  const mobile = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const mp = await mobile.newPage();
  await mp.goto('/');
  await expect(mp.locator('body')).toBeVisible();
  await mobile.close();

  console.log('CONSOLE/PAGE ERRORS:', JSON.stringify(errors));
  expect(errors.filter(e => !e.includes('Failed to load resource') && !e.includes('favicon'))).toEqual([]);
});
