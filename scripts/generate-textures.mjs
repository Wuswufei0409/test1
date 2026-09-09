/**
 * IMP-2 原创像素纹理生成器（程序生成，原创建意资产，MIT）。
 *
 * 从 src/blocks/registry.ts 解析每个方块的基础色，生成 16x16 像素化 RGBA
 * 纹理 PNG 写入 assets/textures/<id>.png，并据此更新 assets/README.md 资产登记表。
 * 不复制任何受版权素材 —— 全部为代码内程序生成的像素噪声纹理。
 *
 * 用法：node scripts/generate-textures.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(root, "src/blocks/registry.ts");
const texDir = join(root, "assets/textures");
const size = 16;

const src = readFileSync(registryPath, "utf8");

// ---- 解析 registry：每个 meta({...}) 取 id 与 color ----
const ids = new Set();
const parsed = [];
const idRe = /id:\s*"([a-z_]+)"/g;
let m;
while ((m = idRe.exec(src)) !== null) {
  ids.add(m[1]);
}
// 逐块扫描 "meta({ ... })" 块，取 id + color
const blockRe = /meta\(\{([\s\S]*?)\n\s*\}\)/g;
let b;
while ((b = blockRe.exec(src)) !== null) {
  const body = b[1];
  const i = body.match(/id:\s*"([a-z_]+)"/);
  const c = body.match(/color:\s*(0x[0-9a-fA-F]+)/);
  if (i && c) {
    const idName = i[1];
    const color = parseInt(c[1], 16);
    if (!parsed.find((p) => p.id === idName)) {
      parsed.push({ id: idName, color });
    }
  }
}

// ---- 简单确定性哈希（同方块同纹理，可复现）----
function hash(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- 最小 PNG 编码器（RGBA，filter 0）----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // scanlines with filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    for (let x = 0; x < width * 4; x++) raw[p++] = rgba[y * width * 4 + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 为每个方块生成 16x16 像素纹理 ----
function makeTexture(colorHex, idName) {
  const r0 = (colorHex >> 16) & 0xff;
  const g0 = (colorHex >> 8) & 0xff;
  const b0 = colorHex & 0xff;
  const h = hash(idName);
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 2x2 像素块 + 确定性噪声，制造像素化质感
      const n = hash(idName + ":" + (x >> 1) + "," + (y >> 1));
      const v = (n % 24) - 12; // -12..11
      const r = Math.max(0, Math.min(255, r0 + v));
      const g = Math.max(0, Math.min(255, g0 + v));
      const bl = Math.max(0, Math.min(255, b0 + v));
      const i = (y * size + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = bl;
      out[i + 3] = 255;
    }
  }
  return out;
}

mkdirSync(texDir, { recursive: true });
let generated = 0;
for (const { id, color } of parsed) {
  const png = encodePng(size, size, makeTexture(color, id));
  writeFileSync(join(texDir, `${id}.png`), png);
  generated++;
}
console.log(`generated ${generated} textures -> assets/textures/*.png (parsed ids=${parsed.length}, declared=${ids.size})`);

// ---- 更新资产登记表（assets/README.md）----
const readmePath = join(root, "assets/README.md");
if (generated > 0) {
  const rows = parsed
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id }) => `| \`textures/${id}.png\` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | ${id} 方块基础色 + 确定性像素噪声 |`)
    .join("\n");
  const marker = "| `textures/`（目录级占位）";
  const replacement =
    "| `textures/`（程序生成） | 纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | 阶段 1：48 个方块的程序生成像素纹理，见下方逐项登记 |\n" +
    "| `audio/`（目录级占位） | 音频 | — | — | 暂无音频资产 |\n" +
    "| `models/`（目录级占位） | 模型 | — | — | 暂无模型资产 |\n\n" +
    "### 纹理逐项登记（程序生成，原创建意资产）\n\n| 路径 | 类型 | 来源 | 许可证 | 说明 |\n| ---- | ---- | ---- | ------ | ---- |\n" +
    rows;
  let txt = readFileSync(readmePath, "utf8");
  if (txt.includes(marker)) {
    txt = txt.replace(marker, replacement);
  }
  writeFileSync(readmePath, txt);
  console.log("updated assets/README.md asset table");
}
