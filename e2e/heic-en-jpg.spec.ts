import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { exifTags, gotoTool, guardNetwork, recordCspViolations } from './helpers';

const HEIC = 'fixtures/exemple.heic';
const PNG = 'fixtures/exemple.png';

test.beforeEach(async ({ page }) => {
  await recordCspViolations(page);
});

test('convertit un HEIC en JPG sans rien envoyer', async ({ page, baseURL }) => {
  const guard = guardNetwork(page, baseURL!);
  await gotoTool(page, '/heic-en-jpg');
  await page.getByTestId('file-input').setInputFiles(HEIC);

  const item = page.locator('.file').first();
  await expect(item).toHaveAttribute('data-status', 'ok', { timeout: 30_000 });
  await expect(item.locator('.file-detail')).toContainText('640 × 480 px');

  const [download] = await Promise.all([page.waitForEvent('download'), item.getByRole('link', { name: 'Télécharger' }).click()]);
  expect(download.suggestedFilename()).toBe('exemple.jpg');
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  // Safari ajoute un petit bloc EXIF technique ; aucune position GPS (0x8825), marque (0x010f) ni modèle (0x0110).
  const tags = exifTags(bytes);
  expect(tags).not.toContain(0x8825);
  expect(tags).not.toContain(0x010f);
  expect(tags).not.toContain(0x0110);

  await guard.assertClean();
});

test('convertit un PNG en PNG redimensionné', async ({ page, baseURL }) => {
  const guard = guardNetwork(page, baseURL!);
  await gotoTool(page, '/heic-en-jpg');
  await page.getByText('PNG', { exact: true }).click();
  await page.getByLabel('Taille').selectOption({ label: '1080 px max' });
  await page.getByTestId('file-input').setInputFiles(PNG);

  const item = page.locator('.file').first();
  await expect(item).toHaveAttribute('data-status', 'ok', { timeout: 30_000 });
  // 640 px est déjà sous la limite : taille inchangée.
  await expect(item.locator('.file-detail')).toContainText('640 × 480 px');
  await expect(item.locator('.file-name')).toHaveText('exemple.png');
  await guard.assertClean();
});

test('plusieurs fichiers : archive ZIP', async ({ page, baseURL }) => {
  const guard = guardNetwork(page, baseURL!);
  await gotoTool(page, '/heic-en-jpg');
  await page.getByTestId('file-input').setInputFiles([HEIC, PNG]);
  await expect(page.locator('.file[data-status="ok"]')).toHaveCount(2, { timeout: 30_000 });

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tout télécharger (ZIP)' }).click()]);
  expect(download.suggestedFilename()).toBe('images-converties.zip');
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 2)]).toEqual([0x50, 0x4b]);
  // Deux fichiers « exemple.jpg » : le second est renommé.
  expect(bytes.includes(Buffer.from('exemple (2).jpg'))).toBe(true);
  await guard.assertClean();
});

test("signale un fichier qui n'est pas une image", async ({ page }) => {
  await gotoTool(page, '/heic-en-jpg');
  await page.getByTestId('file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') });
  const item = page.locator('.file').first();
  await expect(item).toHaveAttribute('data-status', 'erreur', { timeout: 15_000 });
  await expect(item.locator('.file-detail')).toContainText('Format non reconnu');
});
