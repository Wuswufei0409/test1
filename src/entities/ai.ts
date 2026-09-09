/**
 * 实体 AI：游荡/追踪/攻击/逃避 与 爬行者爆炸（对接目标 11）。
 *
 * 纯函数、确定性。AI 状态沿用 src/entities/types.ts 的 {@link AiState}：
 * idle / wander / chase / attack / flee。
 */

import type { AiState } from "./types";
import type { MobDef } from "./mob";
import type { Rng } from "../core/seed";
import type { BlockId, BlockPos, WorldMutate } from "../world/types";

/** 实体的抽象位置快照（供 AI 判定距离/朝向）。 */
export interface AiEntity {
  readonly id: number;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 追踪视野半径（方块）。 */
export const CHASE_RANGE_BLOCKS = 16;
/** 攻击触发半径（方块）。 */
export const ATTACK_RANGE_BLOCKS = 3;
/** 逃避半径（被动生物面对目标时的脱离距离）。 */
export const FLEE_RANGE_BLOCKS = 8;

/** 计算水平距离。 */
export function horizontalDist(a: AiEntity, b: AiEntity): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * 根据行为目标与距离推进 AI 状态。
 * - 敌对：接近目标 -> chase，近身 -> attack。
 * - 被动：目标近身 -> flee，否则 idle/wander。
 * - neutral：受击后 flee（由调用方在受伤时切换），平时 idle。
 */
export function updateAi(
  _current: AiState,
  self: AiEntity,
  target: AiEntity | null,
  def: MobDef
): AiState {
  if (!target) {
    return { targetId: null, mode: def.disposition === "passive" ? "wander" : "idle" };
  }
  const dist = horizontalDist(self, target);
  if (def.disposition === "hostile") {
    if (dist <= ATTACK_RANGE_BLOCKS) {
      return { targetId: target.id, mode: "attack" };
    }
    if (dist <= CHASE_RANGE_BLOCKS) {
      return { targetId: target.id, mode: "chase" };
    }
    return { targetId: null, mode: "idle" };
  }
  // 被动/中立：近距离逃跑。
  if (dist <= FLEE_RANGE_BLOCKS) {
    return { targetId: target.id, mode: "flee" };
  }
  return { targetId: null, mode: "wander" };
}

/** 游荡位移：确定性随机方向一步（单位：方块/步），复用 Rng 保同 seed。 */
export function wanderStep(
  pos: { x: number; y: number; z: number },
  def: MobDef,
  rng: Rng
): { x: number; y: number; z: number } {
  const angle = rng.range(0, Math.PI * 2);
  const dist = def.speed * 0.02; // 每步移动量
  return {
    x: pos.x + Math.cos(angle) * dist,
    y: pos.y,
    z: pos.z + Math.sin(angle) * dist,
  };
}

/** 逃避位移：背离目标方向一步。 */
export function fleeStep(
  pos: { x: number; y: number; z: number },
  threat: AiEntity,
  def: MobDef,
  rng: Rng
): { x: number; y: number; z: number } {
  const dx = pos.x - threat.x;
  const dz = pos.z - threat.z;
  const len = Math.hypot(dx, dz) || 1;
  const dist = def.speed * 0.02;
  const jitter = rng.range(-0.3, 0.3);
  return {
    x: pos.x + (dx / len) * dist + jitter,
    y: pos.y,
    z: pos.z + (dz / len) * dist + jitter,
  };
}

/** 追踪位移：朝目标方向一步。 */
export function chaseStep(
  pos: { x: number; y: number; z: number },
  target: AiEntity,
  def: MobDef
): { x: number; y: number; z: number } {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const dist = def.speed * 0.02;
  return {
    x: pos.x + (dx / len) * dist,
    y: pos.y,
    z: pos.z + (dz / len) * dist,
  };
}

/**
 * 爬行者爆炸：以 (x,y,z) 为中心，半径 radiusBlocks 内在世界 mutate 上把球体内方块替换为 air。
 * 返回受影响的方块坐标数组（提供“爆炸修改世界”的可观测证据）。
 * 纯函数式：不持有状态，直接作用于传入的 WorldMutate。
 */
export function explode(
  world: WorldMutate,
  center: BlockPos,
  radiusBlocks: number
): BlockPos[] {
  const affected: BlockPos[] = [];
  const R = Math.floor(radiusBlocks);
  for (let dx = -R; dx <= R; dx++) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dz = -R; dz <= R; dz++) {
        if (Math.hypot(dx, dy, dz) <= radiusBlocks) {
          const pos: BlockPos = { x: center.x + dx, y: center.y + dy, z: center.z + dz };
          world.setBlock(pos, "air" as BlockId);
          affected.push(pos);
        }
      }
    }
  }
  return affected;
}

/** 末日引信（tick）与引信状态。 */
export interface CreeperState {
  /** 引信剩余 tick。 */
  fuseTicks: number;
  /** 引爆时爆炸半径（方块）。 */
  radiusBlocks: number;
}

/** 新建爬行者爆炸状态。 */
export function freshCreeper(radiusBlocks = 3): CreeperState {
  return { fuseTicks: 30, radiusBlocks };
}

/** 推进引信：玩家近身才开始倒数，归零触发爆炸。 */
export function tickCreeperFuse(
  c: CreeperState,
  playerNear: boolean
): { state: CreeperState; detonated: boolean } {
  if (!playerNear) return { state: c, detonated: false };
  const next = { ...c, fuseTicks: c.fuseTicks - 1 };
  if (next.fuseTicks <= 0) {
    return { state: next, detonated: true };
  }
  return { state: next, detonated: false };
}
