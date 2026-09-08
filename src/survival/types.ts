/**
 * 生存模块契约：生命、饥饿、伤害、死亡。
 *
 * 约定：数值以半心（half-heart）为最小伤害单位，贴近 Bedrock。
 * 全部逻辑为纯函数，便于确定性测试。
 */

/** 生命值，范围 [0, MAX_HEALTH]。值 = 半心数 × 2。 */
export interface Health {
  value: number;
  max: number;
}

/** 饥饿值，范围 [0, MAX_HUNGER]。 */
export interface Hunger {
  value: number;
  max: number;
  /** 饱和度（暂留）。 */
  saturation: number;
}

/** 伤害来源。 */
export type DamageSource =
  | "fall"
  | "drown"
  | "melee"
  | "hostile"
  | "suffocation"
  | "magic";

/** 伤害事件。 */
export interface DamageEvent {
  amount: number; // 半心数
  source: DamageSource;
}

export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;

/** 计算剩余生命：扣血后在 [0,max] 内钳制。纯函数。 */
export function applyDamage(health: Health, event: DamageEvent): Health {
  return {
    max: health.max,
    value: Math.max(0, Math.min(health.max, health.value - event.amount * 2)),
  };
}

/** 是否死亡。 */
export function isDead(health: Health): boolean {
  return health.value <= 0;
}

/** 难度参数：影响敌对生物伤害倍率。 */
export type Difficulty = "peaceful" | "easy" | "normal" | "hard";

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  peaceful: 0,
  easy: 0.5,
  normal: 1,
  hard: 1.5,
};
