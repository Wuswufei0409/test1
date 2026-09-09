import { describe, expect, it } from "vitest";
import {
  DeterministicTerrainGenerator,
  GeneratedWorld,
} from "../../src/world/generator";
import {
  findTreasureSites,
  listOceanStructures,
  oceanStructureAt,
  type OceanStructure,
} from "../../src/world/structures";
import { SEA_LEVEL, WORLD_HEIGHT } from "../../src/world/types";

const SEEDS = [1400, 42, 99, 2024];

describe("W10 structures: fixed-seed reproducibility", () => {
  it("same seed => identical structure placement and center", () => {
    for (const seed of SEEDS) {
      for (const cell of [[0, 0], [3, -2], [-5, 7]] as Array<[number, number]>) {
        const a = oceanStructureAt(seed, cell[0], cell[1]);
        const b = oceanStructureAt(seed, cell[0], cell[1]);
        expect(a).toEqual(b);
      }
    }
  });

  it("same seed => identical chunk grid including structures", () => {
    for (const seed of SEEDS) {
      const g1 = new DeterministicTerrainGenerator(seed);
      const g2 = new DeterministicTerrainGenerator(seed);
      for (const [cx, cz] of [[0, 0], [2, -1], [-3, 4]] as Array<[number, number]>) {
        expect(g1.generateChunk(cx, cz)).toEqual(g2.generateChunk(cx, cz));
      }
    }
  });

  it("structures reproducible across independent worlds (order-independent)", () => {
    const wA = new GeneratedWorld(1400);
    const wB = new GeneratedWorld(1400);
    for (const pos of [
      { x: 40, z: 40 },
      { x: 41, z: 41 },
      { x: 200, z: 300 },
    ]) {
      const hA = wA.getHeight(pos.x, pos.z);
      const bA = wA.getBlock({ x: pos.x, y: hA, z: pos.z });
      const hB = wB.getHeight(pos.x, pos.z);
      const bB = wB.getBlock({ x: pos.x, y: hB, z: pos.z });
      expect(hA).toBe(hB);
      expect(bA).toBe(bB);
    }
  });
});

describe("W10 structures: all feature types generatable", () => {
  it("produces coral reef / iceberg / shipwreck / underwater ruins", () => {
    for (const seed of SEEDS) {
      const g = new DeterministicTerrainGenerator(seed);
      const list = listOceanStructures(g, -640, -640, 640, 640);
      const types = new Set(list.map((s) => s.type));
      for (const t of ["coral_reef", "iceberg", "shipwreck", "underwater_ruins"]) {
        expect(types.has(t as OceanStructure["type"]), `seed ${seed} missing ${t}`).toBe(true);
      }
    }
  });

  it("keeps sea-surface water intact under icebergs and other structures", () => {
    const g = new DeterministicTerrainGenerator(1400);
    const w2 = new GeneratedWorld(1400);
    let foundOcean = 0;
    // 任意海洋列的海面必须仍是水（结构不破坏海面契约）
    for (let x = -200; x <= 200 && foundOcean < 24; x += 4) {
      for (let z = -200; z <= 200 && foundOcean < 24; z += 4) {
        if (g.isOcean(x, z)) {
          // 冰山只从 SEA_LEVEL+1 起叠冰，海面保持水
          expect(w2.getBlock({ x, y: SEA_LEVEL, z })).toBe("water");
          foundOcean++;
        }
      }
    }
    expect(foundOcean).toBeGreaterThan(0);
  });
});

describe("W10 structures: blocks actually present in world", () => {
  function scanBlock(seed: number, predicate: (b: string, x: number, z: number) => boolean): number {
    const g = new DeterministicTerrainGenerator(seed);
    let count = 0;
    for (let cx = -10; cx <= 10; cx++) {
      for (let cz = -10; cz <= 10; cz++) {
        const chunk = g.generateChunk(cx, cz);
        for (let lx = 0; lx < 16; lx++) {
          for (let lz = 0; lz < 16; lz++) {
            for (let y = 0; y < WORLD_HEIGHT; y++) {
              const b = chunk[lx][lz][y];
              if (predicate(b, cx * 16 + lx, cz * 16 + lz)) count++;
            }
          }
        }
      }
    }
    return count;
  }

  it("coral reef blocks, iceberg ice, shipwreck logs, ruins prismarine present", () => {
    const coral = scanBlock(1400, (b) => b === "coral" || b === "coral_block" || b === "sea_lantern");
    const ice = scanBlock(1400, (b) => b === "ice" || b === "packed_ice" || b === "snow");
    const logs = scanBlock(1400, (b) => b === "log_spruce" || b === "planks_oak");
    const ruins = scanBlock(1400, (b) => b === "prismarine");
    expect(coral).toBeGreaterThan(0);
    expect(ice).toBeGreaterThan(0);
    expect(logs).toBeGreaterThan(0);
    expect(ruins).toBeGreaterThan(0);
  });

  it("buried treasure chest buried one below ocean floor", () => {
    const seed = 1400;
    const g = new DeterministicTerrainGenerator(seed);
    const w = new GeneratedWorld(seed);
    const sites = findTreasureSites(g, -512, -512, 512, 512);
    expect(sites.length).toBeGreaterThan(0);
    for (const s of sites) {
      const h = w.getHeight(s.x, s.z);
      expect(h).toBeGreaterThanOrEqual(1);
      expect(w.getBlock({ x: s.x, y: h - 1, z: s.z })).toBe("chest");
      // 表面仍为海洋实体（chest 被埋在土下，海面仍为水）
      expect(w.getBlock({ x: s.x, y: SEA_LEVEL, z: s.z })).toBe("water");
    }
  });
});

describe("W10 structures: chunk stamping helper is deterministic", () => {
  it("applyOceanStructuresToChunk yields same result for same seed", () => {
    const g1 = new DeterministicTerrainGenerator(7);
    const g2 = new DeterministicTerrainGenerator(7);
    const grid1 = g1.generateChunk(3, 3);
    const grid2 = g2.generateChunk(3, 3);
    expect(grid1).toEqual(grid2);
  });
});
