import { describe, expect, it } from "vitest";
import {
  DeterministicTerrainGenerator,
  GeneratedWorld,
} from "../../src/world/generator";
import { findTreasureSites } from "../../src/world/structures";
import {
  digBuriedTreasure,
  makeTreasureClue,
  makeTreasureMap,
  resolveTreasureClue,
  treasureLandmark,
  validTreasureSites,
} from "../../src/world/treasure";

const SEEDS = [1400, 42, 99];

describe("W10 treasure map: deterministic guidance to target", () => {
  it("resolves every clue back to its exact treasure site", () => {
    for (const seed of SEEDS) {
      const g = new DeterministicTerrainGenerator(seed);
      const sites = findTreasureSites(g, -512, -512, 512, 512);
      expect(sites.length).toBeGreaterThan(0);
      const map = makeTreasureMap(seed, sites);
      expect(map.length).toBe(sites.length);
      for (const entry of map) {
        const resolved = resolveTreasureClue(entry.clue, seed);
        expect(resolved.x).toBe(entry.site.x);
        expect(resolved.z).toBe(entry.site.z);
        // 线索提供人类可读数字引导
        expect(entry.clue.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("landmark and clues are seed-deterministic", () => {
    for (const seed of SEEDS) {
      // 不同种子地标不同
      expect(treasureLandmark(seed)).toEqual(treasureLandmark(seed));
      const g = new DeterministicTerrainGenerator(seed);
      const sites = findTreasureSites(g, -512, -512, 512, 512);
      const s = sites[0];
      expect(makeTreasureClue(s, seed)).toEqual(makeTreasureClue(s, seed));
    }
  });

  it("different seeds give different landmark (guidance not constant)", () => {
    const a = treasureLandmark(1400);
    const b = treasureLandmark(999);
    expect(`${a.x},${a.z}`).not.toBe(`${b.x},${b.z}`);
  });
});

describe("W10 buried treasure: diggable rewards (vitest assertions)", () => {
  it("every discovered site has a buried chest in the world", () => {
    for (const seed of SEEDS) {
      const g = new DeterministicTerrainGenerator(seed);
      const w = new GeneratedWorld(seed);
      const sites = findTreasureSites(g, -512, -512, 512, 512);
      const valid = validTreasureSites(w, sites);
      // 所有找到的站点在地形生效后都应埋有箱子
      expect(valid.length).toBe(sites.length);
      expect(valid.length).toBeGreaterThan(0);
    }
  });

  it("digging a treasure site yields a non-empty reward", () => {
    const seed = 1400;
    const g = new DeterministicTerrainGenerator(seed);
    const w = new GeneratedWorld(seed);
    const sites = findTreasureSites(g, -512, -512, 512, 512);
    const valid = validTreasureSites(w, sites);
    expect(valid.length).toBeGreaterThan(0);
    for (const s of valid) {
      const loot = digBuriedTreasure(w, s.x, s.z, seed);
      expect(loot.length).toBeGreaterThan(0);
      for (const stack of loot) {
        expect(stack.count).toBeGreaterThan(0);
      }
    }
  });

  it("digging a non-treasure location yields nothing", () => {
    const seed = 1400;
    const g = new DeterministicTerrainGenerator(seed);
    const w = new GeneratedWorld(seed);
    const sites = findTreasureSites(g, -512, -512, 512, 512);
    const set = new Set(sites.map((s) => `${s.x},${s.z}`));
    // 找一个不是宝藏的海洋站点
    let nonTreasure = -1;
    for (let x = 200; x < 512; x++) {
      const z = 200;
      if (g.isOcean(x, z) && !set.has(`${x},${z}`)) {
        // 确认该处没有 chest
        const h = w.getHeight(x, z);
        if (h >= 1 && w.getBlock({ x, y: h - 1, z }) !== "chest") {
          nonTreasure = x;
          break;
        }
      }
    }
    expect(nonTreasure).toBeGreaterThan(-1);
    expect(digBuriedTreasure(w, nonTreasure, 200, seed)).toEqual([]);
  });

  it("reward is deterministic for same seed + site", () => {
    const seed = 1400;
    const g = new DeterministicTerrainGenerator(seed);
    const w = new GeneratedWorld(seed);
    const sites = findTreasureSites(g, -512, -512, 512, 512);
    const valid = validTreasureSites(w, sites);
    const s = valid[0];
    const a = digBuriedTreasure(w, s.x, s.z, seed);
    const b = digBuriedTreasure(w, s.x, s.z, seed);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
