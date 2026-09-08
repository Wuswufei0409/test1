/**
 * 实体模块契约：生物与实体基础类型。
 *
 * 约定：实体共享位置/朝向/速度快照，mob 增加 AI 状态。全部确定性。
 */

import type { ItemId } from "../items/types";

/** 实体分类。 */
export type EntityKind =
  | "player"
  | "pig"
  | "cow"
  | "sheep"
  | "chicken"
  | "zombie"
  | "spider"
  | "creeper"
  | "dolphin"
  | "cod"
  | "fish_tropical"
  | "pufferfish";

/** 实体共享快照。 */
export interface EntityState {
  readonly id: number;
  readonly kind: EntityKind;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  velocity: { x: number; y: number; z: number };
  health: number;
  maxHealth: number;
  dead: boolean;
}

/** 实体掉落契约（配置化）。 */
export interface LootTable {
  drops(): ReadonlyArray<{ item: ItemId; chance: number; min: number; max: number }>;
}

/** 敌对/被动 AI 状态标记（阶段 1+ 实现行为）。 */
export interface AiState {
  /** 追踪中的目标实体 id，无则 null。 */
  targetId: number | null;
  /** 游荡/追踪/攻击/逃避 枚举。 */
  mode: "idle" | "wander" | "chase" | "attack" | "flee";
}
