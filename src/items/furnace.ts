/**
 * 熔炉冶炼系统：配置化冶炼配方 + 燃料 + 进度推进。
 *
 * 对接目标 08（矿石冶炼）与 07（代表性物品）。
 * 纯逻辑、确定，便于自动测试完整升级链。
 */

import type { ItemId, ItemStack } from "./types";
import { itemDef } from "./registry";

/** 冶炼配方。 */
export interface SmeltRecipe {
  readonly id: string;
  readonly input: ItemId;
  readonly output: ItemStack;
  /** 单次冶炼所需 tick 数。 */
  readonly cookTicks: number;
}

/** 燃料燃烧时长（tick），一次可支撑的冶炼次数 = burnTicks / cookTicks。 */
export interface FuelDef {
  readonly id: ItemId;
  readonly burnTicks: number;
}

const T = 200; // 一次冶炼默认 200 tick（≈10s）

/** 冶炼配方表（配置驱动）。 */
export const SMELT_RECIPES: readonly SmeltRecipe[] = [
  { id: "iron_ingot", input: "iron_ore", output: { id: "iron_ingot", count: 1 }, cookTicks: T },
  { id: "iron_ingot_raw", input: "raw_iron", output: { id: "iron_ingot", count: 1 }, cookTicks: T },
  { id: "gold_ingot", input: "gold_ore", output: { id: "gold_ingot", count: 1 }, cookTicks: T },
  { id: "gold_ingot_raw", input: "raw_gold", output: { id: "gold_ingot", count: 1 }, cookTicks: T },
  { id: "stone", input: "cobblestone", output: { id: "stone", count: 1 }, cookTicks: T },
  { id: "glass", input: "sand", output: { id: "glass", count: 1 }, cookTicks: T },
  { id: "charcoal", input: "log_oak", output: { id: "charcoal", count: 1 }, cookTicks: T },
  { id: "charcoal_spruce", input: "log_spruce", output: { id: "charcoal", count: 1 }, cookTicks: T },
  { id: "cooked_porkchop", input: "raw_porkchop", output: { id: "cooked_porkchop", count: 1 }, cookTicks: T },
  { id: "baked_potato", input: "potato", output: { id: "baked_potato", count: 1 }, cookTicks: T },
];

/** 燃料表。 */
export const FUELS: readonly FuelDef[] = [
  { id: "coal", burnTicks: Math.floor(T * 8) },
  { id: "charcoal", burnTicks: Math.floor(T * 8) },
  { id: "log_oak", burnTicks: Math.floor(T * 1.5) },
  { id: "plank_oak", burnTicks: Math.floor(T * 1.5) },
  { id: "stick", burnTicks: Math.floor(T / 10) },
];

/** 查找冶炼配方；不存在返回 null。 */
export function findSmelt(input: ItemId): SmeltRecipe | null {
  return SMELT_RECIPES.find((r) => r.input === input) ?? null;
}

/** 查找燃料；不存在返回 null。 */
export function findFuel(id: ItemId): FuelDef | null {
  return FUELS.find((f) => f.id === id) ?? null;
}

/** 熔炉运行时状态（可变，供模拟）。 */
export interface FurnaceState {
  input: ItemStack;
  fuel: ItemStack;
  output: ItemStack;
  /** 当前累计燃烧剩余 tick。 */
  burnRemaining: number;
  /** 当前冶炼进度 tick。 */
  progress: number;
  /** 当前正在冶炼的配方。 */
  activeRecipe: SmeltRecipe | null;
}

export function createFurnace(): FurnaceState {
  return {
    input: { id: "air", count: 0 },
    fuel: { id: "air", count: 0 },
    output: { id: "air", count: 0 },
    burnRemaining: 0,
    progress: 0,
    activeRecipe: null,
  };
}

/** 填入待冶炼物。 */
export function insertInput(f: FurnaceState, item: ItemStack): void {
  if (item.id === "air" || item.count <= 0) return;
  // 若在烧且非同一 item 则忽略；否则替换输入，重置进度、激活配方
  if (f.activeRecipe && f.activeRecipe.input !== item.id) return;
  f.input = { ...item };
  const recipe = findSmelt(item.id);
  f.activeRecipe = recipe;
  f.progress = 0;
}

/** 填入燃料。 */
export function insertFuel(f: FurnaceState, item: ItemStack): void {
  if (item.id === "air" || item.count <= 0) return;
  const fd = findFuel(item.id);
  if (!fd) return;
  f.fuel = { id: item.id, count: f.fuel.count + item.count };
}

/**
 * 推进一次 tick。返回本次 tick 是否产出（翻倍到输出槽）。
 */
export function tickFurnace(f: FurnaceState): boolean {
  if (!f.activeRecipe || f.input.count <= 0) return false;
  // 需要燃料
  if (f.burnRemaining <= 0) {
    if (f.fuel.count <= 0) return false;
    const fd = findFuel(f.fuel.id)!;
    f.burnRemaining += fd.burnTicks;
    f.fuel = { id: f.fuel.id, count: f.fuel.count - 1 };
  }
  f.burnRemaining -= 1;
  f.progress += 1;
  if (f.progress >= f.activeRecipe.cookTicks) {
    // 产出
    const out = f.activeRecipe.output;
    if (f.output.id !== "air" && f.output.id !== out.id) return true;
    f.output = {
      id: out.id,
      count: f.output.count + out.count,
    };
    f.input = { id: f.input.id, count: f.input.count - 1 };
    if (f.input.count <= 0) {
      f.input = { id: "air", count: 0 };
      f.activeRecipe = null;
      f.progress = 0;
    } else {
      f.activeRecipe = findSmelt(f.input.id);
      f.progress = 0;
    }
    return true;
  }
  return false;
}

/** 便捷低阶：直接显式冶炼单个物品（供测试/简单流程）。 */
export function smeltSingle(input: ItemId): ItemStack | null {
  const recipe = findSmelt(input);
  if (!recipe) return null;
  const f = createFurnace();
  insertInput(f, { id: input, count: 1 });
  insertFuel(f, { id: "coal", count: 1 });
  let produced = false;
  for (let i = 0; i < recipe.cookTicks + 2 && !produced; i++) {
    produced = tickFurnace(f);
  }
  if (!produced) return null;
  return { ...f.output };
}

/** 物品显示名。 */
export function itemName(id: ItemId): string {
  return itemDef(id).name;
}
