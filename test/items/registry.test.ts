import { describe, expect, it } from "vitest";
import { ITEMS, ITEM_IDS, itemDef, isDurable } from "../../src/items/registry";
import { HOTBAR_SIZE, INVENTORY_SIZE } from "../../src/items/inventory";

describe("W5 item registry", () => {
  it("registers a full item set", () => {
    expect(ITEM_IDS.length).toBeGreaterThan(50);
    expect(new Set(ITEM_IDS).size).toBe(ITEM_IDS.length);
  });

  it("every item has name/kind/stackLimit", () => {
    for (const id of ITEM_IDS) {
      const d = ITEMS[id];
      expect(d.id).toBe(id);
      expect(d.name.length).toBeGreaterThan(0);
      if (id !== "air") expect(d.stackLimit).toBeGreaterThan(0);
      expect(["material", "block", "tool", "weapon", "food", "crafted"]).toContain(d.kind);
    }
  });

  it("tools/weapons have durability and tier, others not durable", () => {
    for (const id of ITEM_IDS) {
      const d = itemDef(id);
      if (d.kind === "tool" || d.kind === "weapon") {
        expect(d.durability).toBeGreaterThan(0);
        expect(d.tier).toBeGreaterThan(0);
        expect(isDurable(id)).toBe(true);
      } else {
        expect(isDurable(id)).toBe(false);
      }
    }
  });

  it("iron pickaxe out-tiers stone out-tiers wood", () => {
    expect(ITEMS.wooden_pickaxe.tier).toBe(1);
    expect(ITEMS.stone_pickaxe.tier).toBe(2);
    expect(ITEMS.iron_pickaxe.tier).toBe(3);
    expect(ITEMS.diamond_pickaxe.tier).toBe(4);
    expect(ITEMS.iron_pickaxe.digMultiplier).toBeGreaterThan(ITEMS.stone_pickaxe.digMultiplier);
    expect(ITEMS.stone_pickaxe.digMultiplier).toBeGreaterThan(ITEMS.wooden_pickaxe.digMultiplier);
  });

  it("hotbar is 9 slots and inventory 36 total", () => {
    expect(HOTBAR_SIZE).toBe(9);
    expect(INVENTORY_SIZE).toBe(36);
  });
});
