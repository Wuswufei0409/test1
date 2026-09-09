import { describe, expect, it } from "vitest";
import {
  createFurnace,
  findFuel,
  findSmelt,
  insertFuel,
  insertInput,
  smeltSingle,
  tickFurnace,
} from "../../src/items/furnace";

describe("W5 furnace smelting (criterion 08)", () => {
  it("recipes cover ore/oil/stone/wood/food smelting", () => {
    expect(findSmelt("iron_ore")?.output).toEqual({ id: "iron_ingot", count: 1 });
    expect(findSmelt("raw_iron")?.output).toEqual({ id: "iron_ingot", count: 1 });
    expect(findSmelt("gold_ore")?.output).toEqual({ id: "gold_ingot", count: 1 });
    expect(findSmelt("cobblestone")?.output).toEqual({ id: "stone", count: 1 });
    expect(findSmelt("sand")?.output).toEqual({ id: "glass", count: 1 });
    expect(findSmelt("log_oak")?.output).toEqual({ id: "charcoal", count: 1 });
    expect(findSmelt("raw_porkchop")?.output).toEqual({ id: "cooked_porkchop", count: 1 });
  });

  it("smeltSingle iron_ore → iron_ingot via furnace", () => {
    const out = smeltSingle("iron_ore");
    expect(out).toEqual({ id: "iron_ingot", count: 1 });
  });

  it("tick furnace consumes fuel and produces output", () => {
    const f = createFurnace();
    insertInput(f, { id: "iron_ore", count: 1 });
    insertFuel(f, { id: "coal", count: 1 });
    let produced = false;
    for (let i = 0; i < 300 && !produced; i++) produced = tickFurnace(f);
    expect(produced).toBe(true);
    expect(f.output).toEqual({ id: "iron_ingot", count: 1 });
    expect(f.fuel.count).toBeLessThan(1); // 燃料被消耗
    expect(f.input.count).toBe(0);
  });

  it("coal is a valid fuel", () => {
    expect(findFuel("coal")?.burnTicks).toBeGreaterThan(0);
    expect(findFuel("stick")?.burnTicks).toBeGreaterThan(0);
    expect(findFuel("diamond")).toBeNull();
  });
});
