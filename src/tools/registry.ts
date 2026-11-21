import type { ToolMeta } from './types';

const modules = import.meta.glob<{ meta: ToolMeta }>('./*/meta.ts', { eager: true });

const showDrafts = !import.meta.env.PROD || import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';

/** Outils publiés, triés par titre. Les brouillons ne sont visibles qu'en développement. */
export const tools: ToolMeta[] = Object.values(modules)
  .map((m) => m.meta)
  .filter((t) => t.status === 'live' || showDrafts)
  .sort((a, b) => a.title.localeCompare(b.title, 'fr'));

export function getTool(slug: string): ToolMeta {
  const tool = Object.values(modules).find((m) => m.meta.slug === slug)?.meta;
  if (!tool) throw new Error(`Outil inconnu : ${slug}`);
  return tool;
}
