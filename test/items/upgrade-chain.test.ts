import { describe, expect, it } from "vitest";
import { PlayerInventory } from "../../src/items/inventory";
import { craft } from "../../src/items/crafting";
import { mineBlock } from "../../src/items/tools";
import { smeltSingle } from "../../src/items/furnace";
import type { CraftGrid } from "../../src/items/crafting";
import type { ItemId } from "../../src/items/types";

/** 从背包取 1 个指定物品（用于消耗原料）。 */
function takeOne(inv: PlayerInventory, id: ItemId): void {
  for (let i = 0; i < inv.size; i++) {
    if (inv.get(i).id === id && inv.get(i).count >= 1) {
      inv.remove(i, 1);
      return;
    }
  }
  throw new Error(`missing ${id} in inventory`);
}

/** 网格合成：消耗网格原料 → 加入产物。 */
function craftGrid(inv: PlayerInventory, grid: CraftGrid): void {
  const r = craft(grid);
  if (!r) throw new Error("no recipe matched");
  for (const row of grid) for (const id of row) if (id !== "air") takeOne(inv, id);
  expect(inv.add(r.result)).toBe(0);
}

function count(inv: PlayerInventory, id: ItemId): number {
  let n = 0;
  for (let i = 0; i < inv.size; i++) if (inv.get(i).id === id) n += inv.get(i).count;
  return n;
}

const P: ItemId = "plank_oak";
const S: ItemId = "stick";
const COB: ItemId = "cobblestone";
const IRON: ItemId = "iron_ingot";

describe("W5 full upgrade chain wood → stone → iron (criterion 08)", () => {
  it("auto-verifies the complete progression", () => {
    const inv = new PlayerInventory();

    // 1) 徒手撸 4 棵橡木原木
    for (let i = 0; i < 4; i++) {
      const r = mineBlock({ block: "log_oak", tool: "hand" });
      expect(r.harvestable).toBe(true);
      expect(r.drops[0]).toEqual({ id: "log_oak", count: 1 });
      expect(inv.add({ id: "log_oak", count: 1 })).toBe(0);
    }
    expect(count(inv, "log_oak")).toBe(4);

    // 2) 原木 → 木板
    for (let i = 0; i < 4; i++) craftGrid(inv, [["log_oak"]]);
    expect(count(inv, "plank_oak")).toBe(16);

    // 3) 木板 → 木棍（2 木板 → 4 木棍）
    for (let i = 0; i < 2; i++) craftGrid(inv, [[P], [P]]);
    expect(count(inv, "stick")).toBe(8);

    // 4) 木板 → 工作台
    craftGrid(inv, [[P, P], [P, P]]);
    expect(count(inv, "crafting_table")).toBe(1);

    // 5) 3 木板 + 2 木棍 → 木镐
    craftGrid(inv, [[P, P, P], ["air", S, "air"], ["air", S, "air"]]);
    expect(count(inv, "wooden_pickaxe")).toBe(1);

    // 6) 木镐挖石头 → 圆石
    const stoneMine = mineBlock({ block: "stone", tool: "wooden_pickaxe", toolDurability: 59 });
    expect(stoneMine.harvestable).toBe(true);
    expect(stoneMine.drops[0]).toEqual({ id: "cobblestone", count: 1 });
    inv.add(stoneMine.drops[0]);

    // 7) 补圆石 → 熔炉（8 圆石）+ 石镐（3 圆石 + 2 木棍）
    for (let i = 0; i < 11; i++) inv.add({ id: "cobblestone", count: 1 });
    craftGrid(inv, [[COB, COB, COB], [COB, "air", COB], [COB, COB, COB]]); // 熔炉
    craftGrid(inv, [[COB, COB, COB], ["air", S, "air"], ["air", S, "air"]]); // 石镐
    expect(count(inv, "furnace")).toBe(1);
    expect(count(inv, "stone_pickaxe")).toBe(1);

    // 8) 石镐挖铁矿石 → 粗铁
    const ironMine = mineBlock({ block: "iron_ore", tool: "stone_pickaxe", toolDurability: 131 });
    expect(ironMine.harvestable).toBe(true);
    expect(ironMine.drops[0]).toEqual({ id: "raw_iron", count: 1 });

    // 9) 熔炉冶炼粗铁 → 铁锭（共 3）
    for (let i = 0; i < 3; i++) {
      const ingot = smeltSingle("raw_iron");
      expect(ingot).toEqual({ id: "iron_ingot", count: 1 });
      expect(inv.add({ id: "iron_ingot", count: 1 })).toBe(0);
    }
    expect(count(inv, "iron_ingot")).toBe(3);

    // 10) 3 铁锭 + 2 木棍 → 铁镐（工具等级升级完成）
    craftGrid(inv, [[IRON, IRON, IRON], ["air", S, "air"], ["air", S, "air"]]);
    expect(count(inv, "iron_pickaxe")).toBe(1);

    // 铁镐比石镐更快挖石头
    const fast = mineBlock({ block: "stone", tool: "iron_pickaxe", toolDurability: 250 });
    const slow = mineBlock({ block: "stone", tool: "stone_pickaxe", toolDurability: 131 });
    expect(fast.time).toBeLessThan(slow.time);
  });
});
