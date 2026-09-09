/**
 * 世界模块的公共类型与接口契约。
 *
 * 约定：
 * - 坐标体系：整数方块坐标 int(X,Y,Z)，Y 向上。区块坐标 = floor(global / CHUNK_SIZE)。
 * - 方块 ID 为稳定字符串，禁止用魔法数字。
 * - 世界读取接口 {@link WorldRead} 是只读快照；修改只通过 {@link WorldMutate}。
 */

import type { Seed } from "../core/seed";

/** 区块边长（方块）。 */
export const CHUNK_SIZE = 16;
/** 世界高度（Y 范畴），0..128（含 0 不含 128）。 */
export const WORLD_HEIGHT = 128;

/** 方块全局整数坐标。 */
export interface BlockPos {
  x: number;
  y: number;
  z: number;
}

/** 区块坐标 = floor(global / CHUNK_SIZE)。 */
export interface ChunkPos {
  cx: number;
  cz: number;
}

/** 生物群系 ID（稳定字符串）。 */
export type BiomeId =
  | "plains"
  | "forest"
  | "desert"
  | "mountains"
  | "ocean_cold"
  | "ocean_warm"
  | "ocean_deep";

/**
 * 可区分方块 ID（阶段 1 扩充到 30+）。
 * 每个 ID 的元数据（硬度/工具/掉落/纹理）见 {@link ../blocks/registry}。
 */
export type BlockId =
  // 基础
  | "air"
  | "stone"
  | "grass"
  | "dirt"
  | "coarse_dirt"
  | "cobblestone"
  | "bedrock"
  | "gravel"
  // 沙/石系
  | "sand"
  | "red_sand"
  | "sandstone"
  | "clay"
  | "snow"
  | "ice"
  | "packed_ice"
  | "obsidian"
  // 矿石
  | "coal_ore"
  | "iron_ore"
  | "gold_ore"
  | "diamond_ore"
  | "lapis_ore"
  // 木头/树叶/木板
  | "log_oak"
  | "log_spruce"
  | "planks_oak"
  | "leaves_oak"
  | "leaves_spruce"
  // 植被与作物
  | "tall_grass"
  | "cactus"
  | "sugar_cane"
  | "flower_poppy"
  | "flower_dandelion"
  | "flower_blue_orchid"
  | "mushroom_red"
  | "mushroom_brown"
  | "wheat"
  // 农业
  | "farmland"
  // 液体
  | "water"
  | "lava"
  // 水下
  | "sea_grass"
  | "kelp"
  | "coral"
  | "coral_block"
  | "sponge"
  | "sea_lantern"
  | "prismarine"
  // 功能/装饰
  | "crafting_table"
  | "furnace"
  | "chest"
  | "bookshelf";

/** 海洋基准海平面（Y）。低于该值的非实心位置由水填充。 */
export const SEA_LEVEL = 24;

/** 只读世界查询契约。 */
export interface WorldRead {
  readonly seed: Seed;
  getBlock(pos: BlockPos): BlockId;
  getBiome(cx: number, cz: number): BiomeId;
  /** 高度图：返回该 (x,z) 处最高的非空气方块 Y。 */
  getHeight(x: number, z: number): number;
  isSolid(pos: BlockPos): boolean;
}

/** 可写世界契约（阶段 1 及以上使用）。 */
export interface WorldMutate {
  setBlock(pos: BlockPos, block: BlockId): void;
}

/** 多维方块数组的快照（用于存档/测试）。 */
export type BlockSlice = ReadonlyArray<ReadonlyArray<BlockId>>;
