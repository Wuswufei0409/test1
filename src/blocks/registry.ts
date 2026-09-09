/**
 * 方块注册表：30+ 可区分方块的元数据与纹理占位。
 *
 * 约定：
 * - 每个方块有稳定 ID、硬度、所需工具/等级、掉落与基础颜色（程序纹理种子）。
 * - 本注册表不依赖渲染，供世界生成、采集、背包与测试共用。
 * - 纹理为原创程序生成（见 scripts/generate-textures.mjs），不复制任何受版权素材。
 */

import type { BlockId } from "../world/types";

/** 挖掘工具类别。 */
export type ToolType =
  | "pickaxe"
  | "axe"
  | "shovel"
  | "sword"
  | "hoe"
  | "none";

/** 工具等级：0=空手/任何，1=木，2=石，3=铁，4=钻石。 */
export type ToolTier = 0 | 1 | 2 | 3 | 4;

/** 方块元数据。 */
export interface BlockMeta {
  readonly id: BlockId;
  /** 显示名（中文，便于 HUD/测试阅读）。 */
  readonly name: string;
  /** 硬度（秒级相对值）。-1 表示不可破坏（如基岩）。 */
  readonly hardness: number;
  /** 最佳/必需工具类别。 */
  readonly tool: ToolType;
  /** 必需工具等级（低于此无法获得掉落）。0 表示空手可获得。 */
  readonly tier: ToolTier;
  /** 破坏后掉落（方块 ID；stone→cobblestone 等）。自身掉落者等于 id。 */
  readonly drop: BlockId;
  /** 是否为实心（不可穿越）。 */
  readonly solid: boolean;
  /** 是否为液体（水/熔岩）。 */
  readonly liquid: boolean;
  /** 是否遮挡视线（树叶/水等为 false）。 */
  readonly opaque: boolean;
  /** 基础颜色（程序纹理主色，R 通道可为 0 当透明）。 */
  readonly color: number;
  /** 纹理文件名（assets/textures/ 下的 PNG）。 */
  readonly texture: string;
}

function meta(b: Omit<BlockMeta, "texture"> & { texture?: string }): BlockMeta {
  // 默认纹理文件名 = 方块 id。
  return {
    texture: `${b.id}.png`,
    ...b,
  };
}

/** 全部方块注册表（稳定且按 ID 索引）。 */
export const BLOCKS: Record<BlockId, BlockMeta> = {
  air: meta({
    id: "air", name: "空气", hardness: 0, tool: "none", tier: 0, drop: "air",
    solid: false, liquid: false, opaque: false, color: 0x000000,
  }),
  stone: meta({
    id: "stone", name: "石头", hardness: 1.5, tool: "pickaxe", tier: 1, drop: "cobblestone",
    solid: true, liquid: false, opaque: true, color: 0x8a8a8a,
  }),
  grass: meta({
    id: "grass", name: "草方块", hardness: 0.6, tool: "shovel", tier: 0, drop: "dirt",
    solid: true, liquid: false, opaque: true, color: 0x7cb342,
  }),
  dirt: meta({
    id: "dirt", name: "泥土", hardness: 0.5, tool: "shovel", tier: 0, drop: "dirt",
    solid: true, liquid: false, opaque: true, color: 0x8b5a2b,
  }),
  coarse_dirt: meta({
    id: "coarse_dirt", name: "砂土", hardness: 0.5, tool: "shovel", tier: 0, drop: "coarse_dirt",
    solid: true, liquid: false, opaque: true, color: 0x7a5230,
  }),
  cobblestone: meta({
    id: "cobblestone", name: "圆石", hardness: 2.0, tool: "pickaxe", tier: 1, drop: "cobblestone",
    solid: true, liquid: false, opaque: true, color: 0x8a8a8a,
  }),
  bedrock: meta({
    id: "bedrock", name: "基岩", hardness: -1, tool: "pickaxe", tier: 4, drop: "air",
    solid: true, liquid: false, opaque: true, color: 0x3a3a3a,
  }),
  gravel: meta({
    id: "gravel", name: "砂砾", hardness: 0.6, tool: "shovel", tier: 0, drop: "gravel",
    solid: true, liquid: false, opaque: true, color: 0x9b9b9b,
  }),
  sand: meta({
    id: "sand", name: "沙子", hardness: 0.5, tool: "shovel", tier: 0, drop: "sand",
    solid: true, liquid: false, opaque: true, color: 0xe8d49a,
  }),
  red_sand: meta({
    id: "red_sand", name: "红沙", hardness: 0.5, tool: "shovel", tier: 0, drop: "red_sand",
    solid: true, liquid: false, opaque: true, color: 0xd97a46,
  }),
  sandstone: meta({
    id: "sandstone", name: "砂岩", hardness: 0.8, tool: "pickaxe", tier: 1, drop: "sandstone",
    solid: true, liquid: false, opaque: true, color: 0xd8c79a,
  }),
  clay: meta({
    id: "clay", name: "黏土", hardness: 0.6, tool: "shovel", tier: 0, drop: "clay",
    solid: true, liquid: false, opaque: true, color: 0xa5a5ad,
  }),
  snow: meta({
    id: "snow", name: "雪", hardness: 0.2, tool: "shovel", tier: 0, drop: "snow",
    solid: true, liquid: false, opaque: true, color: 0xffffff,
  }),
  ice: meta({
    id: "ice", name: "冰", hardness: 0.5, tool: "pickaxe", tier: 0, drop: "ice",
    solid: true, liquid: false, opaque: false, color: 0x9ad7ff,
  }),
  packed_ice: meta({
    id: "packed_ice", name: "浮冰", hardness: 0.5, tool: "pickaxe", tier: 0, drop: "packed_ice",
    solid: true, liquid: false, opaque: false, color: 0xa5d8ff,
  }),
  obsidian: meta({
    id: "obsidian", name: "黑曜石", hardness: 50, tool: "pickaxe", tier: 4, drop: "obsidian",
    solid: true, liquid: false, opaque: true, color: 0x1a1030,
  }),
  coal_ore: meta({
    id: "coal_ore", name: "煤矿石", hardness: 3, tool: "pickaxe", tier: 1, drop: "coal_ore",
    solid: true, liquid: false, opaque: true, color: 0x7a7a7a,
  }),
  iron_ore: meta({
    id: "iron_ore", name: "铁矿石", hardness: 3, tool: "pickaxe", tier: 1, drop: "iron_ore",
    solid: true, liquid: false, opaque: true, color: 0xd8c9a8,
  }),
  gold_ore: meta({
    id: "gold_ore", name: "金矿石", hardness: 3, tool: "pickaxe", tier: 2, drop: "gold_ore",
    solid: true, liquid: false, opaque: true, color: 0xf5d76e,
  }),
  diamond_ore: meta({
    id: "diamond_ore", name: "钻石矿石", hardness: 3, tool: "pickaxe", tier: 3, drop: "diamond_ore",
    solid: true, liquid: false, opaque: true, color: 0x7ce0d8,
  }),
  lapis_ore: meta({
    id: "lapis_ore", name: "青金石矿石", hardness: 3, tool: "pickaxe", tier: 1, drop: "lapis_ore",
    solid: true, liquid: false, opaque: true, color: 0x3f6fb5,
  }),
  log_oak: meta({
    id: "log_oak", name: "橡木原木", hardness: 2, tool: "axe", tier: 0, drop: "log_oak",
    solid: true, liquid: false, opaque: true, color: 0x6b4a2b,
  }),
  log_spruce: meta({
    id: "log_spruce", name: "云杉原木", hardness: 2, tool: "axe", tier: 0, drop: "log_spruce",
    solid: true, liquid: false, opaque: true, color: 0x4a3a2b,
  }),
  planks_oak: meta({
    id: "planks_oak", name: "橡木木板", hardness: 2, tool: "axe", tier: 0, drop: "planks_oak",
    solid: true, liquid: false, opaque: true, color: 0xb08d57,
  }),
  leaves_oak: meta({
    id: "leaves_oak", name: "橡树树叶", hardness: 0.2, tool: "sword", tier: 0, drop: "leaves_oak",
    solid: true, liquid: false, opaque: false, color: 0x2e7d32,
  }),
  leaves_spruce: meta({
    id: "leaves_spruce", name: "云杉树叶", hardness: 0.2, tool: "sword", tier: 0, drop: "leaves_spruce",
    solid: true, liquid: false, opaque: false, color: 0x1e5e2e,
  }),
  tall_grass: meta({
    id: "tall_grass", name: "高草丛", hardness: 0, tool: "none", tier: 0, drop: "tall_grass",
    solid: false, liquid: false, opaque: false, color: 0x5cb85c,
  }),
  cactus: meta({
    id: "cactus", name: "仙人掌", hardness: 0.4, tool: "none", tier: 0, drop: "cactus",
    solid: true, liquid: false, opaque: false, color: 0x3f9b3f,
  }),
  sugar_cane: meta({
    id: "sugar_cane", name: "甘蔗", hardness: 0, tool: "none", tier: 0, drop: "sugar_cane",
    solid: false, liquid: false, opaque: false, color: 0x7cbb6a,
  }),
  flower_poppy: meta({
    id: "flower_poppy", name: "虞美人", hardness: 0, tool: "none", tier: 0, drop: "flower_poppy",
    solid: false, liquid: false, opaque: false, color: 0xd84343,
  }),
  flower_dandelion: meta({
    id: "flower_dandelion", name: "蒲公英", hardness: 0, tool: "none", tier: 0, drop: "flower_dandelion",
    solid: false, liquid: false, opaque: false, color: 0xf2d624,
  }),
  flower_blue_orchid: meta({
    id: "flower_blue_orchid", name: "兰花", hardness: 0, tool: "none", tier: 0, drop: "flower_blue_orchid",
    solid: false, liquid: false, opaque: false, color: 0x4b6fc9,
  }),
  mushroom_red: meta({
    id: "mushroom_red", name: "红蘑菇", hardness: 0, tool: "none", tier: 0, drop: "mushroom_red",
    solid: false, liquid: false, opaque: false, color: 0xc0392b,
  }),
  mushroom_brown: meta({
    id: "mushroom_brown", name: "棕蘑菇", hardness: 0, tool: "none", tier: 0, drop: "mushroom_brown",
    solid: false, liquid: false, opaque: false, color: 0x8d6e63,
  }),
  wheat: meta({
    id: "wheat", name: "小麦", hardness: 0, tool: "none", tier: 0, drop: "wheat",
    solid: false, liquid: false, opaque: false, color: 0xd4b94e,
  }),
  water: meta({
    id: "water", name: "水", hardness: 100, tool: "none", tier: 0, drop: "air",
    solid: false, liquid: true, opaque: false, color: 0x3c6ea5,
  }),
  lava: meta({
    id: "lava", name: "熔岩", hardness: 100, tool: "none", tier: 0, drop: "air",
    solid: false, liquid: true, opaque: false, color: 0xe25822,
  }),
  sea_grass: meta({
    id: "sea_grass", name: "海草", hardness: 0, tool: "none", tier: 0, drop: "sea_grass",
    solid: false, liquid: false, opaque: false, color: 0x3e8b5a,
  }),
  kelp: meta({
    id: "kelp", name: "海带", hardness: 0, tool: "none", tier: 0, drop: "kelp",
    solid: false, liquid: false, opaque: false, color: 0x3f8f5f,
  }),
  coral: meta({
    id: "coral", name: "珊瑚", hardness: 0, tool: "none", tier: 0, drop: "coral",
    solid: false, liquid: false, opaque: false, color: 0xff6f9c,
  }),
  coral_block: meta({
    id: "coral_block", name: "珊瑚块", hardness: 1.5, tool: "pickaxe", tier: 0, drop: "coral_block",
    solid: true, liquid: false, opaque: true, color: 0xe76f9c,
  }),
  sponge: meta({
    id: "sponge", name: "海绵", hardness: 0.6, tool: "hoe", tier: 0, drop: "sponge",
    solid: true, liquid: false, opaque: true, color: 0xd7c24a,
  }),
  sea_lantern: meta({
    id: "sea_lantern", name: "海晶灯", hardness: 0.3, tool: "pickaxe", tier: 0, drop: "sea_lantern",
    solid: true, liquid: false, opaque: false, color: 0xe8f7ff,
  }),
  prismarine: meta({
    id: "prismarine", name: "海晶石", hardness: 1.5, tool: "pickaxe", tier: 1, drop: "prismarine",
    solid: true, liquid: false, opaque: true, color: 0x8fc7c2,
  }),
  crafting_table: meta({
    id: "crafting_table", name: "工作台", hardness: 2.5, tool: "axe", tier: 0, drop: "crafting_table",
    solid: true, liquid: false, opaque: true, color: 0xb08d57,
  }),
  furnace: meta({
    id: "furnace", name: "熔炉", hardness: 3.5, tool: "pickaxe", tier: 0, drop: "furnace",
    solid: true, liquid: false, opaque: true, color: 0x8a8a8a,
  }),
  chest: meta({
    id: "chest", name: "箱子", hardness: 2.5, tool: "axe", tier: 0, drop: "chest",
    solid: true, liquid: false, opaque: true, color: 0xb08d57,
  }),
  bookshelf: meta({
    id: "bookshelf", name: "书架", hardness: 1.5, tool: "axe", tier: 0, drop: "bookshelf",
    solid: true, liquid: false, opaque: true, color: 0x7a5230,
  }),
};

/** 全部注册方块 ID 的稳定列表。 */
export const BLOCK_IDS: readonly BlockId[] = Object.keys(BLOCKS) as BlockId[];

/** 所有实心方块（用于碰撞/放置合法性）。 */
export const SOLID_BLOCK_IDS: readonly BlockId[] = BLOCK_IDS.filter(
  (id) => BLOCKS[id].solid
);

/** 返回方块元数据（安全访问，未知 ID 回退到空气元数据）。 */
export function blockMeta(id: BlockId): BlockMeta {
  return BLOCKS[id] ?? BLOCKS.air;
}

/** 获取方块基础颜色（渲染占位）。 */
export function blockColor(id: BlockId): number {
  return blockMeta(id).color;
}

/** 判断该方块在当前工具下能否被有效开采并掉落。 */
export function canHarvest(id: BlockId, tool: ToolType, tier: ToolTier): boolean {
  const b = blockMeta(id);
  if (b.hardness < 0) return false; // 不可破坏
  if (b.tool === "none") return true; // 空手可采（草/植物）
  if (b.tool === "hoe" || b.tool === "shovel" || b.tool === "sword") {
    // 这些无需等级（宽松处理）
  }
  if (tool !== b.tool) return false; // 需要正确工具类别
  return tier >= b.tier;
}

/** 统计已注册方块数（验收用）。 */
export const REGISTERED_BLOCK_COUNT = BLOCK_IDS.length;
