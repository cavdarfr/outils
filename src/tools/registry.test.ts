import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ToolMeta } from './types';

const dirs = readdirSync('src/tools').filter((d) => statSync(`src/tools/${d}`).isDirectory());

describe('structure des outils', () => {
  it.each(dirs)('%s : meta, page et test e2e cohérents', async (dir) => {
    const { meta } = (await import(`./${dir}/meta.ts`)) as { meta: ToolMeta };
    expect(meta.slug).toBe(dir);
    expect(existsSync(`src/pages/${dir}.astro`)).toBe(true);
    expect(existsSync(`e2e/${dir}.spec.ts`)).toBe(true);
    expect(existsSync(`src/tools/${dir}/logic.test.ts`)).toBe(true);
    expect(meta.description.length).toBeLessThanOrEqual(200);
  });
});
