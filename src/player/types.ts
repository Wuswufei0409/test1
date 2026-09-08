/**
 * 玩家模块契约：输入状态、控制、运动常数。
 *
 * 约定：
 * - {@link PlayerState} 是纯数据快照，玩家逻辑只读它并把结果写回同一形状。
 * - 重力、跳跃、疾跑等数值集中在 {@link PLAYER_CONSTANTS}，供物理与测试共享。
 */

import type { BlockPos } from "../world/types";

/** 玩家朝向（欧拉角，弧度）。 */
export interface PlayerRotation {
  yaw: number;
  pitch: number;
}

/** 玩家输入状态（由渲染/事件层每帧写入）。 */
export interface PlayerInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
  /** 最近一次鼠标增量（相对，用于视角）。 */
  mouseDX: number;
  mouseDY: number;
}

/** 玩家状态快照。 */
export interface PlayerState {
  /** 脚部方块坐标。 */
  position: BlockPos;
  /** 精确坐标（含小数，物理使用）。 */
  exact: { x: number; y: number; z: number };
  rotation: PlayerRotation;
  velocity: { x: number; y: number; z: number };
  onGround: boolean;
  inWater: boolean;
  sprinting: boolean;
  sneaking: boolean;
}

/** 玩家物理/移动常数。单位：方块/秒（速度），方块/秒²（重力）。 */
export const PLAYER_CONSTANTS = {
  /** 水平步行速度。 */
  walkSpeed: 4.317,
  /** 疾跑倍率（相对步行）。 */
  sprintMultiplier: 1.3,
  /** 跳跃初速度（向上）。 */
  jumpVelocity: 8.2,
  /** 重力加速度。 */
  gravity: 26.0,
  /** 下蹲时掩体高度比（视觉）。 */
  sneakHeightRatio: 0.65,
  /** 玩家眼高（相对脚部）。 */
  eyeHeight: 1.62,
  /** 击退 / 碰撞恢复用弹性（预留）。 */
  restitution: 0.2,
} as const;
