/**
 * 基础食物：配置化定义与恢复逻辑（对接目标 09 的“基础食物”）。
 * 纯函数、确定性。食物通过 {@link eat} 恢复饥饿值与饱和度。
 */

import type { Hunger } from "./types";

/** 食物 ID（稳定字符串）。 */
export type FoodId =
  | "apple"
  | "bread"
  | "cooked_porkchop"
  | "raw_porkchop"
  | "carrot"
  | "potato";

/** 食物配置：恢复的饥饿值（点）与饱和度（点，高于饥饿值时作为缓冲）。 */
export interface FoodDef {
  readonly id: FoodId;
  readonly name: string;
  /** 恢复的饥饿点数。 */
  readonly hungerRestore: number;
  /** 恢复的饱和度点数（暂作用于 saturation 字段）。 */
  readonly saturationRestore: number;
}

/** 配置化食物表（验收 07/09 需要的基础食物代表）。 */
export const FOODS: Readonly<Record<FoodId, FoodDef>> = {
  apple: { id: "apple", name: "苹果", hungerRestore: 4, saturationRestore: 4 },
  bread: { id: "bread", name: "面包", hungerRestore: 5, saturationRestore: 6 },
  cooked_porkchop: {
    id: "cooked_porkchop",
    name: "熟猪排",
    hungerRestore: 8,
    saturationRestore: 12.8,
  },
  raw_porkchop: {
    id: "raw_porkchop",
    name: "生猪排",
    hungerRestore: 3,
    saturationRestore: 1.8,
  },
  carrot: { id: "carrot", name: "胡萝卜", hungerRestore: 3, saturationRestore: 3.6 },
  potato: { id: "potato", name: "马铃薯", hungerRestore: 1, saturationRestore: 0.6 },
};

/**
 * 进食恢复：hunger.value 增加（不超过 max），饱和度增加。
 * 规则：恢复后 hunger 仍钳制在 [0, max]；饱和度最多与 hunger.value 持平（贴近 MC 机制）。
 * 纯函数，返回新 Hunger。
 */
export function eat(hunger: Hunger, food: FoodId): Hunger {
  const def = FOODS[food];
  if (!def) return hunger;
  const value = Math.min(hunger.max, hunger.value + def.hungerRestore);
  // 饱和度总体上等于被恢复的饥饿，且不超出当前 hunger 值（防溢出）。
  const saturation = Math.min(value, hunger.saturation + def.saturationRestore);
  return { value, max: hunger.max, saturation };
}

/** 食物名查找（UI/证据用）。 */
export function foodName(food: FoodId): string {
  return FOODS[food].name;
}
