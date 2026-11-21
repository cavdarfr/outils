import { zipSync } from 'fflate';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/** Remplace l'extension d'un nom de fichier (`IMG_1.HEIC` → `IMG_1.jpg`). */
export function replaceExtension(name: string, extension: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'fichier';
  return `${base}.${extension}`;
}

/** Rend les noms uniques dans une archive (sans tenir compte de la casse) : `photo.jpg`, `photo (2).jpg`, … */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Archive ZIP sans recompression (les images et PDF sont déjà compressés). */
export async function zipFiles(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const names = uniqueNames(files.map((f) => f.name));
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const [i, f] of files.entries()) {
    entries[names[i]!] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  }
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}

/** Déclenche le téléchargement d'un Blob sous un nom donné. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** iPhone, iPad (y compris iPadOS qui se présente comme un Mac) : mémoire par onglet nettement plus faible. */
export function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}
