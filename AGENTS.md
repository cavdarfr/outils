# outils.cavdar.dev

Site statique de petits outils qui traitent les fichiers dans le navigateur. Rien n'est envoyé à un serveur.

## Commandes

- `pnpm dev` : serveur de développement (port `PORT`, 4321 par défaut).
- `pnpm check` : vérification des types, tests unitaires, build. Doit passer avant toute PR.
- `pnpm e2e` : tests Playwright sur le site construit, servi par `wrangler dev` comme en production (port `E2E_PORT`, 8788 par défaut). Lancer `pnpm build` avant.
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

1. Créer `src/tools/<slug>/` :
   - `meta.ts` : `ToolMeta` complet (voir `src/tools/types.ts`), `status: 'draft'` tant que l'outil n'est pas fini ;
   - `Tool.tsx` : îlot Preact ;
   - `logic.ts` + `logic.test.ts` : fonctions pures testées ;
   - `worker.ts` si le traitement est lourd (bibliothèques WASM chargées par `import()` dynamique, dans le worker).
2. Créer `src/pages/<slug>.astro` sur le modèle de `heic-en-jpg.astro` (`ToolLayout`, `client:load`, aide et FAQ dans le slot `help`).
3. Ajouter `e2e/<slug>.spec.ts` : cas nominal avec fixture, `guardNetwork(...).assertClean()`, cas d'erreur. Ajouter la page à `e2e/site.spec.ts` (accessibilité).
4. Lister les nouvelles bibliothèques dans `src/pages/licences.astro`.
5. Contrôler sur le simulateur iPhone (`xcrun simctl`) si l'outil traite des images ou des PDF.
6. Passer `status: 'live'`. L'accueil, le sitemap et les catégories se mettent à jour seuls : ne jamais committer d'index généré.

## Code partagé et travail en parallèle

- Un outil ne dépend que de `src/lib/` et `src/components/`, jamais d'un autre outil.
- Pas d'abstraction anticipée : un code reste dans l'outil qui l'utilise et n'est extrait dans `src/lib/` qu'au deuxième usage.
- Une extraction vers `src/lib/` passe par une branche `lib/<sujet>` courte, fusionnée avant les branches d'outils, qui se rebasent ensuite. Jamais deux branches qui modifient `src/lib/` en même temps.
- Ajout de dépendance : PR courte ; après rebase, régénérer le lockfile avec `pnpm install` plutôt que de résoudre le conflit à la main.
- `public/_headers` : ajouts explicites uniquement.

## Git et déploiement

- Branches : `tool/<slug>`, `lib/<sujet>`, `fix/<sujet>`. PR vers `main`, squash merge, commits conventionnels.
- La CI (`.github/workflows/ci.yml`) construit, teste, publie un aperçu par PR (`wrangler versions upload`) et déploie `main` sur `outils.cavdar.dev` (`wrangler deploy`).
- Retour arrière : `pnpm exec wrangler rollback`.
