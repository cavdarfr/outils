import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const script = resolve('scripts/new-tool.mjs');
const dir = mkdtempSync(join(tmpdir(), 'new-tool-'));
cpSync('scripts/templates', join(dir, 'scripts/templates'), { recursive: true });

function run(...args: string[]) {
  return execFileSync('node', [script, ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
}

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('new-tool', () => {
  it('échappe le titre comme un littéral JavaScript complet', async () => {
    const title = `L'outil \\' "test" \${x} </script>`;
    run('outil-test', title, 'pratique');
    const source = readFileSync(join(dir, 'src/tools/outil-test/meta.ts'), 'utf8');
    const { meta } = (await import(join(dir, 'src/tools/outil-test/meta.ts'))) as { meta: { title: string; status: string } };
    expect(meta.title).toBe(title);
    expect(meta.status).toBe('draft');
    expect(source).toContain(JSON.stringify(title));
  });

  it('insère tel quel un titre contenant des motifs de remplacement ou des marqueurs', async () => {
    const title = 'Prix $& $1 $$ et __CATEGORY__ __TITLE_JS__';
    run('outil-motifs', title, 'pratique');
    const { meta } = (await import(join(dir, 'src/tools/outil-motifs/meta.ts'))) as { meta: { title: string; seoTitle: string; category: string } };
    expect(meta.title).toBe(title);
    expect(meta.seoTitle).toBe(`${title} gratuitement, sans envoi de fichier`);
    expect(meta.category).toBe('pratique');
  });

  it('refuse un slug invalide, un titre avec saut de ligne et une catégorie inconnue', () => {
    expect(() => run('Mauvais Slug', 'Titre', 'pratique')).toThrow();
    expect(() => run('bon-slug', 'Ligne 1\nLigne 2', 'pratique')).toThrow();
    expect(() => run('bon-slug', 'Titre', 'inconnue')).toThrow();
  });

  it("refuse d'écraser un outil existant", () => {
    expect(() => run('outil-test', 'Autre', 'pratique')).toThrow();
  });
});
