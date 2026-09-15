/**
 * Generates build/icon.ico — the installer, executable and tray icon.
 *
 * Drawn from code so the repository stays free of binary assets and the icon
 * can be tweaked without an image editor. Renders a Hextech rhombus on a dark
 * rounded square with the gold frame used by the overlay itself.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SIZES = [256, 128, 64, 48, 32, 16];
const OUT = path.join(process.cwd(), 'build', 'icon.ico');

const GOLD_LIGHT = [240, 230, 210];
const GOLD = [200, 170, 110];
const GOLD_DARK = [120, 90, 40];
const BG_TOP = [16, 28, 52];
const BG_BOTTOM = [6, 14, 30];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Signed distance to a rounded square centred on the canvas (negative = inside). */
function roundedSquareDistance(x, y, size, inset, radius) {
  const half = size / 2 - inset;
  const dx = Math.abs(x - size / 2) - (half - radius);
  const dy = Math.abs(y - size / 2) - (half - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Colour + alpha for one sample point, or null when fully transparent. */
function sample(x, y, size) {
  const unit = size / 256;
  const border = Math.max(1, 9 * unit);
  const radius = 44 * unit;

  const outer = roundedSquareDistance(x, y, size, 2 * unit, radius);
  if (outer > 0) return null;

  const inner = roundedSquareDistance(x, y, size, 2 * unit + border, radius - border);
  if (inner > 0) {
    // Gold frame, brighter at the top edge.
    return [...mix(GOLD_LIGHT, GOLD_DARK, y / size), 255];
  }

  // Hextech rhombus in the middle.
  const cx = size / 2;
  const cy = size / 2;
  const reach = size * 0.30;
  const rhombus = (Math.abs(x - cx) + Math.abs(y - cy)) / reach;
  if (rhombus <= 1) {
    const t = Math.min(1, Math.max(0, (y - (cy - reach)) / (2 * reach)));
    return [...mix(GOLD_LIGHT, GOLD, t), 255];
  }

  return [...mix(BG_TOP, BG_BOTTOM, y / size), 255];
}

function renderRgba(size) {
  const supersample = size >= 64 ? 3 : 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const px = x + (sx + 0.5) / supersample;
          const py = y + (sy + 0.5) / supersample;
          const rgba = sample(px, py, size);
          if (!rgba) continue;
          r += rgba[0];
          g += rgba[1];
          b += rgba[2];
          a += 1;
        }
      }
      const samples = supersample * supersample;
      const offset = (y * size + x) * 4;
      if (a === 0) continue;
      // Average only over covered samples, then let coverage drive alpha.
      pixels[offset] = Math.round(r / a);
      pixels[offset + 1] = Math.round(g / a);
      pixels[offset + 2] = Math.round(b / a);
      pixels[offset + 3] = Math.round((a / samples) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // One filter byte (0 = none) in front of every scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, png }, index) => {
    const entry = index * 16;
    directory[entry] = size >= 256 ? 0 : size; // 0 means 256
    directory[entry + 1] = size >= 256 ? 0 : size;
    directory[entry + 2] = 0; // palette size
    directory[entry + 3] = 0; // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.png)]);
}

const images = SIZES.map((size) => ({ size, png: encodePng(size, renderRgba(size)) }));
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, encodeIco(images));
console.log(`icon geschrieben: ${OUT} (${SIZES.join(', ')} px)`);
