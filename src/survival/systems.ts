/**
 * 生存数值系统：伤害、生命/饥饿/空气推进、食物、重生、难度参数。
 *
 * 全部为纯函数、确定性，便于固定 seed 场景回放与单测（对接目标 09）。
 * 复用来 self-contained 契约（src/survival/types.ts）中的常数与类型，
 * 不破坏既有 applyDamage/isDead/Difficulty 签名。
 */

import {
  applyDamage,
  isDead,
  MAX_HEALTH,
  MAX_HUNGER,
  type DamageEvent,
  type DamageSource,
  type Difficulty,
  type Health,
  type Hunger,
} from "./types";

/** 组合生存状态：生命 + 饥饿 + 空气（氧气）。 */
export interface SurvivalState {
  health: Health;
  hunger: Hunger;
  /** 空气/氧气（气泡），水下消耗、出水恢复。 */
  air: { value: number; max: number };
  alive: boolean;
}

/** 每 tick 推进所需的上下文（由模拟器/测试提供）。 */
export interface SurvivalTickContext {
  /** 当前是否处于水中（决定空气消耗/恢复）。 */
  inWater: boolean;
  /** 当前是否处于活动状态（移动/疾跑，决定饥饿衰减）。 */
  active: boolean;
  /** 当前难度（影响敌对伤害与饥饿/主动参数）。 */
  difficulty: Difficulty;
}

/** 空气最大气泡数（贴近 Bedrock 氧气条 10 格）。 */
export const MAX_AIR = 10;
/** 空气中每 tick 消耗的氧气（单位，满 20TPS 时约 1 秒耗尽，营造张力）。 */
export const AIR_DRAIN_PER_TICK = 1;
/** 出水后每 tick 恢复的氧气。 */
export const AIR_REGAIN_PER_TICK = 2;
/** 空气耗尽后进入溺水状态，再经过的 tick 数触发一次溺水伤害。 */
export const DROWN_DAMAGE_INTERVAL_TICKS = 20;

/** 饥饿衰减基础速率：活动状态下每多少 tick 扣 1 点饥饿（非活动更慢）。 */
export const HUNGER_DECAY_TICKS_ACTIVE = 120;
/** 非活动（静止）时饥饿衰减间隔 tick。 */
export const HUNGER_DECAY_TICKS_IDLE = 480;
/** 饥饿归零后，每多少 tick 造成 1 半心饥饿伤害。 */
export const STARVATION_DAMAGE_INTERVAL_TICKS = 160;

/** 和平模式下禁止敌对伤害与饥饿死亡。 */
export const DIFFICULTY_ALLOW_HOSTILE_DAMAGE: Record<Difficulty, boolean> = {
  peaceful: false,
  easy: true,
  normal: true,
  hard: true,
};

/** 难度对敌对伤害的基础半心倍率（复用 types 既有 DIFFICULTY_MULTIPLIER 的水平）。 */
export const DIFFICULTY_HOSTILE_BASE: Record<Difficulty, number> = {
  peaceful: 0,
  easy: 4,
  normal: 6,
  hard: 8,
};

/** 难度是否产生饥饿伤害（和平不掉血死亡）。 */
export const DIFFICULTY_ALLOW_HUNGER_DEATH: Record<Difficulty, boolean> = {
  peaceful: false,
  easy: true,
  normal: true,
  hard: true,
};

/** 创建完整健康的初始状态。 */
export function freshSurvival(): SurvivalState {
  return {
    health: { value: MAX_HEALTH, max: MAX_HEALTH },
    hunger: { value: MAX_HUNGER, max: MAX_HUNGER, saturation: MAX_HUNGER },
    air: { value: MAX_AIR, max: MAX_AIR },
    alive: true,
  };
}

/** 根据半心伤害量 + 来源构造 DamageEvent。 */
export function halfHearts(amount: number, source: DamageSource): DamageEvent {
  return { amount, source };
}

/**
 * 跌落伤害：超过安全高度（3 格）后，每多 1 格造成 1 半心伤害。
 * 返回 DamageEvent；距离 <= SAFE 时 amount=0。
 */
export const FALL_SAFE_BLOCKS = 3;
export function fallDamage(fallDistanceBlocks: number): DamageEvent {
  const amount = Math.max(0, fallDistanceBlocks - FALL_SAFE_BLOCKS);
  return { amount, source: "fall" };
}

/** 溺水伤害：空气耗尽后每次固定 1 半心。 */
export function drownDamage(): DamageEvent {
  return { amount: 1, source: "drown" };
}

/** 近战伤害事件（来源 melee）。 */
export function meleeDamage(baseHalfHearts: number): DamageEvent {
  return { amount: Math.max(0, baseHalfHearts), source: "melee" };
}

/** 敌对生物伤害，按难度缩放；和平模式下返回 0（不造成敌对伤害）。 */
export function hostileDamage(
  baseHalfHearts: number,
  difficulty: Difficulty
): DamageEvent {
  if (!DIFFICULTY_ALLOW_HOSTILE_DAMAGE[difficulty]) {
    return { amount: 0, source: "hostile" };
  }
  const mult =
    difficulty === "easy"
      ? 0.5
      : difficulty === "hard"
        ? 1.5
        : 1;
  return {
    amount: Math.max(0, Math.round(baseHalfHearts * mult)),
    source: "hostile",
  };
}

/** 应用一次伤害事件并同步 alive。 */
export function applyDamageTo(
  state: SurvivalState,
  event: DamageEvent
): SurvivalState {
  const health = applyDamage(state.health, event);
  return { ...state, health, alive: !isDead(health) && state.alive };
}

/**
 * 推进空气（氧气）。纯函数：水下每 tick 消耗，出水每 tick 恢复。
 */
export function tickAir(state: SurvivalState, inWater: boolean): SurvivalState {
  if (inWater) {
    return {
      ...state,
      air: {
        value: Math.max(0, state.air.value - AIR_DRAIN_PER_TICK),
        max: state.air.max,
      },
    };
  }
  return {
    ...state,
    air: {
      value: Math.min(state.air.max, state.air.value + AIR_REGAIN_PER_TICK),
      max: state.air.max,
    },
  };
}

/**
 * 推进饥饿：活动时衰减更快；饥饿归零后在允许的难度下逐步造成饥饿伤害。
 * hungryTicks 为调用方累计的“饥饿状态下 tick 数”（由模拟器维护）。
 */
export function tickHunger(
  state: SurvivalState,
  active: boolean,
  hungryTicks: number,
  difficulty: Difficulty
): { state: SurvivalState; hungryTicks: number } {
  const interval = active
    ? HUNGER_DECAY_TICKS_ACTIVE
    : HUNGER_DECAY_TICKS_IDLE;
  let hunger = state.hunger;
  let nextTicks = hungryTicks;

  if (state.hunger.value > 0) {
    // 尚未饿到 0：按间隔衰减 1 点。
    if (hungryTicks >= interval) {
      hunger = {
        ...state.hunger,
        value: Math.max(0, state.hunger.value - 1),
        saturation: Math.max(0, state.hunger.saturation - 1),
      };
      nextTicks = 0; // 重置周期
    } else {
      nextTicks = hungryTicks + 1;
    }
  } else {
    // 已归零：累计饿死 tick；允许的难度下周期性造成饥饿伤害。
    nextTicks = hungryTicks + 1;
    if (
      DIFFICULTY_ALLOW_HUNGER_DEATH[difficulty] &&
      nextTicks >= STARVATION_DAMAGE_INTERVAL_TICKS
    ) {
      nextTicks = 0;
      hunger = { ...state.hunger, value: 0, saturation: 0 };
      return {
        state: applyDamageTo(
          { ...state, hunger },
          { amount: 1, source: "suffocation" }
        ),
        hungryTicks: nextTicks,
      };
    }
  }
  return { state: { ...state, hunger }, hungryTicks: nextTicks };
}

/**
 * 综合推进一个 tick 的生存数值：
 * air -> hunger -> 溺水伤害（若空气耗尽，累计溺水 tick）。
 */
export function tickSurvival(
  state: SurvivalState,
  ctx: SurvivalTickContext,
  counters: { hungryTicks: number; drownTicks: number }
): { state: SurvivalState; counters: { hungryTicks: number; drownTicks: number } } {
  let s = tickAir(state, ctx.inWater);
  const hungerRes = tickHunger(s, ctx.active, counters.hungryTicks, ctx.difficulty);
  s = hungerRes.state;

  // 溺水：空气耗尽时累计溺水 tick，达到间隔造成伤害。
  let drownTicks = counters.drownTicks;
  if (s.air.value <= 0 && s.alive) {
    drownTicks += 1;
    if (drownTicks >= DROWN_DAMAGE_INTERVAL_TICKS) {
      drownTicks = 0;
      s = applyDamageTo(s, drownDamage());
    }
  } else {
    drownTicks = 0;
  }

  return {
    state: s,
    counters: { hungryTicks: hungerRes.hungryTicks, drownTicks },
  };
}

/** 死亡：返回 alive=false。 */
export function kill(state: SurvivalState): SurvivalState {
  return {
    ...state,
    health: { ...state.health, value: 0 },
    alive: false,
  };
}

/**
 * 重生：重置生命/饥饿/空气为满，并回到出生位置。
 * 出生点在此以 pure 数据表达（`Array<number>` 位置），供存档/场景使用。
 */
export function respawn(
  spawn: { x: number; y: number; z: number }
): { state: SurvivalState; spawn: { x: number; y: number; z: number } } {
  return { state: freshSurvival(), spawn };
}

/** 难度参数快照（用于证据/调试矩阵）。 */
export interface DifficultyParams {
  hostileDamageBaseHalfHearts: Record<Difficulty, number>;
  allowHostileDamage: Record<Difficulty, boolean>;
  allowHungerDeath: Record<Difficulty, boolean>;
}

export const DIFFICULTY_PARAMS: DifficultyParams = {
  hostileDamageBaseHalfHearts: DIFFICULTY_HOSTILE_BASE,
  allowHostileDamage: DIFFICULTY_ALLOW_HOSTILE_DAMAGE,
  allowHungerDeath: DIFFICULTY_ALLOW_HUNGER_DEATH,
};
