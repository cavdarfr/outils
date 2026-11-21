import { replaceExtension } from '../../lib/files';

export type OutputFormat = 'jpeg' | 'png';

export const MIME: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const EXTENSION: Record<OutputFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
};

/** Marques ISO-BMFF des fichiers HEIF/HEIC (y compris les séquences). */
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

/**
 * Détecte un fichier HEIF/HEIC par sa signature, sans se fier à l'extension.
 * La boîte `ftyp` commence à l'octet 4 ; la marque principale suit, puis les marques compatibles.
 */
export function isHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const ascii = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4));
  if (ascii(4) !== 'ftyp') return false;
  const boxSize = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!;
  const end = Math.min(boxSize > 0 ? boxSize : 16, bytes.length);
  if (HEIF_BRANDS.has(ascii(8))) return true;
  // Marques compatibles, après la version mineure (octets 12 à 15).
  for (let i = 16; i + 4 <= end; i += 4) {
    if (HEIF_BRANDS.has(ascii(i))) return true;
  }
  return false;
}

/** Dimensions réduites proportionnellement pour que le plus grand côté ne dépasse pas `maxSide`. */
export function fitWithin(width: number, height: number, maxSide: number | null): { width: number; height: number } {
  if (!maxSide || (width <= maxSide && height <= maxSide)) return { width, height };
  const scale = maxSide / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Nom du fichier converti : même nom, extension du format de sortie. */
export function outputName(name: string, format: OutputFormat): string {
  return replaceExtension(name, EXTENSION[format]);
}

/**
 * Plafond de pixels décodés, pour éviter que le navigateur ferme l'onglet faute de mémoire.
 * Les iPhone et iPad disposent de beaucoup moins de mémoire par onglet qu'un ordinateur.
 */
export function pixelBudget(isAppleMobile: boolean): number {
  return isAppleMobile ? 50_000_000 : 120_000_000;
}
