// Crée le squelette d'un nouvel outil (statut draft) : dossier src/tools/<slug>/, page, test e2e.
// Usage : node scripts/new-tool.mjs <slug> "<Titre court>" <categorie>
//   catégories : images | pdf | documents | social | pratique
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [slug, title, category] = process.argv.slice(2);
const categories = ['images', 'pdf', 'documents', 'social', 'pratique'];

if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !title || !categories.includes(category)) {
  console.error('Usage : node scripts/new-tool.mjs <slug-en-minuscules> "<Titre court>" <' + categories.join('|') + '>');
  process.exit(1);
}

const toolDir = `src/tools/${slug}`;
const files = {
  [`${toolDir}/meta.ts`]: 'meta.ts',
  [`${toolDir}/logic.ts`]: 'logic.ts',
  [`${toolDir}/logic.test.ts`]: 'logic.test.ts',
  [`${toolDir}/worker.ts`]: 'worker.ts',
  [`${toolDir}/Tool.tsx`]: 'Tool.tsx',
  [`src/pages/${slug}.astro`]: 'page.astro',
  [`e2e/${slug}.spec.ts`]: 'spec.ts',
};

for (const target of Object.keys(files)) {
  if (existsSync(target)) {
    console.error(`Existe déjà : ${target}`);
    process.exit(1);
  }
}

mkdirSync(toolDir, { recursive: true });
for (const [target, template] of Object.entries(files)) {
  const content = readFileSync(`scripts/templates/${template}.tmpl`, 'utf8')
    .replaceAll('__SLUG__', slug)
    .replaceAll('__TITLE__', title.replaceAll("'", "\\'"))
    .replaceAll('__CATEGORY__', category);
  writeFileSync(target, content);
  console.log(`créé  ${target}`);
}
console.log(`\nÉtapes suivantes : voir « Ajouter un outil » dans AGENTS.md. L'outil reste en draft jusqu'à ce qu'il soit fini.`);
