/**
 * 战斗系统：近战/远程命中、护甲减伤、物品耐久、击退与死亡结算（对接目标 12）。
 *
 * 约定：
 * - 全部纯函数/确定性：同输入同输出，便于自动测试验证命中反馈/击退/冷却/射程/耐久。
 * - 护甲按配置比例减少伤害；耐久在命中/使用后减少，归零后武器失效。
 * - 复用 W3 难度矩阵（DIFFICULTY_MULTIPLIER / hostileDamage）。
 */

import type { Difficulty } from "../survival/types";
import { hostileDamage } from "../survival/systems";

/** 武器配置。 */
export interface WeaponDef {
  readonly id: string;
  /** 基础伤害（半心）。 */
  readonly damageHalfHearts: number;
  /** 每击消耗耐久。 */
  readonly durabilityCost: number;
  /** 初始耐久上限。 */
  readonly maxDurability: number;
  /** 攻击冷却（tick）。 */
  readonly cooldownTicks: number;
  /** 有效射程（方块）。 */
  readonly rangeBlocks: number;
}

/** 护甲配置。 */
export interface ArmorDef {
  readonly id: string;
  /** 伤害吸收比例 [0,1]。 */
  readonly reduction: number;
  /** 受到攻击时消耗的耐久（每次 1）。 */
  readonly durabilityCost: number;
  readonly maxDurability: number;
}

/** 战斗状态的不可变快照。 */
export interface CombatState {
  /** 冷却剩余 tick。0 表示可攻击。 */
  readonly cooldown: number;
  /** 命中反馈计数（命中次数，可观测）。 */
  readonly hitCount: number;
  /** 最后一击造成的半心伤害。 */
  readonly lastDamageHalfHearts: number;
  /** 最近一次攻击是否命中并可结算（供死亡判定）。 */
  readonly lastHitId: number | null;
  /** 击退向量（方块，最近一次命中施加）。 */
  readonly lastKnockback: { x: number; y: number; z: number };
}

export const IDLE_COMBAT: CombatState = {
  cooldown: 0,
  hitCount: 0,
  lastDamageHalfHearts: 0,
  lastHitId: null,
  lastKnockback: { x: 0, y: 0, z: 0 },
};

/** 冷却推进。 */
export function advanceCooldown(state: CombatState, ticks: number): CombatState {
  return { ...state, cooldown: Math.max(0, state.cooldown - ticks) };
}

/**
 * 近战命中判定：
 * - 若冷却未就绪则 miss（不结算）。
 * - 距离超过射程则 miss。
 * - 命中返回击退（沿攻击方向）与伤害。
 */
export function meleeAttack(
  state: CombatState,
  weapon: WeaponDef,
  attacker: { id: number; x: number; y: number; z: number },
  target: { id: number; x: number; y: number; z: number },
  difficulty: Difficulty
): { state: CombatState; hit: boolean; damageHalfHearts: number; knockback: { x: number; y: number; z: number } } {
  if (state.cooldown > 0) return { state, hit: false, damageHalfHearts: 0, knockback: { x: 0, y: 0, z: 0 } };
  const dist = Math.hypot(attacker.x - target.x, attacker.y - target.y, attacker.z - target.z);
  if (dist > weapon.rangeBlocks) return { state, hit: false, damageHalfHearts: 0, knockback: { x: 0, y: 0, z: 0 } };

  const event = hostileDamage(weapon.damageHalfHearts, difficulty);
  const damage = event.amount;
  // 击退：沿 attacker->target 方向水平分量，加上浮力。
  const dx = target.x - attacker.x;
  const dz = target.z - attacker.z;
  const len = Math.hypot(dx, dz) || 1;
  const knock = { x: (dx / len) * 0.4, y: 0.2, z: (dz / len) * 0.4 };

  const next: CombatState = {
    cooldown: weapon.cooldownTicks,
    hitCount: state.hitCount + 1,
    lastDamageHalfHearts: damage,
    lastHitId: target.id,
    lastKnockback: knock,
  };
  return { state: next, hit: true, damageHalfHearts: damage, knockback: knock };
}

/** 消耗武器耐久；若耐久耗尽返回失效（durability=0 => 无法再攻击）。 */
export function consumeDurability(
  weapon: WeaponDef,
  durability: number
): number {
  return Math.max(0, durability - weapon.durabilityCost);
}

/** 是否武器已损坏（无法攻击）。 */
export function weaponBroken(durability: number): boolean {
  return durability <= 0;
}

/**
 * 护甲减伤：将半心伤害按护甲吸收比例折算。
 * 返回 { reducedDamage, armorDurabilityUsed, remainingArmorDurability }。
 */
export function applyArmor(
  damageHalfHearts: number,
  armor: ArmorDef,
  armorDurability: number
): { reduced: number; absorption: number; used: number; remaining: number } {
  if (armorDurability <= 0 || damageHalfHearts <= 0) {
    return { reduced: damageHalfHearts, absorption: 0, used: 0, remaining: armorDurability };
  }
  const absorption = Math.round(damageHalfHearts * armor.reduction);
  const reduced = Math.max(0, damageHalfHearts - absorption);
  const used = 1;
  return {
    reduced,
    absorption,
    used,
    remaining: Math.max(0, armorDurability - used),
  };
}

/**
 * 远程（弓箭/投掷）命中：按距离衰减伤害，命中设置冷却。
 */
export function rangedAttack(
  state: CombatState,
  weapon: WeaponDef,
  distBlocks: number,
  difficulty: Difficulty
): { state: CombatState; hit: boolean; damageHalfHearts: number } {
  if (distBlocks > weapon.rangeBlocks) return { state, hit: false, damageHalfHearts: 0 };
  // 距离越远衰减：满射程内线性衰减到 20%。
  const falloff = Math.max(0.2, 1 - distBlocks / weapon.rangeBlocks * 0.8);
  const event = hostileDamage(Math.round(weapon.damageHalfHearts * falloff), difficulty);
  const next: CombatState = {
    ...state,
    cooldown: weapon.cooldownTicks,
    hitCount: state.hitCount + 1,
    lastDamageHalfHearts: event.amount,
    lastHitId: -2, // 远程命中
    lastKnockback: { x: 0, y: 0, z: 0 },
  };
  return { state: next, hit: true, damageHalfHearts: event.amount };
}

/** 战斗装备配置表（目标 12：近战/弓箭/护甲）。 */
export const WEAPONS: Readonly<Record<string, WeaponDef>> = {
  wooden_sword: { id: "wooden_sword", damageHalfHearts: 6, durabilityCost: 1, maxDurability: 60, cooldownTicks: 10, rangeBlocks: 3 },
  stone_sword: { id: "stone_sword", damageHalfHearts: 8, durabilityCost: 1, maxDurability: 132, cooldownTicks: 10, rangeBlocks: 3 },
  iron_sword: { id: "iron_sword", damageHalfHearts: 10, durabilityCost: 1, maxDurability: 251, cooldownTicks: 10, rangeBlocks: 3 },
  bow: { id: "bow", damageHalfHearts: 12, durabilityCost: 1, maxDurability: 384, cooldownTicks: 15, rangeBlocks: 24 },
};

export const ARMORS: Readonly<Record<string, ArmorDef>> = {
  leather: { id: "leather", reduction: 0.28, durabilityCost: 1, maxDurability: 80 },
  iron: { id: "iron", reduction: 0.6, durabilityCost: 1, maxDurability: 165 },
};
