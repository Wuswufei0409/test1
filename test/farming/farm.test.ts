import { describe, expect, it } from "vitest";
import {
  FarmWorld,
  lightLevelAt,
  matureStageOf,
} from "../../src/farming/farm";
import { craft } from "../../src/items/crafting";
import { smeltSingle } from "../../src/items/furnace";

// W7 验收 1 —— 耕地→种植→生长→成熟→收获 全链路确定性
describe("W7 farming full loop (criterion 1)", () => {
  it("till → plant → grow on limited ticks → mature → harvest", () => {
    const farm = new FarmWorld(8, 8, { seed: 42, growthChance: 0.9 });
    // 布置水以保持湿润
    farm.setGround(2, 1, "water");
    // 耕地 dirt→farmland
    expect(farm.till(1, 1)).toBe(true);
    expect(farm.isFarmland(1, 1)).toBe(true);
    expect(farm.till(1, 1)).toBe(false); // 已耕地不可重复翻
    // 种植小麦
    expect(farm.plant(1, 1, "wheat")).toBe(true);
    expect(farm.isPlanted(1, 1, "wheat")).toBe(true);
    expect(farm.stage(1, 1)).toBe(0);

    // 受限 tick 断言推进（白昼光照）
    const before = farm.stage(1, 1);
    for (let t = 0; t < 10; t++) farm.tick(6000);
    expect(farm.stage(1, 1)).toBeGreaterThan(before);

    // 确定性跑满直至成熟
    farm.growUntilMature(6000);
    expect(farm.isMature(1, 1)).toBe(true);
    const drops = farm.harvest(1, 1);
    expect(drops.some((d) => d.id === "wheat")).toBe(true);
    // 收获后作物被清除，耕地仍在
    expect(farm.isPlanted(1, 1)).toBe(false);
    expect(farm.isFarmland(1, 1)).toBe(true);
  });

  it("same seed + same tick sequence is deterministic", () => {
    const run = (): number => {
      const f = new FarmWorld(4, 4, { seed: 7, growthChance: 0.6 });
      f.setGround(0, 1, "water");
      f.till(0, 0);
      f.plant(0, 0, "carrot");
      for (let t = 0; t < 30; t++) f.tick(6000);
      return f.stage(0, 0);
    };
    expect(run()).toBe(run());
  });

  it("tick count is bounded for maturation", () => {
    const f = new FarmWorld(4, 4, { seed: 3, growthChance: 1.0 });
    f.setGround(0, 1, "water");
    f.till(0, 0);
    f.plant(0, 0, "wheat");
    // growthChance=1 → 每 tick 推进 1 阶段（湿+光足）
    const ticks = 30;
    for (let t = 0; t < ticks; t++) f.tick(6000);
    expect(f.isMature(0, 0)).toBe(true);
  });
});

// W7 验收 2 —— 三种作物可种植，生长受时间/光照影响且可复现
describe("W7 three crops + light/time reproducibility (criterion 2)", () => {
  const CROPS = ["wheat", "carrot", "potato"] as const;

  it("all three crops can be planted and mature", () => {
    const f = new FarmWorld(8, 8, { seed: 9, growthChance: 1.0 });
    f.setGround(3, 1, "water");
    CROPS.forEach((crop, i) => {
      f.till(i, 3);
      expect(f.plant(i, 3, crop)).toBe(true);
    });
    for (let t = 0; t < 20; t++) f.tick(6000);
    CROPS.forEach((crop, i) => {
      expect(f.stage(i, 3)).toBe(matureStageOf(crop));
      expect(f.isMature(i, 3)).toBe(true);
    });
  });

  it("growth advances over multiple world ticks (monotonic, reducible)", () => {
    const f = new FarmWorld(8, 8, { seed: 5, growthChance: 0.8 });
    f.setGround(5, 1, "water");
    f.till(5, 5);
    f.plant(5, 5, "wheat");
    const stages: number[] = [];
    for (let t = 0; t < 10; t++) {
      f.tick(6000);
      stages.push(f.stage(5, 5));
    }
    // 阶段随时间推进（受限 tick 内可断言 > 初始 0）
    expect(stages[stages.length - 1]).toBeGreaterThan(0);
    // 光照由时间驱动：白昼更高
    expect(lightLevelAt(6000)).toBeGreaterThan(lightLevelAt(18000));
    expect(lightLevelAt(18000)).toBeLessThan(8); // 夜间光照不足阈值
  });

  it("night time (low light) blocks growth", () => {
    const day = new FarmWorld(4, 4, { seed: 11, growthChance: 1.0 });
    day.setGround(1, 1, "water");
    day.till(1, 0);
    day.plant(1, 0, "potato");
    for (let t = 0; t < 5; t++) day.tick(6000); // 白昼
    expect(day.stage(1, 0)).toBeGreaterThan(0);

    const night = new FarmWorld(4, 4, { seed: 11, growthChance: 1.0 });
    night.setGround(1, 1, "water");
    night.till(1, 0);
    night.plant(1, 0, "potato");
    for (let t = 0; t < 5; t++) night.tick(18000); // 夜晚
    expect(night.stage(1, 0)).toBe(0); // 不生长
  });
});

// W7 验收 3 —— 收获→食物制作复用合成/熔炉链路
describe("W7 harvest → food production via crafting/furnace (criterion 3)", () => {
  it("wheat harvest → craft bread via existing recipe", () => {
    const f = new FarmWorld(8, 8, { seed: 2, growthChance: 1.0 });
    f.setGround(2, 1, "water");
    f.till(2, 2);
    f.plant(2, 2, "wheat");
    f.growUntilMature(6000);
    const drops = f.harvest(2, 2);
    const wheat = drops.find((d) => d.id === "wheat");
    expect(wheat).toBeDefined();
    // 复用 2×2/3×3 合成网格 craft bread（needsTable=true）
    const grid = [
      [wheat!.id, wheat!.id, wheat!.id],
    ];
    const crafted = craft(grid);
    expect(crafted?.recipe.id).toBe("bread");
    expect(crafted?.result).toEqual({ id: "bread", count: 1 });
  });

  it("potato harvest → baked_potato via furnace smelting", () => {
    const f = new FarmWorld(8, 8, { seed: 8, growthChance: 1.0 });
    f.setGround(4, 1, "water");
    f.till(4, 4);
    f.plant(4, 4, "potato");
    f.growUntilMature(6000);
    const drops = f.harvest(4, 4);
    const potato = drops.find((d) => d.id === "potato");
    expect(potato).toBeDefined();
    const baked = smeltSingle("potato");
    expect(baked).toEqual({ id: "baked_potato", count: 1 });
  });
});
