import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  BLOCK_IDS,
  REGISTERED_BLOCK_COUNT,
  SOLID_BLOCK_IDS,
  blockMeta,
  canHarvest,
} from "../../src/blocks/registry";
import type { BlockId } from "../../src/world/types";

describe("block registry (W1)", () => {
  it("registers 30+ distinct blocks", () => {
    expect(REGISTERED_BLOCK_COUNT).toBeGreaterThanOrEqual(30);
    // 无重复 ID
    expect(new Set(BLOCK_IDS).size).toBe(BLOCK_IDS.length);
  });

  it("every block has name/hardness/tool/drop/solid/liquid metadata", () => {
    for (const id of BLOCK_IDS) {
      const m = BLOCKS[id];
      expect(m.id).toBe(id);
      expect(typeof m.name).toBe("string");
      expect(m.name.length).toBeGreaterThan(0);
      expect(Number.isFinite(m.hardness)).toBe(true);
      expect(["pickaxe", "axe", "shovel", "sword", "hoe", "none"]).toContain(m.tool);
      expect(blockMeta(m.drop).id).toBe(m.drop); // 掉落方块已注册
      expect(typeof m.solid).toBe("boolean");
      expect(typeof m.liquid).toBe("boolean");
      expect(typeof m.opaque).toBe("boolean");
      expect(typeof m.texture).toBe("string");
      expect(m.texture.endsWith(".png")).toBe(true);
    }
  });

  it("solid blocks are disjoint from liquid", () => {
    for (const id of BLOCK_IDS) {
      const m = BLOCKS[id];
      if (m.liquid) expect(m.solid).toBe(false);
    }
    expect(SOLID_BLOCK_IDS.length).toBeGreaterThan(20);
  });

  it("stone drops cobblestone; grass drops dirt", () => {
    expect(BLOCKS.stone.drop).toBe("cobblestone");
    expect(BLOCKS.cobblestone.drop).toBe("cobblestone");
    expect(BLOCKS.grass.drop).toBe("dirt");
  });

  it("harvest gating: stone needs pickaxe tier>=1", () => {
    expect(canHarvest("stone", "pickaxe", 1)).toBe(true);
    expect(canHarvest("stone", "pickaxe", 0)).toBe(false);
    expect(canHarvest("stone", "shovel", 1)).toBe(false);
    expect(canHarvest("dirt", "shovel", 0)).toBe(true);
  });

  it("bedrock is unbreakable", () => {
    expect(canHarvest("bedrock", "pickaxe", 4)).toBe(false);
    expect(BLOCKS.bedrock.hardness).toBe(-1);
  });

  it("collect→place loop: gathered drop is a placeable registered block", () => {
    // 采集 stone -> cobblestone；cobblestone 可放置（实心且已注册）
    const dropId: BlockId = BLOCKS.stone.drop;
    expect(BLOCKS[dropId].solid).toBe(true);
    expect(BLOCK_IDS).toContain(dropId);
  });
});
