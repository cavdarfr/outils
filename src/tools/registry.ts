import type { ToolMeta } from './types';

const modules = import.meta.glob<{ meta: ToolMeta }>('./*/meta.ts', { eager: true });

const showDrafts = !import.meta.env.PROD;

/**
 * Outils listés (accueil, sitemap), triés par titre. Les brouillons n'apparaissent qu'en développement ;
 * en production leur page reste accessible par son adresse, avec noindex, pour les aperçus de PR.
 */
export const tools: ToolMeta[] = Object.values(modules)
  .map((m) => m.meta)
  .filter((t) => t.status === 'live' || showDrafts)
  .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

export function getTool(slug: string): ToolMeta {
  const tool = Object.values(modules).find((m) => m.meta.slug === slug)?.meta;
  if (!tool) throw new Error(`Outil inconnu : ${slug}`);
  return tool;
}
