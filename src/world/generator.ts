/**
 * 种子世界生成器（阶段 0：确定性骨架）。
 *
 * 约定：
 * - 相同 seed 的 generate() 在任何平台/调用顺序下都返回相同地形。
 * - 仅使用 {@link createRng} 派生的确定性噪声，不使用 Math.random。
 * - 此实现是可复现地基，后续阶段按 biome/结构扩展，但必须保持同 seed 稳定性。
 */

import type { Seed } from "../core/seed";
import { CHUNK_SIZE, WORLD_HEIGHT } from "./types";
import type { BiomeId, BlockId, BlockPos, WorldRead } from "./types";

/** 简单的确定性值噪声（原创，基于 seed 派生的 hash 格点插值）。 */
function makeNoise(seed: Seed) {
  // 为每个格点派生稳定的伪随机高度。使用整数混合保持确定性。
  const sample = (ix: number, iz: number): number => {
    let h = seed >>> 0;
    h = Math.imul(h ^ Math.imul(ix, 0x27d4eb2d), 0x165667b1);
    h = Math.imul(h ^ Math.imul(iz, 0x9e3779b1), 0x85ebca6b) >>> 0;
    return (h & 0xffff) / 0xffff; // [0,1) 确定性伪随机
  };
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const smooth = (t: number): number => t * t * (3 - 2 * t);

  // 多倍频分形叠加，产生低频起伏 + 中频细节。
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
      const v00 = sample(gx, gz);
      const v10 = sample(gx + 1, gz);
      const v01 = sample(gx, gz + 1);
      const v11 = sample(gx + 1, gz + 1);
      const sx = smooth(fx);
      const sz = smooth(fz);
      const v = lerp(
        lerp(v00, v10, sx),
        lerp(v01, v11, sx),
        sz
      );
      sum += v * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

/** 阶段 0：基于 seed 的确定性地形生成。单位方块。 */
export class DeterministicTerrainGenerator {
  readonly seed: Seed;
  private readonly noise: (x: number, z: number, o?: number) => number;

  constructor(seed: Seed) {
    this.seed = seed;
    this.noise = makeNoise(seed);
  }

  /** 该 (x,z) 的表面高度（Y = 地表方块所在高度，含该方块）。 */
  heightAt(x: number, z: number): number {
    const n = this.noise(x * 0.02, z * 0.02, 3); // [0,1)
    // 映射到 8..72，形成平原/丘陵起伏
    return Math.round(8 + n * 56);
  }

  /** 由高度与噪声推断简单生物群系（确定性）。 */
  biomeAt(x: number, z: number): BiomeId {
    const n = this.noise(x * 0.01 + 100, z * 0.01 + 100, 2);
    if (n < 0.25) return "ocean_cold";
    if (n < 0.4) return "desert";
    if (n < 0.6) return "plains";
    if (n < 0.8) return "forest";
    return "mountains";
  }

  /** 生成一个区块的方块。返回以 (0..CHUNK_SIZE, 0..WORLD_HEIGHT, 0..CHUNK_SIZE) 为索引的数组。 */
  generateChunk(cx: number, cz: number): BlockId[][][] {
    const grid: BlockId[][][] = [];
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      grid[lx] = [];
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        grid[lx][lz] = [];
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          let block: BlockId = "air";
          if (y < h - 3) block = "stone";
          else if (y < h) block = "dirt";
          else if (y === h) {
            block =
              biome === "desert"
                ? "sand"
                : biome === "ocean_cold"
                  ? "sand"
                  : biome === "forest" || biome === "mountains"
                    ? "grass"
                    : "grass";
          }
          if (biome === "ocean_cold" && y <= h && h < 16) block = "water";
          if (biome === "ocean_cold" && h < 12 && y === h) block = "gravel";
          grid[lx][lz][y] = block;
        }
      }
    }
    return grid;
  }
}

/** 最小只读世界实现，从生成器惰性构建（阶段 0 基础）。 */
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

  getBlock(pos: BlockPos): import("./types").BlockId {
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
    return b !== "air" && b !== "water";
  }
}
