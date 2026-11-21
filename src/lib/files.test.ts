import { describe, expect, it } from 'vitest';
import { formatBytes, replaceExtension, uniqueNames, zipFiles } from './files';

describe('uniqueNames', () => {
  it('numérote les doublons sans tenir compte de la casse', () => {
    expect(uniqueNames(['a.jpg', 'A.jpg', 'b.jpg', 'a.jpg'])).toEqual(['a.jpg', 'A (2).jpg', 'b.jpg', 'a (3).jpg']);
  });

  it('évite les collisions avec des noms déjà suffixés', () => {
    const names = uniqueNames(['photo.jpg', 'photo.jpg', 'photo (2).jpg']);
    expect(names).toEqual(['photo.jpg', 'photo (2).jpg', 'photo (2) (2).jpg']);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });
});

describe('replaceExtension', () => {
  it("remplace ou ajoute l'extension", () => {
    expect(replaceExtension('scan.final.PDF', 'png')).toBe('scan.final.png');
    expect(replaceExtension('photo', 'jpg')).toBe('photo.jpg');
    expect(replaceExtension('.heic', 'jpg')).toBe('fichier.jpg');
  });
});

describe('formatBytes', () => {
  it('formate en français', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(2048)).toBe('2 Ko');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3,5 Mo');
  });
});

describe('zipFiles', () => {
  it('produit une archive ZIP avec des noms uniques', async () => {
    const zip = await zipFiles([
      { name: 'a.txt', blob: new Blob(['un']) },
      { name: 'a.txt', blob: new Blob(['deux']) },
    ]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('a (2).txt');
  });
});
