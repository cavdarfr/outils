import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Toutes les pages publiées, d'après le sitemap : un nouvel outil est contrôlé sans modifier ce fichier.
test('accessibilité de toutes les pages du sitemap', async ({ page, request, baseURL }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  expect(paths.length).toBeGreaterThan(4);
  for (const path of paths) {
    await page.goto(new URL(path, baseURL).href);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
  }
});

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

// Témoins : la CSP doit bloquer une tentative de sortie. Toute requête vers example.com qui atteindrait
// le réseau passerait par la route ci-dessous ; le compteur prouve qu'aucune n'est partie.
test('la CSP bloque les requêtes vers un autre domaine', async ({ page }) => {
  let reached = 0;
  await page.route('https://example.com/**', (route) => {
    reached++;
    return route.fulfill({ status: 204 });
  });
  await page.goto('/heic-en-jpg');
  await page.evaluate(async () => {
    await fetch('https://example.com/fetch', { method: 'POST', body: 'x', mode: 'no-cors' }).catch(() => {});
    navigator.sendBeacon('https://example.com/beacon', 'x');
    const img = new Image();
    img.src = 'https://example.com/pixel.gif';
    await new Promise((r) => setTimeout(r, 500));
  });
  expect(reached).toBe(0);
});

test('la CSP des workers bloque les requêtes vers un autre domaine', async ({ page, request }) => {
  await page.goto('/heic-en-jpg');
  // Le worker réel est servi depuis /_astro/ avec l'en-tête CSP de public/_headers.
  const html = await (await request.get('/heic-en-jpg')).text();
  const toolChunk = html.match(/\/_astro\/Tool\.[^"']+\.js/)?.[0];
  expect(toolChunk).toBeTruthy();
  const toolSource = await (await request.get(toolChunk!)).text();
  const workerPath = toolSource.match(/\/?_astro\/worker-[^"'`]+\.js|worker-[^"'`]+\.js/)?.[0];
  expect(workerPath).toBeTruthy();
  const workerHeaders = (await request.get(`/_astro/${workerPath!.split('/').pop()}`)).headers();
  expect(workerHeaders['content-security-policy']).toContain("connect-src 'self'");
  expect(workerHeaders['content-security-policy']).toContain("default-src 'none'");
});
