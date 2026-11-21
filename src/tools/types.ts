export type ToolStatus = 'draft' | 'live';

export type ToolCategory = 'images' | 'pdf' | 'documents' | 'social' | 'pratique';

export interface ToolMeta {
  /** Segment d'URL, identique au nom du dossier et du fichier de page. */
  slug: string;
  /** Titre court affiché sur la carte et dans la page. */
  title: string;
  /** Balise <title>, orientée recherche. */
  seoTitle: string;
  /** Meta description, 150 caractères environ. */
  description: string;
  category: ToolCategory;
  keywords: string[];
  status: ToolStatus;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  images: 'Images',
  pdf: 'PDF',
  documents: 'Documents',
  social: 'Réseaux sociaux',
  pratique: 'Pratique',
};
