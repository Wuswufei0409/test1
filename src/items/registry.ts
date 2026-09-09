/**
 * 物品注册表：W5 全量物品元数据。
 *
 * 约定：
 * - 配置驱动：任何物品的属性都来自本表；新增物品只需加一行。
 * - 工具/武器有耐久与等级；方块物品带 placeable，对接 W1 世界放置。
 * - 不依赖渲染；供背包/合成/冶炼/工具逻辑与测试共用。
 */

import type { ItemId } from "./types";
import { STACK_LIMIT } from "./types";

/** 物品大类。 */
export type ItemKind =
  | "material" // 材料/资源
  | "block" // 可放置方块
  | "tool" // 工具
  | "weapon" // 武器
  | "food" // 食物
  | "crafted"; // 其他合成物（工具类但无耐久语义）

/** 物品等级（0=无等级，1=木，2=石，3=铁，4=钻石）。 */
export type MateriaTier = 0 | 1 | 2 | 3 | 4;

/** 物品元数据。 */
export interface ItemDef {
  readonly id: ItemId;
  readonly name: string;
  readonly kind: ItemKind;
  readonly stackLimit: number;
  /** 耐久上限（仅 kind=tool/weapon）。 */
  readonly durability: number;
  /** 物品等级（用于工具/武器）。 */
  readonly tier: MateriaTier;
  /** 工具类别（对接 W1 blocks/registry 的 tool 字段）。 */
  readonly tool: "pickaxe" | "axe" | "shovel" | "sword" | "hoe" | "none";
  /** 挖掘速度倍率（对可用方块，越高越快）。 */
  readonly digMultiplier: number;
  /** 该物品对应放置的方块 ID（仅 kind=block）。 */
  readonly placeable?: string;
  /** 是否可烹饪（熔炉）。 */
  coookable?: boolean;
}

function def(o: Omit<ItemDef, "durability" | "tool" | "digMultiplier" | "tier"> & Partial<ItemDef>): ItemDef {
  return {
    durability: 0,
    tool: "none",
    digMultiplier: 1,
    tier: 0,
    ...o,
  };
}

const B64 = 64;
const B16 = 16;
const B1 = 1;

/** 全量物品注册表（按 id 索引）。 */
export const ITEMS: Record<ItemId, ItemDef> = {
  air: def({ id: "air", name: "空气", kind: "material", stackLimit: 0 }),

  // ---------- 材料 ----------
  stick: def({ id: "stick", name: "木棍", kind: "material", stackLimit: B64 }),
  coal: def({ id: "coal", name: "煤炭", kind: "material", stackLimit: B64 }),
  charcoal: def({ id: "charcoal", name: "木炭", kind: "material", stackLimit: B64 }),
  iron_ingot: def({ id: "iron_ingot", name: "铁锭", kind: "material", stackLimit: B64 }),
  gold_ingot: def({ id: "gold_ingot", name: "金锭", kind: "material", stackLimit: B64 }),
  diamond: def({ id: "diamond", name: "钻石", kind: "material", stackLimit: B64 }),
  lapis: def({ id: "lapis", name: "青金石", kind: "material", stackLimit: B64 }),
  flint: def({ id: "flint", name: "燧石", kind: "material", stackLimit: B64 }),
  bowl: def({ id: "bowl", name: "碗", kind: "material", stackLimit: B64 }),
  wheat: def({ id: "wheat", name: "小麦", kind: "material", stackLimit: B64 }),
  wheat_seeds: def({ id: "wheat_seeds", name: "小麦种子", kind: "material", stackLimit: B64 }),
  raw_iron: def({ id: "raw_iron", name: "粗铁", kind: "material", stackLimit: B64 }),
  raw_gold: def({ id: "raw_gold", name: "粗金", kind: "material", stackLimit: B64 }),

  // ---------- 方块物品（kind=block，placeable 对应 W1 方块 ID） ----------
  dirt: def({ id: "dirt", name: "泥土", kind: "block", stackLimit: B64, placeable: "dirt" }),
  grass_block: def({ id: "grass_block", name: "草方块", kind: "block", stackLimit: B64, placeable: "grass" }),
  stone: def({ id: "stone", name: "石头", kind: "block", stackLimit: B64, placeable: "stone" }),
  cobblestone: def({ id: "cobblestone", name: "圆石", kind: "block", stackLimit: B64, placeable: "cobblestone" }),
  sand: def({ id: "sand", name: "沙子", kind: "block", stackLimit: B64, placeable: "sand" }),
  red_sand: def({ id: "red_sand", name: "红沙", kind: "block", stackLimit: B64, placeable: "red_sand" }),
  sandstone: def({ id: "sandstone", name: "砂岩", kind: "block", stackLimit: B64, placeable: "sandstone" }),
  gravel: def({ id: "gravel", name: "砂砾", kind: "block", stackLimit: B64, placeable: "gravel" }),
  clay_ball: def({ id: "clay_ball", name: "黏土球", kind: "material", stackLimit: B64 }),
  obsidian: def({ id: "obsidian", name: "黑曜石", kind: "block", stackLimit: B64, placeable: "obsidian" }),
  log_oak: def({ id: "log_oak", name: "橡木原木", kind: "block", stackLimit: B64, placeable: "log_oak" }),
  log_spruce: def({ id: "log_spruce", name: "云杉原木", kind: "block", stackLimit: B64, placeable: "log_spruce" }),
  plank_oak: def({ id: "plank_oak", name: "橡木木板", kind: "block", stackLimit: B64, placeable: "planks_oak" }),
  plank_spruce: def({ id: "plank_spruce", name: "云杉木板", kind: "block", stackLimit: B64, placeable: "planks_spruce" }),
  leaves_oak: def({ id: "leaves_oak", name: "橡树树叶", kind: "block", stackLimit: B64, placeable: "leaves_oak" }),
  leaves_spruce: def({ id: "leaves_spruce", name: "云杉树叶", kind: "block", stackLimit: B64, placeable: "leaves_spruce" }),
  snow_block: def({ id: "snow_block", name: "雪块", kind: "block", stackLimit: B64, placeable: "snow" }),
  ice: def({ id: "ice", name: "冰", kind: "block", stackLimit: B64, placeable: "ice" }),
  packed_ice: def({ id: "packed_ice", name: "浮冰", kind: "block", stackLimit: B64, placeable: "packed_ice" }),
  cactus: def({ id: "cactus", name: "仙人掌", kind: "block", stackLimit: B64, placeable: "cactus" }),
  sugar_cane: def({ id: "sugar_cane", name: "甘蔗", kind: "block", stackLimit: B64, placeable: "sugar_cane" }),
  mushroom_red: def({ id: "mushroom_red", name: "红蘑菇", kind: "block", stackLimit: B64, placeable: "mushroom_red" }),
  mushroom_brown: def({ id: "mushroom_brown", name: "棕蘑菇", kind: "block", stackLimit: B64, placeable: "mushroom_brown" }),
  glass: def({ id: "glass", name: "玻璃", kind: "block", stackLimit: B64, placeable: "glass" }),
  crafting_table: def({ id: "crafting_table", name: "工作台", kind: "block", stackLimit: B64, placeable: "crafting_table" }),
  chest: def({ id: "chest", name: "箱子", kind: "block", stackLimit: B64, placeable: "chest" }),
  furnace: def({ id: "furnace", name: "熔炉", kind: "block", stackLimit: B64, placeable: "furnace" }),
  bookshelf: def({ id: "bookshelf", name: "书架", kind: "block", stackLimit: B64, placeable: "bookshelf" }),
  sea_lantern: def({ id: "sea_lantern", name: "海晶灯", kind: "block", stackLimit: B64, placeable: "sea_lantern" }),
  prismarine: def({ id: "prismarine", name: "海晶石", kind: "block", stackLimit: B64, placeable: "prismarine" }),
  sponge: def({ id: "sponge", name: "海绵", kind: "block", stackLimit: B64, placeable: "sponge" }),
  coral: def({ id: "coral", name: "珊瑚", kind: "block", stackLimit: B64, placeable: "coral" }),
  coral_block: def({ id: "coral_block", name: "珊瑚块", kind: "block", stackLimit: B64, placeable: "coral_block" }),
  coal_ore: def({ id: "coal_ore", name: "煤矿石", kind: "block", stackLimit: B64, placeable: "coal_ore" }),
  iron_ore: def({ id: "iron_ore", name: "铁矿石", kind: "block", stackLimit: B64, placeable: "iron_ore" }),
  gold_ore: def({ id: "gold_ore", name: "金矿石", kind: "block", stackLimit: B64, placeable: "gold_ore" }),
  diamond_ore: def({ id: "diamond_ore", name: "钻石矿石", kind: "block", stackLimit: B64, placeable: "diamond_ore" }),
  lapis_ore: def({ id: "lapis_ore", name: "青金石矿石", kind: "block", stackLimit: B64, placeable: "lapis_ore" }),

  // ---------- 工具 ----------
  wooden_pickaxe: def({ id: "wooden_pickaxe", name: "木镐", kind: "tool", stackLimit: B1, durability: 59, tier: 1, tool: "pickaxe", digMultiplier: 2 }),
  stone_pickaxe: def({ id: "stone_pickaxe", name: "石镐", kind: "tool", stackLimit: B1, durability: 131, tier: 2, tool: "pickaxe", digMultiplier: 4 }),
  iron_pickaxe: def({ id: "iron_pickaxe", name: "铁镐", kind: "tool", stackLimit: B1, durability: 250, tier: 3, tool: "pickaxe", digMultiplier: 6 }),
  diamond_pickaxe: def({ id: "diamond_pickaxe", name: "钻石镐", kind: "tool", stackLimit: B1, durability: 1561, tier: 4, tool: "pickaxe", digMultiplier: 8 }),
  wooden_axe: def({ id: "wooden_axe", name: "木斧", kind: "tool", stackLimit: B1, durability: 59, tier: 1, tool: "axe", digMultiplier: 2 }),
  stone_axe: def({ id: "stone_axe", name: "石斧", kind: "tool", stackLimit: B1, durability: 131, tier: 2, tool: "axe", digMultiplier: 4 }),
  iron_axe: def({ id: "iron_axe", name: "铁斧", kind: "tool", stackLimit: B1, durability: 250, tier: 3, tool: "axe", digMultiplier: 6 }),
  diamond_axe: def({ id: "diamond_axe", name: "钻石斧", kind: "tool", stackLimit: B1, durability: 1561, tier: 4, tool: "axe", digMultiplier: 8 }),
  wooden_shovel: def({ id: "wooden_shovel", name: "木锹", kind: "tool", stackLimit: B1, durability: 59, tier: 1, tool: "shovel", digMultiplier: 2 }),
  stone_shovel: def({ id: "stone_shovel", name: "石锹", kind: "tool", stackLimit: B1, durability: 131, tier: 2, tool: "shovel", digMultiplier: 4 }),
  iron_shovel: def({ id: "iron_shovel", name: "铁锹", kind: "tool", stackLimit: B1, durability: 250, tier: 3, tool: "shovel", digMultiplier: 6 }),
  diamond_shovel: def({ id: "diamond_shovel", name: "钻石锹", kind: "tool", stackLimit: B1, durability: 1561, tier: 4, tool: "shovel", digMultiplier: 8 }),

  // ---------- 武器（剑） ----------
  wooden_sword: def({ id: "wooden_sword", name: "木剑", kind: "weapon", stackLimit: B1, durability: 59, tier: 1, tool: "sword", digMultiplier: 1 }),
  stone_sword: def({ id: "stone_sword", name: "石剑", kind: "weapon", stackLimit: B1, durability: 131, tier: 2, tool: "sword", digMultiplier: 1 }),
  iron_sword: def({ id: "iron_sword", name: "铁剑", kind: "weapon", stackLimit: B1, durability: 250, tier: 3, tool: "sword", digMultiplier: 1 }),
  diamond_sword: def({ id: "diamond_sword", name: "钻石剑", kind: "weapon", stackLimit: B1, durability: 1561, tier: 4, tool: "sword", digMultiplier: 1 }),
  trident: def({ id: "trident", name: "三叉戟", kind: "weapon", stackLimit: B1, durability: 250, tier: 2, tool: "none", digMultiplier: 1 }),

  // ---------- 合成物 ----------
  torch: def({ id: "torch", name: "火把", kind: "crafted", stackLimit: B64 }),
  bucket: def({ id: "bucket", name: "铁桶", kind: "crafted", stackLimit: B16 }),
  boat: def({ id: "boat", name: "木船", kind: "crafted", stackLimit: B1 }),
  ladder: def({ id: "ladder", name: "梯子", kind: "crafted", stackLimit: B64 }),

  // ---------- 食物 ----------
  apple: def({ id: "apple", name: "苹果", kind: "food", stackLimit: B64 }),
  bread: def({ id: "bread", name: "面包", kind: "food", stackLimit: B64 }),
  raw_porkchop: def({ id: "raw_porkchop", name: "生猪排", kind: "food", stackLimit: B64, coookable: true }),
  cooked_porkchop: def({ id: "cooked_porkchop", name: "熟猪排", kind: "food", stackLimit: B64 }),
  carrot: def({ id: "carrot", name: "胡萝卜", kind: "food", stackLimit: B64 }),
  potato: def({ id: "potato", name: "马铃薯", kind: "food", stackLimit: B64, coookable: true }),
  baked_potato: def({ id: "baked_potato", name: "烤马铃薯", kind: "food", stackLimit: B64 }),
};

/** 工具/武器材料等级显示表。 */
export const TIER_INFO: Record<MateriaTier, { name: string; label: string }> = {
  0: { name: "无", label: "" },
  1: { name: "木质", label: "wood" },
  2: { name: "石质", label: "stone" },
  3: { name: "铁质", label: "iron" },
  4: { name: "钻石", label: "diamond" },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** 安全取物品定义（未知回退空气）。 */
export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id] ?? ITEMS.air;
}

/** 是否为工具/武器（有耐久）。 */
export function isDurable(id: ItemId): boolean {
  const d = itemDef(id);
  return d.kind === "tool" || d.kind === "weapon";
}

/** 默认堆叠上限。 */
export function stackLimitOf(id: ItemId): number {
  const d = itemDef(id);
  return d.stackLimit > 0 ? d.stackLimit : STACK_LIMIT;
}
