/**
 * 种子世界生成器（阶段 1：丰富生物群系 / 树木 / 矿石 / 水下 / 分块管理）。
 *
 * 约定：
 * - 相同 seed 的 generate() 在任何平台/调用顺序下都返回相同地形。
 * - 仅使用 {@link createRng} 派生的确定性噪声/哈希，不使用 Math.random。
 * - 不破坏阶段 0 已锁签名：heightAt / biomeAt / generateChunk / GeneratedWorld(WorldRead)。
 */

import type { Seed } from "../core/seed";
import {
  CHUNK_SIZE,
  SEA_LEVEL,
  WORLD_HEIGHT,
} from "./types";
import type { BiomeId, BlockId, BlockPos, WorldRead } from "./types";

/** 确定性格点值噪声（原创实现，同 seed 必同输出）。 */
function makeNoise(seed: Seed) {
  const sample = (ix: number, iz: number): number => {
    let h = seed >>> 0;
    h = Math.imul(h ^ Math.imul(ix, 0x27d4eb2d), 0x165667b1);
    h = Math.imul(h ^ Math.imul(iz, 0x9e3779b1), 0x85ebca6b) >>> 0;
    return (h & 0xffff) / 0xffff;
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number, octaves = 3): number => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const gx = Math.floor(x * freq);
      const gz = Math.floor(z * freq);
      const fx = x * freq - gx;
      const fz = z * freq - gz;
      const v = lerp(
        lerp(sample(gx, gz), sample(gx + 1, gz), smooth(fx)),
        lerp(sample(gx, gz + 1), sample(gx + 1, gz + 1), smooth(fx)),
        smooth(fz)
      );
      sum += v * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

/** 确定性整数哈希 → [0,1)，用于矿石/树木/装饰散布。 */
function hashUnit(seed: Seed, x: number, y: number, z: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(x, 0x27d4eb2d), 0x165667b1);
  h = Math.imul(h ^ Math.imul(y, 0x9e3779b1), 0x85ebca6b);
  h = Math.imul(h ^ Math.imul(z, 0xc2b2ae35), 0x27d4eb2f) >>> 0;
  return (h & 0xffff) / 0xffff;
}

/** 树单元格哈希 → [0,1)。 */
function treeHash(seed: Seed, ccx: number, ccz: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(ccx, 0x27d4eb2d), 0x165667b1);
  h = Math.imul(h ^ Math.imul(ccz, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return (h & 0xffff) / 0xffff;
}

/** 阶段 1 确定性世界生成器（单位方块）。 */
export class DeterministicTerrainGenerator {
  readonly seed: Seed;
  private readonly cont: (x: number, z: number, o?: number) => number;
  private readonly hDetail: (x: number, z: number, o?: number) => number;
  private readonly temp: (x: number, z: number, o?: number) => number;
  private readonly moist: (x: number, z: number, o?: number) => number;

  constructor(seed: Seed) {
    this.seed = seed >>> 0;
    // 多个独立噪声场，均由 seed 派生（保持确定性与彼此独立）。
    this.cont = makeNoise(this.seed ^ 0x1111);
    this.hDetail = makeNoise(this.seed ^ 0x2222);
    this.temp = makeNoise(this.seed ^ 0x3333);
    this.moist = makeNoise(this.seed ^ 0x4444);
  }

  /** 该 (x,z) 的陆地/海洋大尺度值 [0,1)。 */
  private continent(x: number, z: number): number {
    return this.cont(x * 0.02, z * 0.02, 4);
  }

  /**
   * 表面高度（Y = 地表方块所在高度，含该方块）。
   * 海洋低于 SEA_LEVEL，陆地高于 SEA_LEVEL，滨海过渡带在附近。
   */
  heightAt(x: number, z: number): number {
    const c = this.continent(x, z);
    const d = this.hDetail(x * 0.08, z * 0.08, 3); // [0,1)
    if (c < 0.42) {
      // 开阔海洋
      return Math.round(8 + d * 7); // 8..15
    }
    if (c < 0.5) {
      // 滨海浅滩（部分露出水面）
      return Math.round(20 + d * 6); // 20..26
    }
    // 陆地
    return Math.round(SEA_LEVEL + 4 + d * 34); // 28..62
  }

  /** 判断 (x,z) 是否为海洋（低于海平面且在开阔海区）。 */
  isOcean(x: number, z: number): boolean {
    return this.continent(x, z) < 0.42;
  }

  private oceanVariant(x: number, z: number): "cold" | "warm" | "deep" {
    const t = this.temp(x * 0.02 + 50, z * 0.02 + 50, 2);
    if (t < 0.4) return "cold";
    if (t < 0.75) return "warm";
    return "deep";
  }

  /** 推断生物群系（确定性）。 */
  biomeAt(x: number, z: number): BiomeId {
    const c = this.continent(x, z);
    if (c < 0.42) {
      const v = this.oceanVariant(x, z);
      return v === "cold" ? "ocean_cold" : v === "warm" ? "ocean_warm" : "ocean_deep";
    }
    if (c < 0.5) return "plains"; // 滨海浅滩，表面用沙
    const h = this.heightAt(x, z);
    if (h >= 52) return "mountains";
    const t = this.temp(x * 0.02 + 100, z * 0.02 + 100, 2);
    const m = this.moist(x * 0.02 + 200, z * 0.02 + 200, 2);
    if (t < 0.4 && m < 0.5) return "desert";
    if (m >= 0.55) return "forest";
    return "plains";
  }

  /** 是否为海洋/滨海（需要表面沙或水）。 */
  private nearShore(x: number, z: number): boolean {
    // 采样邻域判断是否紧邻水体（确定性）。
    const c = this.continent(x, z);
    if (c < 0.5) return true;
    const n =
      this.continent(x + 1, z) +
      this.continent(x - 1, z) +
      this.continent(x, z + 1) +
      this.continent(x, z - 1);
    return n / 4 < 0.5;
  }

  /** 地表方块。 */
  private surfaceBlock(biome: BiomeId, wx: number, wz: number, h: number): BlockId {
    if (this.isOcean(wx, wz)) {
      const v = this.oceanVariant(wx, wz);
      if (v === "cold") return hashUnit(this.seed, wx, 0, wz) < 0.3 ? "gravel" : "sand";
      if (v === "warm") return hashUnit(this.seed, wx, 1, wz) < 0.2 ? "coral_block" : "sand";
      return hashUnit(this.seed, wx, 2, wz) < 0.5 ? "gravel" : "stone";
    }
    if (this.nearShore(wx, wz)) return "sand";
    switch (biome) {
      case "desert":
        return "sand";
      case "mountains":
        return h >= 56 ? "snow" : "stone";
      case "forest":
      case "plains":
        return "grass";
      default:
        return "grass";
    }
  }

  /** 地表下方的第 1 层（表土/沙）。 */
  private topsoilBlock(biome: BiomeId, wx: number, wz: number): BlockId {
    if (this.isOcean(wx, wz)) {
      const v = this.oceanVariant(wx, wz);
      return v === "cold" ? "gravel" : "sand";
    }
    if (this.nearShore(wx, wz)) return "sand";
    switch (biome) {
      case "desert":
        return "sand";
      case "mountains":
        return "stone";
      default:
        return "dirt";
    }
  }

  /** 深处岩石层（沙漠/滨海为砂岩，其余为石）。 */
  private deepBlock(biome: BiomeId, wx: number, wz: number): BlockId {
    if (this.isOcean(wx, wz)) return "stone";
    if (biome === "desert" || this.nearShore(wx, wz)) {
      return "sandstone";
    }
    return "stone";
  }

  /** 石体内矿石散布（确定性）。返回矿石或 null。 */
  private oreAt(wx: number, y: number, wz: number): BlockId | null {
    const r = hashUnit(this.seed, wx, y, wz);
    if (y < 24 && r < 0.006) return "diamond_ore";
    if (r < 0.02) return "iron_ore";
    if (r < 0.04) return "coal_ore";
    if (r < 0.05) return "gold_ore";
    if (r < 0.058) return "lapis_ore";
    return null;
  }

  /** 水下装饰（珊瑚/海草/海带/海晶灯）。 */
  private underwaterDecor(biome: BiomeId, wx: number, wz: number): BlockId | null {
    const r = hashUnit(this.seed, wx, 7, wz);
    if (biome === "ocean_warm") {
      if (r < 0.1) return "coral";
      if (r < 0.25) return "sea_grass";
      return null;
    }
    if (biome === "ocean_cold") {
      if (r < 0.08) return "kelp";
      return null;
    }
    // ocean_deep
    if (r < 0.05) return "sea_lantern";
    if (r < 0.12) return "kelp";
    return null;
  }

  /** 植物/作物装饰（陆地）。 */
  private landDecor(biome: BiomeId, wx: number, wz: number): BlockId | null {
    const r = hashUnit(this.seed, wx, 3, wz);
    if (biome === "desert") {
      if (r < 0.03) return "cactus";
      if (r < 0.07) return "tall_grass";
      return null;
    }
    if (biome === "plains") {
      if (r < 0.04) return "flower_poppy";
      if (r < 0.07) return "flower_dandelion";
      if (r < 0.16) return "tall_grass";
      return null;
    }
    if (biome === "forest") {
      if (r < 0.04) return "flower_blue_orchid";
      if (r < 0.07) return "mushroom_red";
      if (r < 0.1) return "mushroom_brown";
      if (r < 0.18) return "tall_grass";
      return null;
    }
    return null;
  }

  /** 树单元格是否生成树。仅陆地（森林/平原，含滨海浅滩）生长。 */
  private treeBiome(biome: BiomeId): boolean {
    return biome === "forest" || biome === "plains";
  }

  private hasTree(ccx: number, ccz: number): boolean {
    return treeHash(this.seed, ccx, ccz) < 0.22;
  }

  /** 树高（确定性整数 4..6）。 */
  private treeHeight(ccx: number, ccz: number): number {
    return 4 + Math.floor(hashUnit(this.seed, ccx, 9, ccz) * 3);
  }

  /**
   * 生成一个区块的方块。
   * 返回 (x:0..16, z:0..16, y:0..128) 索引的数组。
   */
  generateChunk(cx: number, cz: number): BlockId[][][] {
    const grid: BlockId[][][] = [];
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      grid[lx] = [];
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        grid[lx][lz] = [];
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const biome = this.biomeAt(wx, wz);
        const h = this.heightAt(wx, wz);
        const surf = this.surfaceBlock(biome, wx, wz, h);
        const top = this.topsoilBlock(biome, wx, wz);
        const deep = this.deepBlock(biome, wx, wz);

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let block: BlockId = "air";
          if (y === 0) {
            block = "bedrock";
          } else if (y > h) {
            if (this.isOcean(wx, wz) && y <= SEA_LEVEL) {
              // 从海面到地表都要水（顶层冰面由 surfaceBlock 处理在 y==h 已水下的情形）
              block = "water";
            }
          } else if (y === h) {
            block = surf;
          } else if (y === h - 1) {
            block = top;
          } else if (y === h - 2 || y === h - 3) {
            block = top;
          } else {
            // 石体
            block = deep === "stone" ? "stone" : deep;
          }
          // 石体内矿石
          if (block === "stone") {
            const ore = this.oreAt(wx, y, wz);
            if (ore) block = ore;
          }
          grid[lx][lz][y] = block;
        }

        // 陆地/水下装饰（紧贴地表上方）
        if (!this.isOcean(wx, wz) && h >= 0 && h < WORLD_HEIGHT - 1) {
          const plant = this.landDecor(biome, wx, wz);
          if (plant && grid[lx][lz][h + 1] === "air") grid[lx][lz][h + 1] = plant;
        } else if (this.isOcean(wx, wz)) {
          const decor = this.underwaterDecor(biome, wx, wz);
          if (decor && h < WORLD_HEIGHT - 1 && grid[lx][lz][h + 1] === "water") {
            grid[lx][lz][h + 1] = decor;
          }
        }

        // 树木树干/树冠（仅森林/平原陆地）
        const treeCol = this.treeColumnAt(wx, wz);
        if (treeCol && this.treeBiome(biome)) {
          const baseH = this.heightAt(treeCol.tx, treeCol.tz);
          const topY = baseH + treeCol.th;
          if (wx === treeCol.tx && wz === treeCol.tz) {
            for (let y = baseH + 1; y <= topY && y < WORLD_HEIGHT; y++) {
              grid[lx][lz][y] = "log_oak";
            }
          }
        }
        // 树冠覆盖（含邻列）
        for (const cell of this.treeCellsCovering(wx, wz)) {
          if (!this.hasTree(cell.ccx, cell.ccz) || !this.treeBiome(biome)) continue;
          const tx = cell.ccx * 4 + 2;
          const tz = cell.ccz * 4 + 2;
          const baseH = this.heightAt(tx, tz);
          const th = this.treeHeight(cell.ccx, cell.ccz);
          const topY = baseH + th;
          const dx = Math.abs(wx - tx);
          const dz = Math.abs(wz - tz);
          for (let y = topY - 1; y <= topY + 1 && y < WORLD_HEIGHT; y++) {
            if (y <= baseH) continue;
            const inFootprint =
              y === topY + 1 ? dx <= 2 && dz <= 2 && !(Math.abs(dx) === 2 && Math.abs(dz) === 2) : dx <= 1 && dz <= 1;
            if (inFootprint && grid[lx][lz][y] === "air") {
              grid[lx][lz][y] = "leaves_oak";
            }
          }
        }
      }
    }
    return grid;
  }

  /** 若 (wx,wz) 是树桩列则返回其树信息。 */
  private treeColumnAt(wx: number, wz: number): { tx: number; tz: number; th: number } | null {
    const ccx = Math.floor((wx - 2) / 4);
    const ccz = Math.floor((wz - 2) / 4);
    const tx = ccx * 4 + 2;
    const tz = ccz * 4 + 2;
    if (tx !== wx || tz !== wz) return null;
    if (!this.hasTree(ccx, ccz)) return null;
    return { tx, tz, th: this.treeHeight(ccx, ccz) };
  }

  /** (wx,wz) 可能被其树冠覆盖的树单元格集合。 */
  private treeCellsCovering(wx: number, wz: number): Array<{ ccx: number; ccz: number }> {
    const cxset = new Set<number>();
    const czset = new Set<number>();
    for (const ccx of [Math.floor(wx / 4), Math.floor((wx - 4) / 4)]) {
      if (ccx * 4 <= wx && wx <= ccx * 4 + 4) cxset.add(ccx);
    }
    for (const ccz of [Math.floor(wz / 4), Math.floor((wz - 4) / 4)]) {
      if (ccz * 4 <= wz && wz <= ccz * 4 + 4) czset.add(ccz);
    }
    const out: Array<{ ccx: number; ccz: number }> = [];
    for (const ccx of cxset) for (const ccz of czset) out.push({ ccx, ccz });
    return out;
  }
}

/** 只读世界实现：从生成器惰性构建 + 分块装载/卸载。 */
export class GeneratedWorld implements WorldRead {
  readonly seed: Seed;
  private readonly generator: DeterministicTerrainGenerator;
  private readonly chunks = new Map<string, BlockId[][][]>();

  constructor(seed: Seed) {
    this.seed = seed;
    this.generator = new DeterministicTerrainGenerator(seed);
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private ensureChunk(cx: number, cz: number): BlockId[][][] {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generator.generateChunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** 显式装载一个区块（幂等）。 */
  loadChunk(cx: number, cz: number): void {
    this.ensureChunk(cx, cz);
  }

  /** 卸载一个区块（释放缓存）。因生成确定，重载可复现同区块。 */
  unloadChunk(cx: number, cz: number): boolean {
    return this.chunks.delete(this.chunkKey(cx, cz));
  }

  /** 某区块是否已在缓存中。 */
  isChunkLoaded(cx: number, cz: number): boolean {
    return this.chunks.has(this.chunkKey(cx, cz));
  }

  /** 当前缓存的区块数量。 */
  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  /** 当前已装载区块坐标列表。 */
  getLoadedChunks(): Array<{ cx: number; cz: number }> {
    const out: Array<{ cx: number; cz: number }> = [];
    for (const k of this.chunks.keys()) {
      const [cx, cz] = k.split(",").map(Number);
      out.push({ cx, cz });
    }
    return out;
  }

  getBlock(pos: BlockPos): BlockId {
    const cx = Math.floor(pos.x / CHUNK_SIZE);
    const cz = Math.floor(pos.z / CHUNK_SIZE);
    const lx = pos.x - cx * CHUNK_SIZE;
    const lz = pos.z - cz * CHUNK_SIZE;
    const y = Math.min(Math.max(pos.y, 0), WORLD_HEIGHT - 1);
    return this.ensureChunk(cx, cz)[lx][lz][y];
  }

  getBiome(cx: number, cz: number): BiomeId {
    return this.generator.biomeAt(cx * CHUNK_SIZE, cz * CHUNK_SIZE);
  }

  getHeight(x: number, z: number): number {
    return this.generator.heightAt(x, z);
  }

  isSolid(pos: BlockPos): boolean {
    const b = this.getBlock(pos);
    return b !== "air" && b !== "water" && b !== "lava";
  }
}
