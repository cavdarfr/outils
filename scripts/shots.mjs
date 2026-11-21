// Captures d'écran de contrôle visuel et génération de public/og.png.
// Usage : node scripts/shots.mjs <baseURL> <dossier de sortie>
import { chromium } from '@playwright/test';

const [base = 'http://127.0.0.1:8788', out = 'test-results/shots'] = process.argv.slice(2);
const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, colorScheme: scheme });
    for (const path of ['/', '/heic-en-jpg']) {
      await page.goto(base + path);
      await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' }).catch(() => {});
      if (path === '/heic-en-jpg') {
        await page.getByTestId('file-input').setInputFiles(['fixtures/exemple.heic', 'fixtures/exemple.png']);
        await page.locator('.file[data-status="ok"]').nth(1).waitFor();
      }
      await page.screenshot({ path: `${out}/${scheme}-${name}${path === '/' ? '-accueil' : path.replace('/', '-')}.png`, fullPage: true });
    }
    await page.close();
  }
}

const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<!doctype html><html><body style="margin:0;width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;background:#f4efe6;color:#1c211e;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif">
  <div style="display:flex;align-items:center;gap:20px;font-size:40px;font-weight:700"><svg width="64" height="64" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1f3b2d"/><path d="M9 21.5 19.5 11a2.5 2.5 0 1 1 3.5 3.5L12.5 25H9z" fill="#f4efe6"/></svg>outils.cavdar.dev</div>
  <div style="font-size:64px;font-weight:800;line-height:1.1;letter-spacing:-0.02em;margin-top:40px;max-width:950px">Des petits outils qui gardent vos fichiers chez vous</div>
  <div style="font-size:30px;color:#5c645f;margin-top:28px">Gratuit · sans compte · sans publicité · rien n'est envoyé</div>
</body></html>`);
await og.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('ok');
