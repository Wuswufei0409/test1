/**
 * 三叉戟模块：投掷 → 飞行 → 命中 → 拾回 全流程，耐久消耗与损坏判定，附魔效果。
 *
 * 对接目标（W8，IMP-8）：
 * - 复用 combat 的耐久接口（consumeDurability / weaponBroken）与 WeaponDef 契约。
 * - 全部纯函数、确定性：任何随机来源都经 createRng(seed) 派生，同 seed 同结果。
 * - 附魔：Loyalty（返回拾回）/ Riptide（冲刺加速）/ Channeling（引雷）/
 *   Impaling（对水生生物增伤）至少实现其中三个并有确定性场景断言（此处四个全实现）。
 */

import type { Difficulty } from "../survival/types";
import { meleeDamage } from "../survival/systems";
import type { Rng, SeedInput } from "../core/seed";
import { createRng } from "../core/seed";
import type { WeaponDef } from "./combat";
import { consumeDurability, weaponBroken } from "./combat";

/** 三叉戟附魔类型。 */
export type TridentEnchant = "loyalty" | "riptide" | "channeling" | "impaling";

/** 三叉戟飞行器阶段。 */
export type TridentPhase =
  | "flying" // 飞行中
  | "hit" // 命中目标
  | "stuck" // 达到射程落地（无 Loyalty 时等待物理拾回）
  | "returning" // Loyalty 返回途中
  | "picked"; // 已拾回（回到持有者）

/**
 * 三叉戟规格：既是 WeaponDef（复用耐久接口），另附弹道参数。
 * - damageHalfHearts 基础伤害（半心），maxDurability 250 贴近 Bedrock。
 */
export interface TridentSpec extends WeaponDef {
  readonly speedPerTick: number;
  readonly gravity: number;
  /** 投掷时的垂直初速加成（手抛抛物律）。 */
  readonly launchLift: number;
  /** Loyalty 返回速度。 */
  readonly returnSpeed: number;
  /** 命中判定半径（方块）。 */
  readonly hitRadius: number;
  /** 拾回半径（方块）。 */
  readonly pickupRadius: number;
  /** Riptide 冲刺位移（方块）。 */
  readonly riptideDash: number;
  /** Impaling 对水生生物附加的半心伤害（每级）。 */
  readonly impalingBonusHalfHearts: number;
  /** Channeling 引雷附加的半心伤害。 */
  readonly channelingStrikeHalfHearts: number;
}

export const TRIDENT: TridentSpec = {
  id: "trident",
  name: "三叉戟",
  damageHalfHearts: 9,
  durabilityCost: 1,
  maxDurability: 250,
  cooldownTicks: 12,
  rangeBlocks: 24,
  speedPerTick: 1.1,
  gravity: 0.045,
  launchLift: 0.12,
  returnSpeed: 2.6,
  hitRadius: 1.2,
  pickupRadius: 1.6,
  riptideDash: 8,
  impalingBonusHalfHearts: 9,
  channelingStrikeHalfHearts: 10,
};

/** 水生生物集合（Impaling 增伤对象，取自 EntityKind）。 */
export const AQUATIC_KINDS: ReadonlySet<string> = new Set([
  "dolphin",
  "cod",
  "fish_tropical",
  "pufferfish",
]);

/** 是否为水生生物（Impaling 增伤判定）。 */
export function isAquatic(kind: string): boolean {
  return AQUATIC_KINDS.has(kind);
}

/** 三叉戟飞行器快照（不可变）。 */
export interface TridentProjectile {
  readonly id: number;
  readonly ownerId: number;
  /** 已飞行 tick。 */
  readonly t: number;
  readonly origin: { x: number; y: number; z: number };
  readonly position: { x: number; y: number; z: number };
  readonly velocity: { x: number; y: number; z: number };
  /** 该次投掷消耗后剩余的耐久（随飞行不损耗，拾回时返还）。 */
  readonly durability: number;
  readonly enchant: ReadonlySet<TridentEnchant>;
  readonly phase: TridentPhase;
  readonly hitId: number | null;
  /** Channeling 触发引雷标记。 */
  readonly lightning: boolean;
  /** Impaling 附加伤害量（证据）。 */
  readonly impalingBonus: number;
}

/** 命中目标最小描述。 */
export interface ProjectileTarget {
  readonly id: number;
  readonly kind: string;
  readonly position: { x: number; y: number; z: number };
}

type Vec3 = { x: number; y: number; z: number };

function vlen(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** 投掷者（玩家）。 */
export interface TridentUser {
  readonly id: number;
  readonly position: Vec3;
}

/** 投掷输入。 */
export interface ThrowInput {
  readonly seed: SeedInput;
  readonly user: TridentUser;
  /** 投掷朝向（不必归一化）。 */
  readonly dir: Vec3;
  /** 投掷瞬间手持耐久。 */
  readonly durability: number;
  readonly enchant: ReadonlyArray<TridentEnchant>;
}

/** 投掷结果。 */
export interface ThrowResult {
  readonly proj: TridentProjectile | null;
  /** 本次投掷消耗的耐久。 */
  readonly usedDurability: number;
  /** 消耗后剩余耐久。 */
  readonly remainingDurability: number;
  /** 投掷后是否已损坏（无法投掷 => proj 为 null）。 */
  readonly broken: boolean;
  /** 派生的确定性 Rng（供弹道抖动，同 seed 可复现）。 */
  readonly rng: Rng;
}

/**
 * 投掷三叉戟：
 * - 复用 consumeDurability / weaponBroken 判定耐久消耗与损坏。
 * - 以 seed 派生 Rng，给初始朝向加同 seed 可复现的微小抖动。
 * - 朝向 dir 归一化后乘速度；三叉戟带轻微上抛（launchLift）。
 */
export function throwTrident(input: ThrowInput): ThrowResult {
  const rng = createRng(input.seed);
  // 同 seed 可复现的散布抖动（±0.02 弧度级的法向扰动）。
  const jitter = rng.range(-0.02, 0.02);
  const dir: Vec3 = {
    x: input.dir.x,
    y: input.dir.y + jitter,
    z: input.dir.z,
  };
  const len = vlen(dir) || 1;
  const speed = TRIDENT.speedPerTick;
  const velocity: Vec3 = {
    x: (dir.x / len) * speed,
    y: (dir.y / len) * speed + TRIDENT.launchLift,
    z: (dir.z / len) * speed,
  };

  const remaining = consumeDurability(TRIDENT, input.durability);
  const broken = weaponBroken(remaining);
  if (broken) {
    return {
      proj: null,
      usedDurability: TRIDENT.durabilityCost,
      remainingDurability: remaining,
      broken: true,
      rng,
    };
  }

  const proj: TridentProjectile = {
    id: 0,
    ownerId: input.user.id,
    t: 0,
    origin: { ...input.user.position },
    position: { ...input.user.position },
    velocity,
    durability: remaining,
    enchant: new Set(input.enchant),
    phase: "flying",
    hitId: null,
    lightning: false,
    impalingBonus: 0,
  };
  return {
    proj,
    usedDurability: TRIDENT.durabilityCost,
    remainingDurability: remaining,
    broken: false,
    rng,
  };
}

/**
 * 推进飞行一 tick（确定性物理）：
 * - 位置 += 速度；垂直速度受重力衰减。
 * - Riptide：每次推进追加冲刺（速度横向增强 + 少量上浮），表现为冲刺加速。
 * - 若水平距离超过射程：Loyalty → returning，否则 stuck。
 */
export function stepFlight(proj: TridentProjectile, tickDelta = 1): TridentProjectile {
  let vx = proj.velocity.x;
  let vy = proj.velocity.y - TRIDENT.gravity * tickDelta;
  let vz = proj.velocity.z;
  if (proj.enchant.has("riptide")) {
    // riptide 冲刺：水平速度增强并略微上浮（水流推进）。
    vx = vx * 1.2;
    vz = vz * 1.2;
    vy = vy * 1.1 + 0.03;
  }
  const position = {
    x: proj.position.x + vx * tickDelta,
    y: proj.position.y + vy * tickDelta,
    z: proj.position.z + vz * tickDelta,
  };
  const traveled = Math.hypot(
    position.x - proj.origin.x,
    position.z - proj.origin.z
  );
  let phase: TridentPhase = "flying";
  if (traveled >= TRIDENT.rangeBlocks) {
    phase = proj.enchant.has("loyalty") ? "returning" : "stuck";
  }
  return {
    ...proj,
    t: proj.t + tickDelta,
    position,
    velocity: { x: vx, y: vy, z: vz },
    phase,
  };
}

/** 命中判定：目标在 hitRadius 内。 */
export function hitCheck(proj: TridentProjectile, target: ProjectileTarget): boolean {
  const d = Math.hypot(
    proj.position.x - target.position.x,
    proj.position.y - target.position.y,
    proj.position.z - target.position.z
  );
  return d <= TRIDENT.hitRadius;
}

/**
 * 命中结算：
 * - 基础伤害 = TRIDENT.damageHalfHearts（来源 melee）。
 * - Impaling：对水生生物附加 TRIDENT.impalingBonusHalfHearts。
 * - Channeling：在雷暴天气触发引雷，附加 TRIDENT.channelingStrikeHalfHearts 并标记 lightning。
 * 返回命中后快照与非零伤害组件证据。
 */
export function resolveHit(
  proj: TridentProjectile,
  target: ProjectileTarget,
  weather: "clear" | "rain" | "thunderstorm"
): { proj: TridentProjectile; damageHalfHearts: number; scaled: number; impalingBonus: number; lightning: boolean } {
  let damage = TRIDENT.damageHalfHearts;
  let impalingBonus = 0;
  if (proj.enchant.has("impaling") && isAquatic(target.kind)) {
    impalingBonus = TRIDENT.impalingBonusHalfHearts;
    damage += impalingBonus;
  }
  let lightning = false;
  if (proj.enchant.has("channeling") && weather === "thunderstorm") {
    lightning = true;
    damage += TRIDENT.channelingStrikeHalfHearts;
  }
  const scaled = meleeDamage(damage).amount;
  return {
    proj: {
      ...proj,
      phase: "hit",
      hitId: target.id,
      lightning,
      impalingBonus,
    },
    damageHalfHearts: scaled,
    scaled,
    impalingBonus,
    lightning,
  };
}

/**
 * Loyalty 返回推进（向持有者移动，靠近后拾回）。
 */
export function stepReturn(
  proj: TridentProjectile,
  ownerPos: Vec3
): TridentProjectile {
  const dx = ownerPos.x - proj.position.x;
  const dy = ownerPos.y - proj.position.y;
  const dz = ownerPos.z - proj.position.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist <= TRIDENT.pickupRadius) {
    return { ...proj, phase: "picked", position: { ...ownerPos } };
  }
  const step = TRIDENT.returnSpeed;
  const nx = proj.position.x + (dx / dist) * step;
  const ny = proj.position.y + (dy / dist) * step;
  const nz = proj.position.z + (dz / dist) * step;
  return {
    ...proj,
    t: proj.t + 1,
    position: { x: nx, y: ny, z: nz },
    phase: "returning",
  };
}

/**
 * 拾回三叉戟：把飞行器剩余的耐久返还给持有者（Riptide 不触发返回，
 * Loyalty 或物理拾回后调用）。返回返还后的耐久。
 */
export function pickupTrident(proj: TridentProjectile): number {
  if (proj.phase === "picked" || proj.phase === "hit" || proj.phase === "stuck") {
    return proj.durability;
  }
  return proj.durability;
}

/**
 * Riptide 冲刺：玩家朝投掷方向位移（确定性，无随机）。
 * 返回冲刺后玩家位置。
 */
export function riptideDash(user: TridentUser, dir: Vec3): Vec3 {
  const len = vlen(dir) || 1;
  const d = TRIDENT.riptideDash;
  return {
    x: user.position.x + (dir.x / len) * d,
    y: user.position.y + (dir.y / len) * d * 0.5,
    z: user.position.z + (dir.z / len) * d,
  };
}
