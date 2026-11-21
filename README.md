# outils.cavdar.dev

Petits outils gratuits pour les images, PDF et documents, qui fonctionnent entièrement dans le navigateur : aucun fichier envoyé, aucun compte, aucune publicité, aucun cookie.

**En ligne :** https://outils.cavdar.dev

## Outils

- [Convertir HEIC, WebP, AVIF en JPG ou PNG](https://outils.cavdar.dev/heic-en-jpg)

## Comment c'est garanti

- Le site est statique, sans serveur applicatif.
- La politique de sécurité (CSP) interdit toute connexion vers un autre domaine, y compris depuis les Web Workers.
- Les tests de bout en bout échouent si une requête part vers une autre origine ou transporte un corps.

## Développement

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm check      # types, tests unitaires, build
pnpm e2e        # Playwright sur Chromium, Firefox, WebKit et iPhone émulé
```

Stack : Astro (sortie statique), îlots Preact, Web Workers, Cloudflare Workers (assets statiques). Voir [AGENTS.md](AGENTS.md) pour les conventions.

## Licence

MIT. Les bibliothèques tierces gardent leur licence ; voir la page [Licences](https://outils.cavdar.dev/licences).
