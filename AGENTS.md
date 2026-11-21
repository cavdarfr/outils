# outils.cavdar.dev

Site statique de petits outils qui traitent les fichiers dans le navigateur. Rien n'est envoyé à un serveur.

## Commandes

- `pnpm dev` : serveur de développement (port `PORT`, 4321 par défaut).
- `pnpm check` : vérification des types, tests unitaires, build. Doit passer avant toute PR.
- `pnpm e2e` : tests Playwright sur le site construit, servi par `wrangler dev` comme en production (port `E2E_PORT`, 8788 par défaut). Lancer `pnpm build` avant.
- `pnpm e2e:prod` : mêmes tests sur https://outils.cavdar.dev (Chromium et iPhone émulé). `E2E_BASE_URL` permet de viser une autre adresse.
- `pnpm new-tool <slug> "<Titre>" <images|pdf|documents|social|pratique>` : crée le squelette complet d'un outil en brouillon.
- `node scripts/make-fixtures.mjs` : régénère les images d'exemple synthétiques (macOS, `sips`).
- `node scripts/shots.mjs <url> <dossier>` : captures de contrôle visuel et `public/og.png`.
- `scripts/trafic.sh [jours]` : pages vues par chemin et référents (jeton `CLOUDFLARE_ANALYTICS_TOKEN`).

## Règles non négociables

- Aucune requête vers un autre domaine. Pas de CDN, de police, de script ou de modèle tiers : tout est servi depuis `outils.cavdar.dev`. Les tests e2e échouent sinon (`guardNetwork`).
- La CSP du document est générée par Astro (`astro.config.mjs`), celle des Web Workers par `public/_headers` (`/_astro/*`). Ne pas les affaiblir sans le dire dans la PR.
- Fixtures synthétiques uniquement : jamais de vraie photo, de document réel, de visage ou de coordonnées GPS dans le dépôt (il est public).
- Aucun cookie, aucun stockage de suivi, aucun outil de mesure d'audience côté navigateur.
- Pas de dépendance AGPL. LGPL acceptable si servie sans modification dans un fichier séparé, et listée dans `src/pages/licences.astro`.
- Ne jamais présenter un résultat comme « accepté par l'administration » (ANTS, etc.). Aucun outil qui modifie les valeurs d'un document officiel.

## Ajouter un outil

1. `pnpm new-tool <slug> "<Titre>" <catégorie>` crée, en statut `draft` :
   - `src/tools/<slug>/` : `meta.ts`, `Tool.tsx` (îlot Preact), `logic.ts` + `logic.test.ts` (fonctions pures), `worker.ts` (traitement lourd) ;
   - `src/pages/<slug>.astro` (aide et FAQ dans le slot `help`) ;
   - `e2e/<slug>.spec.ts` (chargement, accessibilité, aucune requête externe, et un `test.fixme` à écrire).
2. Pour un outil « fichiers en entrée, fichiers en sortie », garder la structure du squelette : `Dropzone`, `ResultList`, `useFileJobs` et `serveJobs` gèrent la file un fichier à la fois, les plantages et délais du worker, les téléchargements et le ZIP. Le worker ne contient que le traitement ; les bibliothèques lourdes s'y chargent par `import()` dynamique.
3. Écrire la logique et ses tests, puis le test e2e nominal avec une fixture synthétique dans `fixtures/` (générée par script, comme `scripts/make-fixtures.mjs`), `guardNetwork(...).assertClean()` et un cas d'erreur. Retirer le `test.fixme`.
4. Lister les nouvelles bibliothèques dans `src/pages/licences.astro`. Une bibliothèque LGPL se sert sans passer par Vite, comme libheif (`scripts/copy-vendor.mjs`, `public/vendor/`).
5. Contrôler sur le simulateur iPhone (`xcrun simctl`) si l'outil traite des images ou des PDF.
6. Passer `status: 'live'` et mettre à jour `docs/backlog.md`. L'accueil, le sitemap et le contrôle d'accessibilité de toutes les pages suivent seuls.

Un brouillon n'apparaît ni sur l'accueil ni dans le sitemap en production ; sa page reste accessible par son adresse, en `noindex`, ce qui permet de la tester sur l'aperçu de PR. `src/tools/registry.test.ts` vérifie que chaque dossier d'outil a son slug, sa page, son test e2e et ses tests de logique.

## Code partagé et travail en parallèle

- Un outil ne dépend que de `src/lib/` et `src/components/`, jamais d'un autre outil.
- Déjà partagé : `src/lib/files.ts` (noms, extensions, ZIP, téléchargement, détection iPhone/iPad), `src/lib/jobs.ts` et `src/lib/job-host.ts` (traitements en worker), `src/lib/useFileJobs.ts`, `src/components/Dropzone.tsx`, `src/components/ResultList.tsx`.
- Pas d'abstraction anticipée : un code reste dans l'outil qui l'utilise et n'est extrait dans `src/lib/` qu'au deuxième usage.
- Une extraction vers `src/lib/` passe par une branche `lib/<sujet>` courte, fusionnée avant les branches d'outils, qui se rebasent ensuite. Jamais deux branches qui modifient `src/lib/` en même temps.
- Ajout de dépendance : PR courte ; après rebase, régénérer le lockfile avec `pnpm install` plutôt que de résoudre le conflit à la main.
- `public/_headers` : ajouts explicites uniquement.

## Git et déploiement

- Branches : `tool/<slug>`, `lib/<sujet>`, `fix/<sujet>`. PR vers `main`, squash merge, commits conventionnels.
- `main` est protégée : PR obligatoire, job `check` vert, squash uniquement.
- La CI (`.github/workflows/ci.yml`) construit, teste, publie un aperçu par PR (`wrangler versions upload`, lien dans le résumé du job), déploie `main` sur `outils.cavdar.dev` (`wrangler deploy`) puis rejoue les tests sur le site en ligne (job `smoke`).
- Retour arrière : `pnpm exec wrangler rollback`.
