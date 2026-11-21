import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = ['/', '/heic-en-jpg', '/mentions-legales', '/confidentialite', '/licences'];

for (const path of pages) {
  test(`accessibilité ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("l'accueil liste les outils", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Convertir HEIC/ }).click();
  await expect(page).toHaveURL(/\/heic-en-jpg$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('HEIC');
});

test('page 404', async ({ page }) => {
  const res = await page.goto('/nexiste-pas');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
});

test('en-têtes de sécurité', async ({ request }) => {
  const html = await request.get('/heic-en-jpg');
  expect(html.headers()['x-content-type-options']).toBe('nosniff');
  const body = await html.text();
  expect(body).toContain("connect-src 'self'");

  const worker = body.match(/\/_astro\/[^"']+\.js/g) ?? [];
  expect(worker.length).toBeGreaterThan(0);
  const asset = await request.get(worker[0]!);
  expect(asset.headers()['content-security-policy']).toContain("connect-src 'self'");
});

test('sitemap et robots', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('https://outils.cavdar.dev/heic-en-jpg');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://outils.cavdar.dev/sitemap.xml');
});
