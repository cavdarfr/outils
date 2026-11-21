// Copie libheif-js tel que publié sur npm (sans passer par Vite) dans public/vendor/,
// pour servir la bibliothèque LGPL sans modification, dans un fichier séparé à adresse fixe.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('node_modules/libheif-js/package.json', 'utf8'));
const dir = `public/vendor/libheif-js/${pkg.version}`;
mkdirSync(dir, { recursive: true });
copyFileSync('node_modules/libheif-js/libheif-wasm/libheif-bundle.mjs', `${dir}/libheif-bundle.mjs`);
copyFileSync('node_modules/libheif-js/LICENSE', `${dir}/LICENSE.txt`);
