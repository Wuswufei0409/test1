/**
 * 背包/快捷栏实现：堆叠、拆分、交换、满背包处理、序列化。
 *
 * 实现 {@link Inventory} 契约（src/items/types.ts）。
 * 背包布局：9 格快捷栏（0..8）+ 27 格背包（9..35）。
 * 纯逻辑、确定，便于存档/回放测试（对接目标 06）。
 */

import type { Hotbar, Inventory, ItemStack } from "./types";
import { stackLimitOf } from "./registry";

export const HOTBAR_SIZE = 9;
export const BACKPACK_SIZE = 27;
export const INVENTORY_SIZE = HOTBAR_SIZE + BACKPACK_SIZE;

export function emptyStack(): ItemStack {
  return { id: "air", count: 0 };
}

export function isStackEmpty(s: ItemStack): boolean {
  return s.count <= 0 || s.id === "air";
}

function stackLimitFor(id: ItemStack["id"]): number {
  return stackLimitOf(id);
}

/** 具体 Hotbar 实现：9 格 + selected。 */
class PlayerHotbar implements Hotbar {
  constructor(
    readonly slots: ItemStack[],
    readonly size: number,
    public selected: number
  ) {}
  get(index: number): ItemStack {
    if (index < 0 || index >= this.size) return emptyStack();
    return { ...this.slots[index] };
  }
}

/** 可序列化、纯逻辑的玩家背包。 */
export class PlayerInventory implements Inventory {
  readonly hotbar: PlayerHotbar;
  readonly size: number;
  private readonly data: ItemStack[];

  constructor(selected = 0) {
    this.size = INVENTORY_SIZE;
    this.data = new Array(INVENTORY_SIZE).fill(0).map(emptyStack);
    this.hotbar = new PlayerHotbar(this.data, HOTBAR_SIZE, selected);
  }

  get slots(): ReadonlyArray<ItemStack> {
    return this.data;
  }

  get(index: number): ItemStack {
    if (index < 0 || index >= this.size) return emptyStack();
    return { ...this.data[index] };
  }

  /** 尝试放入物品；返回剩余未放入数量（0 = 全部放入）。 */
  add(item: ItemStack): number {
    if (isStackEmpty(item) || item.count <= 0) return 0;
    let remaining = item.count;
    const id = item.id;
    const cap = stackLimitFor(id);
    // 1) 堆叠到已有同 ID 未满槽
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const s = this.data[i];
      if (s.id === id && s.count > 0 && s.count < cap) {
        const take = Math.min(cap - s.count, remaining);
        this.data[i] = { id, count: s.count + take };
        remaining -= take;
      }
    }
    // 2) 放入空槽
    for (let i = 0; i < this.size && remaining > 0; i++) {
      if (this.data[i].count === 0 || this.data[i].id === "air") {
        const take = Math.min(cap, remaining);
        this.data[i] = { id, count: take };
        remaining -= take;
      }
    }
    return remaining;
  }

  /** 检查是否能放下整组（不修改背包）。 */
  canAdd(item: ItemStack): boolean {
    if (isStackEmpty(item) || item.count <= 0) return true;
    const id = item.id;
    const cap = stackLimitFor(id);
    let free = 0;
    for (const s of this.data) {
      if (s.id === id && s.count > 0) free += Math.max(0, cap - s.count);
      else if (s.count === 0 || s.id === "air") free += cap;
    }
    return free >= item.count;
  }

  /** 取出 index 槽（可选数量）；堆叠拆分会保留原槽。 */
  remove(index: number, count?: number): ItemStack {
    if (index < 0 || index >= this.size) return emptyStack();
    const cur = this.data[index];
    if (cur.count === 0) return emptyStack();
    const take = count === undefined ? cur.count : Math.min(count, cur.count);
    this.data[index] = { id: cur.id, count: cur.count - take };
    return { id: cur.id, count: take };
  }

  /** 交换两槽（含拆分支持：先生成快照再交换）。 */
  swap(a: number, b: number): void {
    if (a < 0 || a >= this.size || b < 0 || b >= this.size || a === b) {
      throw new Error("swap index out of range");
    }
    const tmp = this.data[a];
    this.data[a] = this.data[b];
    this.data[b] = tmp;
  }

  /** 拆分一叠：把 index 槽分 count 个到 dst 空槽。 */
  split(index: number, count: number, dst: number): void {
    if (dst < 0 || dst >= this.size) throw new Error("dst out of range");
    if (index === dst) return;
    if (this.data[dst].count !== 0) throw new Error("dst slot not empty");
    const taken = this.remove(index, count);
    this.data[dst] = taken;
  }

  /** 当前选中快捷栏物品。 */
  get selectedItem(): ItemStack {
    return this.hotbar.get(this.hotbar.selected);
  }

  /** 是否装满了指定物品（无任何可放入空间）。 */
  isFull(): boolean {
    return this.data.every((s) => s.count > 0 && s.count >= stackLimitFor(s.id));
  }

  /** 序列化为纯数组（存档）。 */
  toJSON(): ItemStack[] {
    return this.data.map((s) => ({ ...s }));
  }

  /** 从存档恢复（返回新实例）。坏数据安全回退到空背包。 */
  static fromJSON(raw: unknown, selected = 0): PlayerInventory {
    const inv = new PlayerInventory(selected);
    if (!Array.isArray(raw)) return inv;
    for (let i = 0; i < Math.min(raw.length, INVENTORY_SIZE); i++) {
      const r = raw[i] as Partial<ItemStack>;
      if (r && typeof r.id === "string" && typeof r.count === "number") {
        const n = Math.max(0, Math.floor(r.count));
        inv.data[i] = { id: r.id as ItemStack["id"], count: n };
      }
    }
    return inv;
  }
}

/** 便捷：9 格纯数据快捷栏查找（供 HUD）。 */
export function hotbarToArray(size = HOTBAR_SIZE): ItemStack[] {
  return new Array(size).fill(0).map(emptyStack);
}
