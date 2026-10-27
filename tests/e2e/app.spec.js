import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { blankSetup } from '../../src/lib/model.js';

async function generate(page) {
  await page.getByRole('button', { name: 'Generate matches', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your match schedule' })).toBeVisible();
}
async function axe(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-heading')).toBeVisible();
});

test('roster, dialog and both schedule views pass axe checks', async ({ page }) => {
  await axe(page);
  await page.getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await axe(page);
  await page.keyboard.press('Escape');
  await generate(page);
  await axe(page);
  await page.getByRole('button', { name: 'All rounds', exact: true }).click();
  await expect(page.locator('.round-table-panel table')).toHaveCount(6);
  await axe(page);
});

test('skip link and dialog return keyboard focus', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const opener = page.getByRole('button', { name: 'Add player', exact: true });
  await opener.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('add, edit and delete a player with full constraint settings', async ({ page }) => {
  await page.getByRole('button', { name: 'Add player', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Player name', { exact: false }).fill('Test Player');
  await dialog.getByLabel('Mixed', { exact: true }).check();
  await expect(dialog.getByText(/Preferences are strict/)).toHaveCount(0);
  await dialog.getByLabel('Mixed pairing group').selectOption('woman');
  await dialog.getByLabel('Leaving at', { exact: true }).fill('19:00');
  await dialog.locator('summary').click();
  await dialog.getByLabel('Round 2', { exact: false }).check();
  await dialog.getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test Player', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aura-match:v1')));
  const player = saved.setup.players.find(p => p.name === 'Test Player');
  expect(player.departure).toBe('19:00');
  expect(player.skipRounds).toEqual([1]);
  await page.getByRole('button', { name: 'Edit Test Player' }).click();
  await dialog.getByLabel('Player name', { exact: false }).fill('Updated Player');
  await dialog.getByRole('button', { name: 'Save player', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Updated Player' }).click();
  await page.getByRole('button', { name: 'Remove player', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updated Player', exact: true })).toHaveCount(0);
});

test('mobile layouts have no document overflow', async ({ page }) => {
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await generate(page);
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole('button', { name: 'All rounds', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('snapshot is read-only and does not overwrite the local workspace', async ({ page, context }) => {
  await generate(page);
  await page.getByRole('button', { name: 'Share session', exact: true }).click();
  const input = page.getByLabel('Session link');
  await expect(input).toHaveValue(/#session=/);
  const link = await input.inputValue();
  const before = await page.evaluate(() => localStorage.getItem('aura-match:v1'));
  const friend = await context.newPage();
  await friend.goto(link);
  await expect(friend.getByText("You're viewing a shared snapshot.", { exact: true })).toBeVisible();
  await expect(friend.getByRole('button', { name: 'Add player', exact: true })).toHaveCount(0);
  expect(await friend.evaluate(() => localStorage.getItem('aura-match:v1'))).toBe(before);
  await friend.keyboard.press('Tab');
  await friend.keyboard.press('Enter');
  expect(friend.url()).toContain('#session=');
});

test('JPEG and full ZIP downloads are nonempty', async ({ page }) => {
  await generate(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const jpgEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Round 1 as JPEG', exact: false }).click();
  const jpg = await jpgEvent;
  expect(jpg.suggestedFilename()).toMatch(/\.jpg$/);
  expect(await jpg.failure()).toBeNull();
  const jpgStream = await jpg.createReadStream();
  const chunks = [];
  for await (const chunk of jpgStream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(10000);
  expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
  const zipEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Complete session pack', exact: false }).click();
  const zip = await zipEvent;
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);
  expect(await zip.failure()).toBeNull();
});

test('invalid import does not replace existing players', async ({ page }) => {
  const before = await page.evaluate(() => localStorage.getItem('aura-match:v1'));
  await page.getByLabel('Import a setup file').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"bad":"data"}'),
  });
  await expect(page.getByRole('alert')).toContainText('Could not import');
  expect(await page.evaluate(() => localStorage.getItem('aura-match:v1'))).toBe(before);
});

test('generated session survives a real browser reload', async ({ page }) => {
  await generate(page);
  await page.reload();
  await expect(page.locator('#page-heading')).toBeVisible();
  await page.locator('.workspace-tabs button').last().click();
  await expect(page.getByRole('heading', { name: 'Your match schedule' })).toBeVisible();
  await expect(page.locator('.match-card')).toHaveCount(3);
});


async function useFixture(page, n, courts, preference = 'doubles') {
  const setup = blankSetup();
  setup.settings.courts = Array.from({ length: courts }, (_, i) => ({ id: `court-${i+1}`, name: `Court ${i+1}`, from: '18:00', until: '20:00' }));
  setup.players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, gender: 'undisclosed', mixedGroup: 'none', preference, level: 3, arrival: '18:00', departure: '20:00', skipRounds: [] }));
  await page.evaluate(setup => localStorage.setItem('aura-match:v1', JSON.stringify({ setup, demo: false, generated: false })), setup);
  await page.reload();
  await expect(page.locator('.player-row')).toHaveCount(n);
}

test('preference selector has singles, doubles and mixed; mixed without a group saves', async ({ page }) => {
  await page.getByRole('button', { name: 'Add player', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio')).toHaveCount(3);
  await expect(dialog.getByRole('radio', { name: 'Singles', exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Doubles', exact: true })).toBeVisible();
  await dialog.getByRole('radio', { name: 'Mixed', exact: true }).check();
  await dialog.getByLabel('Player name', { exact: false }).fill('Flexible mixed player');
  await dialog.getByRole('button', { name: 'Add player', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Flexible mixed player', exact: true })).toBeVisible();
});

test('capacity warning updates immediately for 22 players on five versus six courts', async ({ page }) => {
  await useFixture(page, 22, 5);
  const warning = page.locator('.workspace').getByRole('region', { name: 'Court capacity warning' });
  await expect(warning).toContainText('22 available players, 5 courts: room for 20.');
  await expect(warning).toContainText('2 players must sit out each round');
  await page.getByLabel('Courts booked', { exact: true }).fill('6');
  await page.getByLabel('Courts booked', { exact: true }).blur();
  await expect(warning).toHaveCount(0);
  await page.getByLabel('Courts booked', { exact: true }).fill('5');
  await page.getByLabel('Courts booked', { exact: true }).blur();
  await expect(warning).toBeVisible();
  await generate(page);
  await expect(page.locator('.resting-players li')).toHaveCount(2);
  await axe(page);
});

test('20 players on five courts all play with no warning', async ({ page }) => {
  await useFixture(page, 20, 5);
  await expect(page.getByRole('region', { name: 'Court capacity warning' })).toHaveCount(0);
  await generate(page);
  await expect(page.locator('.match-card')).toHaveCount(5);
  await expect(page.locator('.match-player')).toHaveCount(20);
  await expect(page.locator('.resting-players li')).toHaveCount(0);
});

test('two players can generate singles; odd groups become Kungen', async ({ page }) => {
  await useFixture(page, 2, 1, 'singles');
  await generate(page);
  await expect(page.locator('.match-card .pill')).toHaveText('Singles');
  await useFixture(page, 5, 2, 'singles');
  await generate(page);
  await expect(page.locator('.kungen-players li')).toHaveCount(3);
  await expect(page.locator('.match-player')).toHaveCount(5);
  await expect(page.locator('.round-summary')).toContainText('5 in court groups');
  await expect(page.locator('.resting-players li')).toHaveCount(0);
  await axe(page);
  await page.getByRole('button', { name: 'All rounds', exact: true }).click();
  await expect(page.locator('.rotation-cell')).toHaveCount(6);
  await expect(page.locator('.rotation-cell').first()).toContainText('1 vs 2, then 2 vs 3, then 3 vs 1');
  await axe(page);
});

test('Kungen is preserved in shared snapshots and all exported formats', async ({ page, context }) => {
  await useFixture(page, 5, 2, 'singles');
  await generate(page);
  await page.getByRole('button', { name: 'Share session', exact: true }).click();
  await expect(page.getByLabel('Session link')).toHaveValue(/#session=/);
  const link = await page.getByLabel('Session link').inputValue();
  const friend = await context.newPage();
  await friend.goto(link);
  await expect(friend.locator('.kungen-players li')).toHaveCount(3);
  await expect(friend.locator('.match-player')).toHaveCount(5);
  await friend.setViewportSize({ width: 320, height: 900 });
  expect(await friend.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  for (const [label, extension] of [['Round 1 as JPEG', '.jpg'], ['Full schedule as plain text', '.txt'], ['Full schedule as accessible HTML', '.html'], ['Complete session pack', '.zip']]) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: false }).click();
    const file = await download;
    expect(file.suggestedFilename()).toContain(extension);
    expect(await file.failure()).toBeNull();
  }
});

