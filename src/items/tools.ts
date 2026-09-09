/**
 * 工具等级升级 / 挖掘 / 耐久 / 矿石掉落（对接目标 08）。
 *
 * 复用 W1 的 blocks/registry（硬度/工具类别/等级）与 items/registry（工具倍率/耐久）。
 * 规则：
 * - 不同材料挖掘速度不同（硬度 / 工具倍率）。
 * - 错误工具：速度 ×3 且不掉落（须用正确类别 + 满足等级）。
 * - 工具/武器每次成功使用消耗 1 耐久；耐久归零则损坏丢弃。
 * - 矿石破坏产出对应物品；石→圆石等由 W1 drop 定义。
 */

import type { BlockId } from "../world/types";
import { blockMeta, canHarvest } from "../blocks/registry";
import type { ItemId, ItemStack } from "./types";
import { itemDef } from "./registry";

/** 空手或未持工具。 */
export type HeldTool = ItemId | "hand";

export interface MiningInput {
  readonly block: BlockId;
  readonly tool: HeldTool;
  /** 工具剩余耐久（未持工具无需提供）。 */
  readonly toolDurability?: number;
}

export interface MiningResult {
  /** 是否可用该工具获得掉落（正确工具 + 足够等级）。 */
  readonly harvestable: boolean;
  /** 掉落物品栈（矿石→对应材料，普通→自身方块物品）。 */
  readonly drops: ReadonlyArray<ItemStack>;
  /** 破坏耗时（相对硬度单位，越小越快）。 */
  readonly time: number;
  /** 消耗的耐久（工具使用一次 =1；空手 =0）。 */
  readonly durabilityUsed: number;
  /** 该次使用后工具是否损坏报废。 */
  readonly toolBroken: boolean;
}

/** 矿石 → 掉落物品（无则返回 null）。 */
export function oreDrop(block: BlockId): ItemId | null {
  switch (block) {
    case "coal_ore":
      return "coal";
    case "iron_ore":
      return "raw_iron";
    case "gold_ore":
      return "raw_gold";
    case "diamond_ore":
      return "diamond";
    case "lapis_ore":
      return "lapis";
    default:
      return null;
  }
}

/** 方块自身的物品 ID（用于普通方块掉落），返回 null 表示无物品对应。 */
export function blockItem(block: BlockId): ItemId | null {
  const map: Partial<Record<BlockId, ItemId>> = {
    stone: "stone",
    grass: "grass_block",
    dirt: "dirt",
    cobblestone: "cobblestone",
    sand: "sand",
    red_sand: "red_sand",
    sandstone: "sandstone",
    gravel: "gravel",
    obsidian: "obsidian",
    log_oak: "log_oak",
    log_spruce: "log_spruce",
    planks_oak: "plank_oak",
    leaves_oak: "leaves_oak",
    leaves_spruce: "leaves_spruce",
    snow: "snow_block",
    ice: "ice",
    packed_ice: "packed_ice",
    cactus: "cactus",
    sugar_cane: "sugar_cane",
    mushroom_red: "mushroom_red",
    mushroom_brown: "mushroom_brown",
    crafting_table: "crafting_table",
    chest: "chest",
    furnace: "furnace",
    bookshelf: "bookshelf",
    sea_lantern: "sea_lantern",
    prismarine: "prismarine",
    sponge: "sponge",
    coral: "coral",
    coral_block: "coral_block",
  };
  return map[block] ?? null;
}

/** 破坏耗时（相对硬度单位）。 */
export function mineTime(block: BlockId, tool: HeldTool): number {
  const b = blockMeta(block);
  if (b.hardness < 0) return Infinity; // 不可破坏（基岩）
  const def = tool === "hand" ? null : itemDef(tool);
  const use = def !== null && (def.kind === "tool" || def.kind === "weapon");
  // 错误工具类别 → ×3
  const correct = use && def!.tool === b.tool;
  if (use && !correct) return b.hardness * 3;
  if (use && correct) return b.hardness / def!.digMultiplier;
  // 空手
  if (b.tool === "none") return b.hardness;
  return b.hardness * 3; // 空手采硬方块很慢且不掉落
}

/** 执行一次挖掘，返回掉落/耗时/耐久。 */
export function mineBlock(input: MiningInput): MiningResult {
  const tool = input.tool;
  const def = tool === "hand" ? null : itemDef(tool);
  const isTool = def !== null && (def.kind === "tool" || def.kind === "weapon");

  // 可收获性：正确工具 + 足够等级（空手只对 tool==='none' 的植物生效）
  // MC 规则：原木可空手徒手摆放获得，作为工具升级链起点。
  let harvestable = canHarvest(
    input.block,
    def ? def.tool : "none",
    def ? def.tier : 0
  );
  if (tool === "hand" && (input.block === "log_oak" || input.block === "log_spruce")) {
    harvestable = true;
  }

  const time = mineTime(input.block, tool);

  const drops: ItemStack[] = [];
  if (harvestable) {
    const ore = oreDrop(input.block);
    if (ore) {
      drops.push({ id: ore, count: 1 });
    } else {
      // 由 W1 的 drop 元数据决定掉落（stone→cobblestone, grass→dirt）
      const droppedBlock = blockMeta(input.block).drop;
      const item = blockItem(droppedBlock) ?? blockItem(input.block);
      if (item) drops.push({ id: item, count: 1 });
    }
  }

  const durabilityUsed = isTool ? 1 : 0;
  let toolBroken = false;
  if (durabilityUsed > 0 && typeof input.toolDurability === "number") {
    toolBroken = input.toolDurability - 1 <= 0;
  }
  return { harvestable, drops, time, durabilityUsed, toolBroken };
}

/** 材料等级 → 挖矿倍率比较（用于工具升级链展示）。 */
export function toolTierOf(item: ItemId): number {
  return itemDef(item).tier;
}

export { canHarvest };
