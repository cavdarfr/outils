// Génère des images d'exemple synthétiques (dégradé + motif, aucune donnée personnelle).
// Usage : node scripts/make-fixtures.mjs   (macOS requis pour la conversion HEIC via `sips`)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const W = 640, H = 480;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const i = y * (W * 4 + 1) + 1 + x * 4;
    const stripe = ((x >> 5) + (y >> 5)) % 2;
    raw[i] = Math.round((x / W) * 255);
    raw[i + 1] = stripe ? 160 : 90;
    raw[i + 2] = Math.round((y / H) * 255);
    raw[i + 3] = x < 40 ? 0 : 255; // bande transparente à gauche
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // profondeur
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync('fixtures', { recursive: true });
writeFileSync('fixtures/exemple.png', png);
execFileSync('sips', ['-s', 'format', 'heic', 'fixtures/exemple.png', '--out', 'fixtures/exemple.heic'], { stdio: 'ignore' });
console.log('fixtures/exemple.png et fixtures/exemple.heic générés');
