// Crée le squelette d'un nouvel outil (statut draft) : dossier src/tools/<slug>/, page, test e2e.
// Usage : node scripts/new-tool.mjs <slug> "<Titre court>" <categorie>
//   catégories : images | pdf | documents | social | pratique
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [slug, title, category] = process.argv.slice(2);
const categories = ['images', 'pdf', 'documents', 'social', 'pratique'];

// eslint-disable-next-line no-control-regex
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !title || /[\u0000-\u001f\u007f]/.test(title) || !categories.includes(category)) {
  console.error('Usage : node scripts/new-tool.mjs <slug-en-minuscules> "<Titre court>" <' + categories.join('|') + '>');
  process.exit(1);
}

const toolDir = `src/tools/${slug}`;
const vars = {
  SLUG: slug,
  // Littéraux JavaScript complets : aucun caractère du titre ne peut sortir de la chaîne.
  TITLE_JS: JSON.stringify(title),
  SEO_TITLE_JS: JSON.stringify(`${title} gratuitement, sans envoi de fichier`),
  CATEGORY: category,
};
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

for (const [target, template] of Object.entries(files)) {
  mkdirSync(dirname(target), { recursive: true });
  // Une seule passe, remplacement par fonction : le texte inséré n'est jamais réinterprété
  // (ni motifs `$&` de replace, ni marqueurs __…__ contenus dans le titre).
  const content = readFileSync(`scripts/templates/${template}.tmpl`, 'utf8').replace(
    /__(SLUG|TITLE_JS|SEO_TITLE_JS|CATEGORY)__/g,
    (_, key) => vars[key],
  );
  writeFileSync(target, content);
  console.log(`créé  ${target}`);
}
console.log(`\nÉtapes suivantes : voir « Ajouter un outil » dans AGENTS.md. L'outil reste en draft jusqu'à ce qu'il soit fini.`);
