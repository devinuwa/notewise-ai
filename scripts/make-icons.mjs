/**
 * Writes NoteWise four-square logo PNGs (192/512 + maskable + OG).
 * Pure Node — no sharp. Colours match app/globals.css tokens.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const GREEN = [0x3d, 0x5f, 0x58];
const SQUARES = [
  [0xf2, 0xf2, 0xeb], // paper
  [0xe5, 0x39, 0x27], // red
  [0xf5, 0xb7, 0x26], // yellow
  [0x8b, 0xb2, 0xde], // blue
];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function png(width, height, paint) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Paint the four-square mark centred on the green canvas. */
function logoPainter(padRatio) {
  return (x, y, w, h) => {
    const side = Math.min(w, h);
    const pad = Math.round(side * padRatio);
    const gap = Math.max(2, Math.round(side * 0.02));
    const cell = Math.floor((side - pad * 2 - gap) / 2);
    const ox = Math.floor((w - (cell * 2 + gap)) / 2);
    const oy = Math.floor((h - (cell * 2 + gap)) / 2);
    if (x < ox || y < oy || x >= ox + cell * 2 + gap || y >= oy + cell * 2 + gap) return GREEN;
    const col = x < ox + cell ? 0 : x < ox + cell + gap ? -1 : 1;
    const row = y < oy + cell ? 0 : y < oy + cell + gap ? -1 : 1;
    if (col < 0 || row < 0) return GREEN;
    return SQUARES[row * 2 + col];
  };
}

function write(rel, width, height, padRatio) {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png(width, height, logoPainter(padRatio)));
  console.log(path);
}

write("icons/icon-192.png", 192, 192, 0.18);
write("icons/icon-512.png", 512, 512, 0.18);
write("icons/icon-maskable-192.png", 192, 192, 0.12);
write("icons/icon-maskable-512.png", 512, 512, 0.12);
write("og.png", 1200, 630, 0.22);
