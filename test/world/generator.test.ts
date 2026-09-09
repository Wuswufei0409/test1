import { describe, expect, it } from "vitest";
import {
  DeterministicTerrainGenerator,
  GeneratedWorld,
} from "../../src/world/generator";
import { WORLD_HEIGHT } from "../../src/world/types";

describe("DeterministicTerrainGenerator", () => {
  it("reproduces identical height for same seed", () => {
    const g1 = new DeterministicTerrainGenerator(1400);
    const g2 = new DeterministicTerrainGenerator(1400);
    const points: Array<[number, number]> = [
      [0, 0],
      [16, 16],
      [-7, 33],
      [128, -200],
    ];
    for (const [x, z] of points) {
      expect(g1.heightAt(x, z)).toBe(g2.heightAt(x, z));
    }
  });

  it("height stays within world bounds", () => {
    const g = new DeterministicTerrainGenerator(7);
    for (let x = -32; x <= 32; x += 8) {
      for (let z = -32; z <= 32; z += 8) {
        const h = g.heightAt(x, z);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(WORLD_HEIGHT);
      }
    }
  });

  it("same seed yields same chunk grid", () => {
    const g1 = new DeterministicTerrainGenerator(99);
    const g2 = new DeterministicTerrainGenerator(99);
    const c1 = g1.generateChunk(0, 0);
    const c2 = g2.generateChunk(0, 0);
    expect(c1).toEqual(c2);
  });
});

describe("GeneratedWorld (Smoke)", () => {
  it("fixed seed is deterministic via public interface", () => {
    const w1 = new GeneratedWorld(1400);
    const w2 = new GeneratedWorld(1400);
    const pos = { x: 3, y: 10, z: 5 };
    expect(w1.getBlock(pos)).toBe(w2.getBlock(pos));
    expect(w1.getHeight(3, 5)).toBe(w2.getHeight(3, 5));
    expect(w1.getBiome(0, 0)).toBe(w2.getBiome(0, 0));
  });

  it("schema smoke: slice values are block ids", () => {
    const w = new GeneratedWorld(1400);
    const b = w.getBlock({ x: 0, y: 0, z: 0 });
    // 阶段 1：y=0 为基岩层，属合法方块 ID（覆盖阶段 0 的窄集合断言）。
    expect(b).toBe("bedrock");
  });
});
