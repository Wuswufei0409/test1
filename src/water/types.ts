/**
 * 水体核心模块的类型契约。
 *
 * 覆盖（W9，IMP-9）：
 * - 水下能见度（雾距随深度衰减、雾色偏蓝）。
 * - 氧气条 + 溺水流程（复用生存模块的空气/溺水原语）。
 * - 疾跑游泳与 1×1 水道通行。
 * - 掉落物上浮（浮力）。
 * - 水下放置方块不产生错误空气洞。
 *
 * 约定：全部为纯函数、确定性，便于 vitest 断言。
 */

import type { ItemId } from "../items/types";

/** 1 格宽水道 / 水格切片中的单元类型。 */
export type CellKind = "water" | "air" | "solid";

/** 水下能见度计算结果（确定性子查询）。 */
export interface WaterVisibility {
  /** 头部（眼）是否没入水中。 */
  submerged: boolean;
  /** 水下可见（雾）距离，方块。越深越小。 */
  fogDistance: number;
  /** 水下雾色（偏蓝，0xRRGGBB）。 */
  fogColor: number;
  /** 从眼格向下连续水格数（>=1 表示已入水）。 */
  depth: number;
}

/** 游泳运动当前状态（由模拟器每 tick 维护）。 */
export interface SwimState {
  /** 垂直速度（方块/tick，正向上）。 */
  vy: number;
  /** 是否正在上浮（按住跳跃键）。 */
  surfacing: boolean;
  /** 是否正在下潜（按住下蹲键）。 */
  diving: boolean;
}

/** 游泳输入（由控制/渲染层每帧写入）。 */
export interface SwimInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

/** 游泳单步计算结果（确定性）。 */
export interface SwimStepResult {
  state: SwimState;
  /** 水平位移（方块/tick）。 */
  hx: number;
  hz: number;
  /** 垂直位移（方块/tick）。 */
  dy: number;
  /** 本次游泳水平速度（方块/tick）。 */
  speed: number;
  /** 是否为疾跑游泳。 */
  sprintSwim: boolean;
  /** 本步是否上浮（按住跳跃）。 */
  surfacing: boolean;
  /** 本步是否下潜（按住下蹲）。 */
  diving: boolean;
}

/** 掉落物（受浮力影响的物理项）。 */
export interface DroppedItem {
  id: number;
  item: ItemId;
  x: number;
  y: number;
  z: number;
  /** 是否处于水中（决定上浮）。 */
  inWater: boolean;
}

/**
 * 二维水格切片（用于「水下放置不产生错误空气洞」与 1×1 水道判定）。
 * row 为 Y（0=底部，向上递增），col 为横向。
 */
export interface WaterGrid {
  /** 行数（Y 方向）。 */
  rows: number;
  /** 列数（横向）。 */
  cols: number;
  /** 栅格：cells[row][col] ∈ water | air | solid。 */
  cells: CellKind[][];
}

/** 空气洞坐标（row, col）。 */
export interface AirHole {
  row: number;
  col: number;
}

/** 水中放置方块的结果。 */
export interface PlaceUnderwaterResult {
  grid: WaterGrid;
  /** 因放置而被回填为水的错误空气洞数量（0 表示无）。 */
  backfilled: number;
}
