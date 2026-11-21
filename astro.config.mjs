// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://outils.cavdar.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [preact()],
  markdown: { syntaxHighlight: false },
  vite: {
    worker: { format: 'es' },
  },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' blob: data:",
        "worker-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },
});
