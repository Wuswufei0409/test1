/**
 * 农耕模块契约：作物、成果掉落、可配置参数。
 *
 * 约定：
 * - 作物以稳定字符串标识；成果为可利用合成/熔炉链路的物品（对接 items 模块）。
 * - 全部纯逻辑、确定性：给定 seed 与相同 tick 序列，永远产生相同生长结果。
 * - 生长受「光照（由世界时间驱动的天空亮度）」与「耕地湿度（邻接水）」影响。
 */

import type { ItemStack } from "../items/types";

/** 支持种植的作物 ID（W7 验收：小麦/胡萝卜/马铃薯）。 */
export type CropId = "wheat" | "carrot" | "potato";

/** 地块状态：落地方块（复用 BlockId 子集）+ 其上作物（含生长阶段）。 */
export interface FarmCell {
  /** 落地方块：dirt / grass / farmland / water / air 等。 */
  ground: string;
  /** 该格种植作物；null = 未种植。 */
  crop: PlantedCrop | null;
}

/** 已种植的一株作物（可变生长阶段，纯逻辑推进）。 */
export interface PlantedCrop {
  readonly crop: CropId;
  /** 生长阶段 0..stages-1；stages-1 为成熟。 */
  stage: number;
  /** 是否已灌溉/湿度充足（由 farm.tick 依据邻接水维护）。 */
  hydrated: boolean;
}

/** 作物的可种植与收获定义。 */
export interface CropDef {
  readonly id: CropId;
  readonly name: string;
  /** 生长阶段总数（0..stages-1 为成熟）。 */
  readonly stages: number;
  /** 最小光照等级（0..15）才能生长（对接昼夜循环）。 */
  readonly lightRequired: number;
  /** 播种所需的种子物品（carrot/potato 直接以其本体播种）。 */
  readonly seed: ItemStack;
  /** 成熟收获的可变数量区间 [min,max]（确定性 RNG 抽取）。 */
  readonly dropRange: { readonly min: number; readonly max: number };
  /** 收获附带的固定物品（如小麦种子）。 */
  readonly bonusDrops: readonly ItemStack[];
}

/** 农耕参数（构造函数可覆盖，便于受限 tick 的确定性测试）。 */
export interface FarmOptions {
  /** 确定性种子。默认 0。 */
  seed?: number;
  /** 每 tick 每阶段推进的基础概率（0..1）。默认 0.35。 */
  growthChance?: number;
  /** 未灌溉（干燥）时的生长概率倍率。默认 0.5。 */
  dryPenalty?: number;
}

/** fallback 全量作物表（配置驱动，新增作物只需加一行）。 */
export const CROPS: Readonly<Record<CropId, CropDef>> = {
  wheat: {
    id: "wheat",
    name: "小麦",
    stages: 8,
    lightRequired: 8,
    seed: { id: "wheat_seeds", count: 1 },
    dropRange: { min: 1, max: 1 },
    bonusDrops: [{ id: "wheat_seeds", count: 1 }],
  },
  carrot: {
    id: "carrot",
    name: "胡萝卜",
    stages: 8,
    lightRequired: 8,
    seed: { id: "carrot", count: 1 },
    dropRange: { min: 2, max: 4 },
    bonusDrops: [],
  },
  potato: {
    id: "potato",
    name: "马铃薯",
    stages: 8,
    lightRequired: 8,
    seed: { id: "potato", count: 1 },
    dropRange: { min: 2, max: 4 },
    bonusDrops: [],
  },
};

/** 作物定义查找（未知回退 null）。 */
export function cropDef(id: CropId): CropDef | null {
  return CROPS[id] ?? null;
}
