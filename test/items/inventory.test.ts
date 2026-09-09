import { describe, expect, it } from "vitest";
import { PlayerInventory } from "../../src/items/inventory";
import type { ItemStack } from "../../src/items/types";

function stack(id: ItemStack["id"], count: number): ItemStack {
  return { id, count };
}

describe("W5 inventory/hotbar (criterion 06)", () => {
  it("stacks items up to limit in existing slots", () => {
    const inv = new PlayerInventory();
    expect(inv.add(stack("dirt", 40))).toBe(0);
    // 40+30=70 > 64 → 余 30 进入第二个空槽，全部放下
    expect(inv.add(stack("dirt", 30))).toBe(0);
    expect(inv.get(0)).toEqual(stack("dirt", 64));
    expect(inv.get(1)).toEqual(stack("dirt", 6));
    // 再放 10 → slot1 全部吸收（6→16），remainder=0
    expect(inv.add(stack("dirt", 10))).toBe(0);
    expect(inv.get(0)).toEqual(stack("dirt", 64));
    expect(inv.get(1)).toEqual(stack("dirt", 16));
  });

  it("returns remainder when inventory is full", () => {
    const inv = new PlayerInventory();
    // 填满 36 个槽为 cobblestone x64
    for (let i = 0; i < 36; i++) inv.add(stack("cobblestone", 64));
    expect(inv.isFull()).toBe(true);
    expect(inv.add(stack("cobblestone", 5))).toBe(5);
  });

  it("removes and splits stacks", () => {
    const inv = new PlayerInventory();
    inv.add(stack("plank_oak", 20));
    const taken = inv.remove(0, 5);
    expect(taken).toEqual(stack("plank_oak", 5));
    expect(inv.get(0)).toEqual(stack("plank_oak", 15));
  });

  it("split moves part of a stack to an empty slot", () => {
    const inv = new PlayerInventory();
    inv.add(stack("dirt", 10));
    inv.split(0, 4, 1);
    expect(inv.get(0)).toEqual(stack("dirt", 6));
    expect(inv.get(1)).toEqual(stack("dirt", 4));
  });

  it("canAdd respects free capacity without mutating", () => {
    const inv = new PlayerInventory();
    expect(inv.canAdd(stack("dirt", 1))).toBe(true);
    for (let i = 0; i < 36; i++) inv.add(stack("cobblestone", 64));
    expect(inv.canAdd(stack("cobblestone", 1))).toBe(false);
  });

  it("swaps two slots", () => {
    const inv = new PlayerInventory();
    inv.add(stack("dirt", 1));
    inv.add(stack("sand", 2));
    expect(inv.get(0)).toEqual(stack("dirt", 1));
    expect(inv.get(1)).toEqual(stack("sand", 2));
    inv.swap(0, 1);
    expect(inv.get(0)).toEqual(stack("sand", 2));
    expect(inv.get(1)).toEqual(stack("dirt", 1));
  });

  it("hotbar has 9 slots and current-item selection", () => {
    const inv = new PlayerInventory(0); // 选中第 1 格
    expect(inv.hotbar.size).toBe(9);
    inv.add(stack("torch", 3));
    // torch 落入第一个空闲槽（快捷栏 0）
    expect(inv.get(0)).toEqual(stack("torch", 3));
    // 改变选中槽后 current item 跟随变化
    inv.hotbar.selected = 1;
    expect(inv.selectedItem).toEqual(stack("air", 0));
    inv.hotbar.selected = 0;
    expect(inv.selectedItem).toEqual(stack("torch", 3));
    // HUD 所需：当前物品显示
    expect(inv.selectedItem.id).toBe("torch");
    expect(inv.selectedItem.count).toBe(3);
  });

  it("serialize/deserialize preserves counts (refresh & reload consistency)", () => {
    const inv = new PlayerInventory();
    inv.add(stack("iron_ingot", 12));
    inv.add(stack("log_oak", 7));
    inv.hotbar.selected = 3;
    const raw = inv.toJSON();
    const restored = PlayerInventory.fromJSON(raw, 3);
    expect(restored.hotbar.selected).toBe(3);
    expect(restored.get(0)).toEqual(stack("iron_ingot", 12));
    expect(restored.get(1)).toEqual(stack("log_oak", 7));
    // 与原始序列化一致
    expect(restored.toJSON()).toEqual(raw);
  });

  it("death drop clears inventory", () => {
    const inv = new PlayerInventory();
    inv.add(stack("diamond", 2));
    // 死亡掉落：取走全部并置空
    expect(inv.toJSON().some((s) => s.count > 0)).toBe(true);
    for (let i = 0; i < inv.size; i++) inv.remove(i);
    expect(inv.toJSON().every((s) => s.count === 0)).toBe(true);
  });
});
