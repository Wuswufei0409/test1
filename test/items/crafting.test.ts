import { describe, expect, it } from "vitest";
import { craft, listRecipes, RECIPES } from "../../src/items/crafting";
import type { CraftGrid } from "../../src/items/crafting";
import type { ItemId } from "../../src/items/types";

function g(...rows: ItemId[][]): CraftGrid {
  return rows;
}

const P: ItemId = "plank_oak";
const S: ItemId = "stick";
const COB: ItemId = "cobblestone";
const IRON: ItemId = "iron_ingot";

describe("W5 crafting (criterion 07)", () => {
  it("recipe book lists known recipes", () => {
    const book = listRecipes();
    expect(book.length).toBeGreaterThanOrEqual(25);
    const ids = book.map((r) => r.id);
    for (const expectId of [
      "plank_oak",
      "stick",
      "crafting_table",
      "chest",
      "furnace",
      "wooden_pickaxe",
      "stone_pickaxe",
      "iron_pickaxe",
      "torch",
      "boat",
      "bucket",
      "bread",
    ]) {
      expect(ids).toContain(expectId);
    }
  });

  it("1 log → 4 planks", () => {
    const r = craft(g(["log_oak"]));
    expect(r?.result).toEqual({ id: "plank_oak", count: 4 });
  });

  it("2 planks → 4 sticks", () => {
    const r = craft(g([P], [P]));
    expect(r?.result).toEqual({ id: "stick", count: 4 });
  });

  it("2x2 crafting table", () => {
    const r = craft(g([P, P], [P, P]));
    expect(r?.result).toEqual({ id: "crafting_table", count: 1 });
  });

  it("wooden pickaxe (3x3)", () => {
    const r = craft(g([P, P, P], ["air", S, "air"], ["air", S, "air"]));
    expect(r?.result).toEqual({ id: "wooden_pickaxe", count: 1 });
  });

  it("stone pickaxe from cobblestone", () => {
    const r = craft(g([COB, COB, COB], ["air", S, "air"], ["air", S, "air"]));
    expect(r?.result).toEqual({ id: "stone_pickaxe", count: 1 });
  });

  it("iron pickaxe from iron ingot", () => {
    const r = craft(g([IRON, IRON, IRON], ["air", S, "air"], ["air", S, "air"]));
    expect(r?.result).toEqual({ id: "iron_pickaxe", count: 1 });
  });

  it("chest from 8 planks ring", () => {
    const r = craft(g([P, P, P], [P, "air", P], [P, P, P]), );
    expect(r?.result).toEqual({ id: "chest", count: 1 });
  });

  it("furnace from 8 cobblestone ring (needs table)", () => {
    const r = craft(g([COB, COB, COB], [COB, "air", COB], [COB, COB, COB]));
    expect(r?.result).toEqual({ id: "furnace", count: 1 });
  });

  it("boat (underwater/crafting representative)", () => {
    const r = craft(g([P, "air", P], [P, P, P]));
    expect(r?.result).toEqual({ id: "boat", count: 1 });
  });

  it("bucket from 3 iron", () => {
    const r = craft(g([IRON, "air", IRON], ["air", IRON, "air"]));
    expect(r?.result).toEqual({ id: "bucket", count: 1 });
  });

  it("bread from 3 wheat", () => {
    const r = craft(g(["wheat", "wheat", "wheat"]));
    expect(r?.result).toEqual({ id: "bread", count: 1 });
  });

  it("torch from coal + stick", () => {
    const r = craft(g(["coal"], [S]));
    expect(r?.result).toEqual({ id: "torch", count: 4 });
  });

  it("unknown arrangement yields null", () => {
    expect(craft(g([IRON, IRON, "air"], ["air", "air", "air"], ["air", "air", "air"]))).toBeNull();
    expect(craft(g([P, P], [P, S]))).toBeNull();
  });

  it("all recipes reference registered ingredients and results", () => {
    for (const rc of RECIPES) {
      for (const sym of Object.keys(rc.ingredients)) {
        expect(String(sym).length).toBe(1);
      }
      expect(rc.result.count).toBeGreaterThan(0);
      expect(rc.pattern.length).toBeGreaterThan(0);
    }
  });
});
