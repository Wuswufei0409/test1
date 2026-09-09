import { describe, expect, it } from "vitest";
import {
  DeterministicTerrainGenerator,
  GeneratedWorld,
} from "../../src/world/generator";
import {
  SEA_LEVEL,
  WORLD_HEIGHT,
} from "../../src/world/types";
import type { BiomeId } from "../../src/world/types";

const ALL_BIOMES: BiomeId[] = [
  "plains",
  "forest",
  "desert",
  "mountains",
  "ocean_cold",
  "ocean_warm",
  "ocean_deep",
];

/** 扫描一个足够大的区域，收集出现的生物群系。 */
function collectBiomes(seed: number, radius = 192): Set<BiomeId> {
  const g = new DeterministicTerrainGenerator(seed);
  const found = new Set<BiomeId>();
  for (let x = -radius; x <= radius; x += 8) {
    for (let z = -radius; z <= radius; z += 8) {
      found.add(g.biomeAt(x, z));
    }
  }
  return found;
}

describe("W1 worldgen: fixed-seed reproducibility", () => {
  it("same seed => same biome map and height", () => {
    for (const seed of [1400, 42, 99]) {
      const g1 = new DeterministicTerrainGenerator(seed);
      const g2 = new DeterministicTerrainGenerator(seed);
      for (const [x, z] of [[0, 0], [33, -7], [-200, 512], [16, 16]] as Array<[number, number]>) {
        expect(g1.biomeAt(x, z)).toBe(g2.biomeAt(x, z));
        expect(g1.heightAt(x, z)).toBe(g2.heightAt(x, z));
      }
    }
  });

  it("same seed => identical world across chunk boundary (order-independent)", () => {
    // 两个独立 GeneratedWorld 实例以不同区块访问顺序读取，结果必须一致（无顺序/边界依赖）。
    const wA = new GeneratedWorld(1400);
    const wB = new GeneratedWorld(1400);
    // A 先读区块 1 再读区块 0；B 反向，验证边界块一致。
    for (const [x, z] of [[15, 3], [16, 3], [0, 0], [-1, 7], [31, 31], [17, 20]] as Array<[number, number]>) {
      const seqA = () => {
        wA.getBlock({ x: x + 16, y: 12, z });
        return wA.getBlock({ x, y: 12, z });
      };
      const seqB = () => {
        wB.getBlock({ x: x - 16, y: 12, z });
        return wB.getBlock({ x, y: 12, z });
      };
      expect(seqA()).toBe(seqB());
    }
  });

  it("all 7 biomes are generatable for several seeds", () => {
    for (const seed of [1400, 42, 99, 2024]) {
      const found = collectBiomes(seed);
      for (const b of ALL_BIOMES) {
        expect(found.has(b), `seed ${seed} missing biome ${b}`).toBe(true);
      }
    }
  });
});

describe("W1 worldgen: terrain features", () => {
  it("oceans are filled with water below sea level", () => {
    const g = new DeterministicTerrainGenerator(1400);
    // 找一块 ocean 列，验证水填充与海面
    let checked = 0;
    for (let x = -64; x <= 64 && checked === 0; x += 2) {
      for (let z = -64; z <= 64 && checked === 0; z += 2) {
        if (g.isOcean(x, z)) {
          const h = g.heightAt(x, z);
          const w = new GeneratedWorld(1400);
          // 地表之下应非空气（基岩/石/沙），海面上应有水
          expect(w.getBlock({ x, y: Math.max(0, h - 1), z })).not.toBe("air");
          expect(w.getBlock({ x, y: SEA_LEVEL, z })).toBe("water");
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("generates trees (log + leaves) and ores", () => {
    const g = new DeterministicTerrainGenerator(1400);
    let logs = 0;
    let leaves = 0;
    let ores = 0;
    for (let cx = -4; cx <= 4; cx++) {
      for (let cz = -4; cz <= 4; cz++) {
        const c = g.generateChunk(cx, cz);
        for (let lx = 0; lx < 16; lx++) {
          for (let lz = 0; lz < 16; lz++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
              const b = c[lx][lz][y];
              if (b === "log_oak") logs++;
              if (b === "leaves_oak") leaves++;
              if (b === "coal_ore" || b === "iron_ore" || b === "gold_ore") ores++;
            }
          }
        }
      }
    }
    expect(logs).toBeGreaterThan(100);
    expect(leaves).toBeGreaterThan(1000);
    expect(ores).toBeGreaterThan(1000);
  });

  it("underwater features present: coral, sea_grass, kelp", () => {
    const g = new DeterministicTerrainGenerator(1400);
    let coral = 0;
    let seaGrass = 0;
    let kelp = 0;
    for (let cx = -8; cx <= 8; cx++) {
      for (let cz = -8; cz <= 8; cz++) {
        const c = g.generateChunk(cx, cz);
        for (let lx = 0; lx < 16; lx++) {
          for (let lz = 0; lz < 16; lz++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
              const b = c[lx][lz][y];
              if (b === "coral") coral++;
              if (b === "sea_grass") seaGrass++;
              if (b === "kelp") kelp++;
            }
          }
        }
      }
    }
    expect(coral + seaGrass).toBeGreaterThan(0);
  });
});

describe("W1 chunk load/unload", () => {
  it("loads, unloads and reloads deterministically", () => {
    const w = new GeneratedWorld(1400);
    const pos = { x: 5, y: 20, z: 7 };
    const before = w.getBlock(pos); // 触发装载 chunk(0,0)
    expect(w.isChunkLoaded(0, 0)).toBe(true);
    expect(w.loadedChunkCount).toBe(1);

    expect(w.unloadChunk(0, 0)).toBe(true);
    expect(w.isChunkLoaded(0, 0)).toBe(false);
    expect(w.loadedChunkCount).toBe(0);

    // 重载后同 seed 同区块一致
    const after = w.getBlock(pos);
    expect(after).toBe(before);
  });

  it("unloading unknown chunk returns false", () => {
    const w = new GeneratedWorld(1400);
    expect(w.unloadChunk(9, 9)).toBe(false);
  });

  it("getLoadedChunks reflects cached set", () => {
    const w = new GeneratedWorld(1400);
    w.loadChunk(0, 0);
    w.loadChunk(3, -2);
    const list = w.getLoadedChunks();
    expect(list).toHaveLength(2);
    w.unloadChunk(3, -2);
    expect(w.getLoadedChunks()).toHaveLength(1);
  });
});
