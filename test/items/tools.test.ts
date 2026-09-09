import { describe, expect, it } from "vitest";
import { mineBlock, mineTime, oreDrop } from "../../src/items/tools";
import type { HeldTool } from "../../src/items/tools";

describe("W5 mining speed / durability / ore drops (criterion 08)", () => {
  it("different materials dig at different speeds (hardness)", () => {
    // 空手：泥土比石头快（硬度低）
    expect(mineTime("dirt", "hand")).toBeLessThan(mineTime("stone", "hand"));
    expect(mineTime("sand", "hand")).toBeLessThan(mineTime("stone", "hand"));
  });

  it("higher-tier tool digs same block faster", () => {
    // 石镐 > 木镐 > 空手 挖石头
    expect(mineTime("stone", "iron_pickaxe")).toBeLessThan(mineTime("stone", "stone_pickaxe"));
    expect(mineTime("stone", "stone_pickaxe")).toBeLessThan(mineTime("stone", "wooden_pickaxe"));
    expect(mineTime("stone", "wooden_pickaxe")).toBeLessThan(mineTime("stone", "hand"));
  });

  it("stone mineable only by pickaxe of sufficient tier", () => {
    const wrong = mineBlock({ block: "stone", tool: "shovel" as HeldTool });
    expect(wrong.harvestable).toBe(false);
    expect(wrong.drops).toHaveLength(0);
    // 错误工具速度 ×3
    expect(wrong.time).toBeCloseTo(1.5 * 3, 5);

    const right = mineBlock({ block: "stone", tool: "stone_pickaxe", toolDurability: 131 });
    expect(right.harvestable).toBe(true);
    expect(right.drops).toContainEqual({ id: "cobblestone", count: 1 });
    expect(right.time).toBeCloseTo(1.5 / 4, 5);
  });

  it("bedrock is unbreakable", () => {
    const r = mineBlock({ block: "bedrock", tool: "diamond_pickaxe", toolDurability: 1561 });
    expect(r.time).toBe(Infinity);
    expect(r.harvestable).toBe(false);
  });

  it("ore mining drops material (coal_ore→coal, iron_ore→raw_iron)", () => {
    expect(oreDrop("coal_ore")).toBe("coal");
    expect(oreDrop("iron_ore")).toBe("raw_iron");
    expect(oreDrop("gold_ore")).toBe("raw_gold");
    expect(oreDrop("diamond_ore")).toBe("diamond");
    const r = mineBlock({ block: "iron_ore", tool: "stone_pickaxe", toolDurability: 131 });
    expect(r.harvestable).toBe(true);
    expect(r.drops).toContainEqual({ id: "raw_iron", count: 1 });
  });

  it("grass block drops dirt when shoveled", () => {
    const r = mineBlock({ block: "grass", tool: "wooden_shovel", toolDurability: 59 });
    expect(r.harvestable).toBe(true);
    expect(r.drops).toContainEqual({ id: "dirt", count: 1 });
  });

  it("tool consumes durability and breaks at zero", () => {
    const r1 = mineBlock({ block: "dirt", tool: "wooden_shovel", toolDurability: 1 });
    expect(r1.durabilityUsed).toBe(1);
    expect(r1.toolBroken).toBe(true);
    const r2 = mineBlock({ block: "dirt", tool: "wooden_shovel", toolDurability: 5 });
    expect(r2.toolBroken).toBe(false);
  });

  it("hand punching a log yields wood (chain start)", () => {
    const r = mineBlock({ block: "log_oak", tool: "hand" });
    expect(r.harvestable).toBe(true);
    expect(r.drops).toContainEqual({ id: "log_oak", count: 1 });
  });
});
