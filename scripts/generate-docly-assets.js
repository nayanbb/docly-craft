import fs from "node:fs";
import zlib from "node:zlib";

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  table[i] = c;
}
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgbaBuffer) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk("IHDR", ihdrData);
  const rawRows = [];
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(stride + 1);
    row[0] = 0;
    rgbaBuffer.copy(row, 1, y * stride, (y + 1) * stride);
    rawRows.push(row);
  }
  const idatData = zlib.deflateSync(Buffer.concat(rawRows), { level: 9 });
  const idat = makeChunk("IDAT", idatData);
  const iend = makeChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([header, ihdr, idat, iend]);
}

const b = fs.readFileSync("public/brand/docly-logo-original.png");
let offset = 8,
  idatChunks = [],
  srcW = 0,
  srcH = 0;
while (offset < b.length) {
  const len = b.readUInt32BE(offset);
  const type = b.toString("ascii", offset + 4, offset + 8);
  if (type === "IHDR") {
    srcW = b.readUInt32BE(offset + 8);
    srcH = b.readUInt32BE(offset + 12);
  } else if (type === "IDAT") idatChunks.push(b.subarray(offset + 8, offset + 8 + len));
  offset += 12 + len;
}
const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
const stride = srcW * 4;
const srcPixels = Buffer.alloc(srcW * srcH * 4);

for (let y = 0; y < srcH; y++) {
  const filter = decompressed[y * (stride + 1)];
  const lineStart = y * (stride + 1) + 1;
  const outStart = y * stride;
  if (filter === 0) decompressed.copy(srcPixels, outStart, lineStart, lineStart + stride);
  else if (filter === 1) {
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? srcPixels[outStart + x - 4] : 0;
      srcPixels[outStart + x] = (decompressed[lineStart + x] + left) & 0xff;
    }
  } else if (filter === 2) {
    for (let x = 0; x < stride; x++) {
      const up = y > 0 ? srcPixels[outStart - stride + x] : 0;
      srcPixels[outStart + x] = (decompressed[lineStart + x] + up) & 0xff;
    }
  } else if (filter === 3) {
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? srcPixels[outStart + x - 4] : 0;
      const up = y > 0 ? srcPixels[outStart - stride + x] : 0;
      srcPixels[outStart + x] = (decompressed[lineStart + x] + Math.floor((left + up) / 2)) & 0xff;
    }
  } else if (filter === 4) {
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? srcPixels[outStart + x - 4] : 0,
        b = y > 0 ? srcPixels[outStart - stride + x] : 0,
        c = x >= 4 && y > 0 ? srcPixels[outStart - stride + x - 4] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      let pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      srcPixels[outStart + x] = (decompressed[lineStart + x] + pr) & 0xff;
    }
  }
}

// Exactly 248x248 for the D icon!
const minX = 151,
  maxX = 398,
  minY = 200,
  maxY = 447;
const pad = 6;
const boxSize = 248 + pad * 2; // 260
const startX = minX - pad;
const startY = minY - pad;

const iconBuf = Buffer.alloc(boxSize * boxSize * 4);
const visited = new Uint8Array(boxSize * boxSize);
const queue = [];

function isOuterBg(x, y) {
  const sx = startX + x,
    sy = startY + y;
  if (sx < 0 || sx >= srcW || sy < 0 || sy >= srcH) return true;
  const idx = (sy * srcW + sx) * 4;
  return srcPixels[idx] > 235 && srcPixels[idx + 1] > 235 && srcPixels[idx + 2] > 235;
}

for (let x = 0; x < boxSize; x++) {
  if (isOuterBg(x, 0)) {
    queue.push(x, 0);
    visited[0 * boxSize + x] = 1;
  }
  if (isOuterBg(x, boxSize - 1)) {
    queue.push(x, boxSize - 1);
    visited[(boxSize - 1) * boxSize + x] = 1;
  }
}
for (let y = 0; y < boxSize; y++) {
  if (isOuterBg(0, y) && !visited[y * boxSize + 0]) {
    queue.push(0, y);
    visited[y * boxSize + 0] = 1;
  }
  if (isOuterBg(boxSize - 1, y) && !visited[y * boxSize + (boxSize - 1)]) {
    queue.push(boxSize - 1, y);
    visited[y * boxSize + (boxSize - 1)] = 1;
  }
}

let qHead = 0;
while (qHead < queue.length) {
  const qx = queue[qHead++];
  const qy = queue[qHead++];
  for (const [nx, ny] of [
    [qx + 1, qy],
    [qx - 1, qy],
    [qx, qy + 1],
    [qx, qy - 1],
  ]) {
    if (nx >= 0 && nx < boxSize && ny >= 0 && ny < boxSize) {
      const nIdx = ny * boxSize + nx;
      if (!visited[nIdx] && isOuterBg(nx, ny)) {
        visited[nIdx] = 1;
        queue.push(nx, ny);
      }
    }
  }
}

for (let y = 0; y < boxSize; y++) {
  for (let x = 0; x < boxSize; x++) {
    const dstIdx = (y * boxSize + x) * 4;
    const sx = startX + x,
      sy = startY + y;
    if (visited[y * boxSize + x] === 1 || sx < minX || sx > maxX || sy < minY || sy > maxY) {
      iconBuf[dstIdx + 3] = 0;
    } else {
      const srcIdx = (sy * srcW + sx) * 4;
      iconBuf[dstIdx] = srcPixels[srcIdx];
      iconBuf[dstIdx + 1] = srcPixels[srcIdx + 1];
      iconBuf[dstIdx + 2] = srcPixels[srcIdx + 2];
      iconBuf[dstIdx + 3] = 255;
    }
  }
}

const iconPng = encodePng(boxSize, boxSize, iconBuf);
fs.writeFileSync("public/brand/docly-icon.png", iconPng);

function downscale(srcBuf, sSize, dSize) {
  const dstBuf = Buffer.alloc(dSize * dSize * 4);
  const scale = sSize / dSize;
  for (let dy = 0; dy < dSize; dy++) {
    for (let dx = 0; dx < dSize; dx++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0;
      const startX = Math.floor(dx * scale);
      const endX = Math.min(sSize, Math.floor((dx + 1) * scale));
      const startY = Math.floor(dy * scale);
      const endY = Math.min(sSize, Math.floor((dy + 1) * scale));
      for (let sy = startY; sy < endY; sy++) {
        for (let sx = startX; sx < endX; sx++) {
          const idx = (sy * sSize + sx) * 4;
          const alpha = srcBuf[idx + 3] / 255;
          r += srcBuf[idx] * alpha;
          g += srcBuf[idx + 1] * alpha;
          b += srcBuf[idx + 2] * alpha;
          a += srcBuf[idx + 3];
          count++;
        }
      }
      const dIdx = (dy * dSize + dx) * 4;
      if (a > 0 && count > 0) {
        const totalA = a / count;
        dstBuf[dIdx] = Math.round(r / (a / 255));
        dstBuf[dIdx + 1] = Math.round(g / (a / 255));
        dstBuf[dIdx + 2] = Math.round(b / (a / 255));
        dstBuf[dIdx + 3] = Math.round(totalA);
      }
    }
  }
  return dstBuf;
}

const apple180 = encodePng(180, 180, downscale(iconBuf, boxSize, 180));
fs.writeFileSync("public/apple-touch-icon.png", apple180);

const fav48 = encodePng(48, 48, downscale(iconBuf, boxSize, 48));
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(48, 0);
dirEntry.writeUInt8(48, 1);
dirEntry.writeUInt8(0, 2);
dirEntry.writeUInt8(0, 3);
dirEntry.writeUInt16LE(1, 4);
dirEntry.writeUInt16LE(32, 6);
dirEntry.writeUInt32LE(fav48.length, 8);
dirEntry.writeUInt32LE(22, 12);

const icoBuf = Buffer.concat([icoHeader, dirEntry, fav48]);
fs.writeFileSync("public/favicon.ico", icoBuf);

const iconBase64 = iconPng.toString("base64");
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxSize} ${boxSize}">
  <image width="${boxSize}" height="${boxSize}" href="data:image/png;base64,${iconBase64}"/>
</svg>`;
fs.writeFileSync("public/favicon.svg", svgContent);

console.log("Regenerated clean D icon, apple-touch-icon, favicon.ico and favicon.svg successfully!");
