import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LIBHEIF_VERSION } from './vendor';

it('LIBHEIF_VERSION correspond au paquet libheif-js installé', () => {
  const pkg = JSON.parse(readFileSync('node_modules/libheif-js/package.json', 'utf8')) as { version: string };
  expect(LIBHEIF_VERSION).toBe(pkg.version);
});
