import { describe, expect, it } from 'vitest';
import { fitWithin, isHeif, outputName } from './logic';

function ftyp(major: string, compatible: string[] = []): Uint8Array {
  const size = 16 + compatible.length * 4;
  const bytes = new Uint8Array(Math.max(size, 32));
  new DataView(bytes.buffer).setUint32(0, size);
  const write = (offset: number, s: string) => [...s].forEach((c, i) => (bytes[offset + i] = c.charCodeAt(0)));
  write(4, 'ftyp');
  write(8, major);
  compatible.forEach((brand, i) => write(16 + i * 4, brand));
  return bytes;
}

describe('isHeif', () => {
  it('reconnaît la marque principale heic', () => {
    expect(isHeif(ftyp('heic'))).toBe(true);
  });

  it('reconnaît une marque compatible mif1', () => {
    expect(isHeif(ftyp('abcd', ['mif1', 'miaf']))).toBe(true);
  });

  it('refuse un AVIF', () => {
    expect(isHeif(ftyp('avif', ['avif', 'miaf']))).toBe(false);
  });

  it('refuse un JPEG et un fichier trop court', () => {
    expect(isHeif(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(isHeif(new Uint8Array(4))).toBe(false);
  });
});

describe('fitWithin', () => {
  it('ne touche pas une image plus petite que la limite', () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });

  it('réduit en gardant les proportions', () => {
    expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032, 1080)).toEqual({ width: 810, height: 1080 });
  });

  it('sans limite, garde la taille', () => {
    expect(fitWithin(8000, 6000, null)).toEqual({ width: 8000, height: 6000 });
  });
});

describe('outputName', () => {
  it("remplace l'extension", () => {
    expect(outputName('IMG_0001.HEIC', 'jpeg')).toBe('IMG_0001.jpg');
    expect(outputName('vacances.été.webp', 'png')).toBe('vacances.été.png');
  });

  it('ajoute une extension si absente', () => {
    expect(outputName('photo', 'jpeg')).toBe('photo.jpg');
    expect(outputName('.heic', 'jpeg')).toBe('fichier.jpg');
  });
});
