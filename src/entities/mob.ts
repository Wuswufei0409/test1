/**
 * 生物定义与生成规则（对接目标 11）。
 *
 * 约定：
 * - 生物配置化定义（生命、速度、攻击力、被动/敌对、昼夜生成窗口、可否游泳）。
 * - 敌对生物在夜间、白昼亡灵燃烧；生成数量受难度影响（复用 W3 难度矩阵）。
 * - 全部为纯函数/确定性：同 seed + 同时间 + 同输入 => 同生成结果。
 */

import type { EntityKind } from "./types";
import type { Difficulty } from "../survival/types";
import { DIFFICULTY_ALLOW_HOSTILE_DAMAGE } from "../survival/systems";
import { isDay, isNight, skyBrightness } from "../world/cycle";
import type { WorldTime } from "../core/tick";
import type { Rng } from "../core/seed";

/** 可生成的生物种类（排除 player）。 */
export type MobKind = Exclude<EntityKind, "player">;

/** 生物阵营。 */
export type MobDisposition = "passive" | "neutral" | "hostile";

/** 生物行为参数。 */
export interface MobDef {
  readonly kind: EntityKind;
  readonly disposition: MobDisposition;
  /** 最大生命（点，1 点 = 1 半心）。 */
  readonly maxHealth: number;
  /** 近战基础伤害（半心）。 */
  readonly attackHalfHearts: number;
  /** 移动速度（方块/秒）。 */
  readonly speed: number;
  /** 是否白天生成。 */
  readonly spawnDay: boolean;
  /** 是否夜晚生成。 */
  readonly spawnNight: boolean;
  /** 是否白天因日光燃烧（亡灵）。 */
  readonly burnsInDaylight: boolean;
  /** 亮度阈值：被动/中立要求 >= minBrightness（白天）；敌对要求 <= maxBrightness（黑暗处生成）。 */
  readonly minBrightness: number;
  readonly maxBrightness: number;
  /** 是否水生生物（可游泳生成）。 */
  readonly aquatic: boolean;
  /** 配置化掉落（item id 简单占位，阶段 1 扩展）。 */
  readonly drops: ReadonlyArray<{ item: string; chance: number; min: number; max: number }>;
}

/** 生物配置表（目标 11 覆盖：猪/牛/羊/鸡、僵尸/蜘蛛/爬行者）。 */
export const MOBS: Readonly<Record<MobKind, MobDef>> = {
  pig: {
    kind: "pig", disposition: "passive", maxHealth: 10, attackHalfHearts: 0,
    speed: 1.5, spawnDay: true, spawnNight: false, burnsInDaylight: false,
    minBrightness: 0.4, maxBrightness: 1, aquatic: false, drops: [{ item: "raw_porkchop", chance: 1, min: 1, max: 2 }],
  },
  cow: {
    kind: "cow", disposition: "passive", maxHealth: 10, attackHalfHearts: 0,
    speed: 1.5, spawnDay: true, spawnNight: false, burnsInDaylight: false,
    minBrightness: 0.4, maxBrightness: 1, aquatic: false, drops: [{ item: "raw_beef", chance: 1, min: 1, max: 2 }],
  },
  sheep: {
    kind: "sheep", disposition: "passive", maxHealth: 8, attackHalfHearts: 0,
    speed: 1.3, spawnDay: true, spawnNight: false, burnsInDaylight: false,
    minBrightness: 0.4, maxBrightness: 1, aquatic: false, drops: [{ item: "wool", chance: 1, min: 1, max: 1 }],
  },
  chicken: {
    kind: "chicken", disposition: "passive", maxHealth: 4, attackHalfHearts: 0,
    speed: 1.4, spawnDay: true, spawnNight: false, burnsInDaylight: false,
    minBrightness: 0.4, maxBrightness: 1, aquatic: false, drops: [{ item: "feather", chance: 1, min: 0, max: 2 }],
  },
  zombie: {
    kind: "zombie", disposition: "hostile", maxHealth: 20, attackHalfHearts: 4,
    speed: 1.7, spawnDay: false, spawnNight: true, burnsInDaylight: true,
    minBrightness: 0.1, maxBrightness: 0.5, aquatic: false, drops: [{ item: "rotten_flesh", chance: 1, min: 0, max: 2 }],
  },
  spider: {
    kind: "spider", disposition: "hostile", maxHealth: 16, attackHalfHearts: 3,
    speed: 2.2, spawnDay: false, spawnNight: true, burnsInDaylight: false,
    minBrightness: 0.1, maxBrightness: 0.5, aquatic: false, drops: [{ item: "string", chance: 1, min: 0, max: 2 }],
  },
  creeper: {
    kind: "creeper", disposition: "hostile", maxHealth: 20, attackHalfHearts: 0,
    speed: 1.6, spawnDay: false, spawnNight: true, burnsInDaylight: false,
    minBrightness: 0.1, maxBrightness: 0.5, aquatic: false, drops: [{ item: "gunpowder", chance: 1, min: 0, max: 2 }],
  },
  dolphin: {
    kind: "dolphin", disposition: "passive", maxHealth: 10, attackHalfHearts: 0,
    speed: 2.8, spawnDay: true, spawnNight: true, burnsInDaylight: false,
    minBrightness: 0, maxBrightness: 1, aquatic: true, drops: [],
  },
  cod: {
    kind: "cod", disposition: "passive", maxHealth: 3, attackHalfHearts: 0,
    speed: 1.2, spawnDay: true, spawnNight: true, burnsInDaylight: false,
    minBrightness: 0, maxBrightness: 1, aquatic: true, drops: [],
  },
  fish_tropical: {
    kind: "fish_tropical", disposition: "passive", maxHealth: 3, attackHalfHearts: 0,
    speed: 1.2, spawnDay: true, spawnNight: true, burnsInDaylight: false,
    minBrightness: 0, maxBrightness: 1, aquatic: true, drops: [],
  },
  pufferfish: {
    kind: "pufferfish", disposition: "neutral", maxHealth: 3, attackHalfHearts: 0,
    speed: 1.2, spawnDay: true, spawnNight: true, burnsInDaylight: false,
    minBrightness: 0, maxBrightness: 1, aquatic: true, drops: [],
  },
};

/** 目标 11 要求的核心生物集合（用于证据断言）。 */
export const REQUIRED_CORE_MOBS: readonly MobKind[] = [
  "pig", "cow", "sheep", "chicken", "zombie", "spider", "creeper",
];

/** 敌对生物白昼是否燃烧（验收 10：白天部分亡灵燃烧）。 */
export function burnsInDaylight(kind: MobKind, t: WorldTime): boolean {
  const def = MOBS[kind];
  return def.burnsInDaylight && isDay(t) && skyBrightness(t) > 0.5;
}

/**
 * 某生物在当前时间/亮度下是否可生成。
 * 敌对生物受难度闸门约束（peaceful 不生成敌对），且要求亮度低（夜间、黑暗处）。
 */
export function canSpawn(
  kind: MobKind,
  t: WorldTime,
  brightness: number,
  difficulty: Difficulty
): boolean {
  const def = MOBS[kind];
  if (def.disposition === "hostile" && !DIFFICULTY_ALLOW_HOSTILE_DAMAGE[difficulty]) {
    return false;
  }
  const timeOk = (isDay(t) && def.spawnDay) || (isNight(t) && def.spawnNight);
  const brightnessOk =
    def.disposition === "hostile"
      ? brightness <= def.maxBrightness
      : brightness >= def.minBrightness;
  return timeOk && brightnessOk;
}

/**
 * 从候选生物中按确定性规则选出一个进行生成。
 * 敌对生物偏向夜间，被动生物偏向白天。
 * 返回 null 表示当前无合适生成目标。
 */
export function chooseMobToSpawn(
  candidates: readonly MobKind[],
  t: WorldTime,
  brightness: number,
  difficulty: Difficulty,
  rng: Rng
): EntityKind | null {
  const eligible = candidates.filter((k) =>
    canSpawn(k, t, brightness, difficulty)
  );
  if (eligible.length === 0) return null;
  return eligible[rng.int(eligible.length)];
}

/** 按难度缩放敌对生成权重：normal/hard 更多，peaceful/easy 更少。 */
export function hostileSpawnWeight(difficulty: Difficulty): number {
  switch (difficulty) {
    case "peaceful": return 0;
    case "easy": return 1;
    case "normal": return 2;
    case "hard": return 3;
  }
}

/** 生物配置查询。 */
export function mobDef(kind: MobKind): MobDef {
  return MOBS[kind];
}
