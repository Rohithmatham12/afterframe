import { test, expect, type Page, type Browser } from '@playwright/test';
const suffix = Date.now().toString(36) + '5';
const password = 'Local-film-test-2026!';
// Embedded in every note's text so assertions never collide with public
// craft notes left behind by earlier runs against the same shared local
// dev database and the same real TMDB film id.
const privateObservation = `Wide lens exaggerates how small everyone looks (${suffix}).`;
const publicObservation = `Match cut hides the gap (${suffix}).`;

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

test('GAP 17: Craft Mode is optional, spoiler-gated, private-by-default, and searchable', async ({
  browser,
}: {
  browser: Browser;
}) => {
  test.setTimeout(180000);
  const ownerCtx = await browser.newContext();
  const viewerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  const viewer = await viewerCtx.newPage();
  try {
    await signup(owner, 'crafter');
    await signup(viewer, 'craftviewer');

    // The Shawshank Redemption, TMDB 278.
    await owner.goto('/#film/278');
    await expect(
      owner.getByRole('button', { name: 'Started watching' })
    ).toBeVisible();
    await owner.getByRole('button', { name: 'Add craft note' }).click();
    await owner.getByLabel('Category').selectOption('cinematography');
    await owner
      .getByLabel('Scene (optional)', { exact: true })
      .fill('The yard, overhead shot');
    await owner
      .getByLabel('Observation', { exact: true })
      .fill(privateObservation);
    // Private by default — leave it checked.
    await owner.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(owner.getByRole('dialog')).toHaveCount(0);
    const ownNote = owner.locator('.craft-note').filter({ hasText: suffix });
    await expect(ownNote.getByText(privateObservation)).toBeVisible();
    await expect(ownNote.getByText('Private', { exact: false })).toBeVisible();

    // A second, public, spoiler-marked note.
    await owner.getByRole('button', { name: 'Add craft note' }).click();
    const dialog = owner.getByRole('dialog');
    await dialog.getByLabel('Category').selectOption('editing');
    await dialog
      .getByLabel('Scene (optional)', { exact: true })
      .fill('The escape reveal');
    await dialog.getByLabel('Observation', { exact: true }).fill(publicObservation);
    await dialog.getByText('This note contains spoilers').click();
    await dialog.getByText('Private (only visible to you)').click(); // uncheck
    await dialog.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(owner.getByRole('dialog')).toHaveCount(0);

    // A stranger who hasn't watched or revealed sees the public note's
    // existence but not its spoiler content, and never sees the private one.
    await viewer.goto('/#film/278');
    await expect(viewer.getByText(privateObservation)).toHaveCount(0);
    await expect(viewer.getByText(publicObservation)).toHaveCount(0);
    // Scene/body text is deliberately hidden pre-reveal (that's the point of
    // the gate), so a specific gated note can't be targeted by its content —
    // scoping isn't needed anyway, since revealing is a per-film consent:
    // any gate's "Reveal spoilers" button unlocks every spoiler note for
    // this film for this viewer, including ones left by earlier test runs.
    await expect(
      viewer.getByText('This note contains spoilers for this film.').first()
    ).toBeVisible();
    await viewer.getByRole('button', { name: 'Reveal spoilers' }).first().click();
    await expect(viewer.getByText(publicObservation)).toBeVisible();

    // Craft Mode is optional: a plain diary log works with zero craft notes.
    await viewer.getByRole('button', { name: 'Log this film' }).click();
    await viewer.getByLabel('Watched on', { exact: true }).fill('2024-09-01');
    await viewer.getByRole('button', { name: 'Save viewing' }).click();
    await expect(viewer.getByRole('dialog')).toHaveCount(0);

    // The owner's personal library search finds their own private note by
    // its scene text, from anywhere, not just the film page — and only that
    // one, proving the search query actually filters server-side rather
    // than just listing everything.
    await owner.goto('/#craft');
    await owner
      .getByPlaceholder('A technique, a scene, a film title…')
      .fill('overhead');
    await owner.waitForTimeout(500); // let the 300ms search debounce settle
    await expect(owner.getByText(privateObservation)).toBeVisible();
    await expect(owner.getByText(publicObservation)).toHaveCount(0);
  } finally {
    await ownerCtx.close();
    await viewerCtx.close();
  }
});
