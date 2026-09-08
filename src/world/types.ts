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

/** 可区分方块 ID（阶段 0 先声明子集，阶段 1+ 继续扩）。 */
export type BlockId =
  | "air"
  | "grass"
  | "dirt"
  | "stone"
  | "sand"
  | "water"
  | "log_oak"
  | "leaves_oak"
  | "snow"
  | "ice"
  | "coral"
  | "gravel";

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
