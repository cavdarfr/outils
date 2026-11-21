import { expect, type Page } from '@playwright/test';

/**
 * Enregistre toute requête vers une autre origine et toute violation de CSP.
 * À appeler avant `page.goto`. Garantit la promesse « aucun fichier n'est envoyé ».
 */
export function guardNetwork(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const outbound: string[] = [];
  const uploads: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (new URL(url).origin !== origin) outbound.push(url);
    if (req.method() !== 'GET' && req.method() !== 'HEAD') uploads.push(`${req.method()} ${url}`);
  });
  page.on('worker', (worker) => worker.url()); // les requêtes des workers passent aussi par page.on('request')
  return {
    async assertClean() {
      const violations = await page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []);
      expect(outbound, 'requêtes vers une autre origine').toEqual([]);
      expect(uploads, 'requêtes avec corps').toEqual([]);
      expect(violations, 'violations de CSP').toEqual([]);
    },
  };
}

export async function recordCspViolations(page: Page) {
  await page.addInitScript(() => {
    const list: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = list;
    document.addEventListener('securitypolicyviolation', (e) => list.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
}

/** Étiquettes EXIF de l'IFD0 d'un JPEG (vide s'il n'y a pas de segment EXIF). */
export function exifTags(jpeg: Buffer): number[] {
  const start = jpeg.indexOf(Buffer.from('Exif\0\0'));
  if (start < 0) return [];
  const tiff = start + 6;
  const little = jpeg.toString('ascii', tiff, tiff + 2) === 'II';
  const u16 = (o: number) => (little ? jpeg.readUInt16LE(o) : jpeg.readUInt16BE(o));
  const u32 = (o: number) => (little ? jpeg.readUInt32LE(o) : jpeg.readUInt32BE(o));
  const ifd = tiff + u32(tiff + 4);
  const count = u16(ifd);
  return Array.from({ length: count }, (_, i) => u16(ifd + 2 + i * 12));
}

/** Ouvre une page d'outil et attend que l'îlot Preact soit hydraté (sinon un dépôt de fichier peut être ignoré). */
export async function gotoTool(page: Page, path: string) {
  await page.goto(path);
  await page.locator('astro-island:not([ssr])').first().waitFor({ state: 'attached' });
}
