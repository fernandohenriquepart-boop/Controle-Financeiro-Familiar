// Gera os ícones PNG do app (manifest + apple-touch-icon) sem depender de
// nenhuma lib de imagem: desenha os pixels na mão e empacota como PNG puro
// (zlib para compressão, que já vem no Node).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [5, 150, 105, 255]; // emerald-600
const FG = [255, 255, 255, 255];
const ACCENT = [5, 150, 105, 255];

function insideRoundedRect(x, y, rx, ry, rw, rh, radius) {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false;
  const inLeft = x < rx + radius;
  const inRight = x > rx + rw - radius;
  const inTop = y < ry + radius;
  const inBottom = y > ry + rh - radius;
  if ((inLeft || inRight) && (inTop || inBottom)) {
    const cx = inLeft ? rx + radius : rx + rw - radius;
    const cy = inTop ? ry + radius : ry + rh - radius;
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  }
  return true;
}

function insideCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const walletX = size * 0.18;
  const walletY = size * 0.3;
  const walletW = size * 0.64;
  const walletH = size * 0.4;
  const radius = size * 0.06;
  const clasp = { cx: walletX + walletW - size * 0.12, cy: walletY + walletH / 2, r: size * 0.07 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG;
      if (insideRoundedRect(x, y, walletX, walletY, walletW, walletH, radius)) {
        color = FG;
        if (insideCircle(x, y, clasp.cx, clasp.cy, clasp.r)) color = ACCENT;
      }
      const i = (y * size + x) * 4;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = color[3];
    }
  }
  return pixels;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // no filter
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = chunk("IDAT", zlib.deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const outDir = path.join(__dirname, "..", "public");
for (const size of [192, 512, 180]) {
  const png = encodePng(size, renderIcon(size));
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`wrote ${name} (${png.length} bytes)`);
}
