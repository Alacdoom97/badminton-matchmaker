import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { blankSetup, STORAGE_KEY } from '../../src/lib/model.js';

async function openExport(page) {
  await page.getByRole('button', { name: 'Generate matches', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your match schedule' })).toBeVisible();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  return page.getByRole('dialog');
}

test('session pack exports selected round images and keeps the full accessible schedule', async ({ page }) => {
  await page.goto('/');
  const dialog = await openExport(page);
  await dialog.locator('summary').click();
  await dialog.getByRole('button', { name: 'Current round only', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(1);
  const downloaded = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Complete session pack', exact: false }).click();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const zip = await JSZip.loadAsync(Buffer.concat(chunks));
  expect(Object.keys(zip.files).filter(name => name.endsWith('.jpg'))).toEqual(['round-01.jpg']);
  expect(await zip.file('schedule.txt').async('string')).toContain('ROUND 2');
});

test('organiser can cancel a large image pack and keep using export options', async ({ page }) => {
  await page.goto('/');
  const setup = blankSetup();
  setup.settings.start = '08:00'; setup.settings.duration = 480; setup.settings.roundMinutes = 10;
  setup.settings.courts = Array.from({ length: 12 }, (_, i) => ({ id: `court-${i}`, name: `Court ${i}`, from: '08:00', until: '16:00' }));
  setup.players = Array.from({ length: 64 }, (_, i) => ({ id: `p${i}`, name: `${i}`.padStart(2, '0') + '長'.repeat(38), gender: 'undisclosed', mixedGroup: 'none', preference: 'doubles', level: 3, arrival: '08:00', departure: '16:00', skipRounds: [] }));
  await page.evaluate(({ key, setup }) => localStorage.setItem(key, JSON.stringify({ setup, generated: false, demo: false })), { key: STORAGE_KEY, setup });
  await page.reload();
  const dialog = await openExport(page);
  let downloads = 0;
  page.on('download', () => downloads++);
  await dialog.getByRole('button', { name: 'Complete session pack', exact: false }).click();
  await dialog.getByRole('button', { name: 'Cancel export', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Export cancelled.');
  await expect(dialog.getByRole('button', { name: 'Full schedule as accessible HTML', exact: false })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeEnabled();
  expect(downloads).toBe(0);
});
