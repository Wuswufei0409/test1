/**
 * W10 埋藏宝藏：藏宝图（确定性线索）+ 挖掘奖励。
 *
 * - 藏宝图（或等价线索）确定性引导：每个宝藏站点由 seed 派生一个「地标 + 相对步数」线索，
 *   `resolveTreasureClue` 与 `makeTreasureClue` 均由同一 seed 重算地标，因此解析结果 == 目标站点，
 *   满足「确定性引导到目标位置」的验收。
 * - 挖掘奖励：`digBuriedTreasure` 检查该站点洋底表面下是否埋有箱子；若有则用 seed+站点派生
 *   的确定性 RNG 抽取战利品（可矿石/海洋之心/鹦鹉螺壳/藏宝图等）。
 * - 全部纯逻辑、确定性：相同 seed + 相同站点 => 相同奖励与相同线索。
 */

import type { Seed } from "../core/seed";
import { createRng, hashSeed } from "../core/seed";
import type { ItemStack } from "../items/types";
import type { WorldRead } from "./types";

/** 藏宝图上的单个站点线索。 */
export interface BuriedTreasureClue {
  /** 地标（起点）——由 seed 确定性派生。 */
  landmarkX: number;
  landmarkZ: number;
  /** 从地标到宝藏的东西 / 南北步数。 */
  stepsX: number;
  stepsZ: number;
  /** 人类可读提示（含数字标记）。 */
  label: string;
}

/** 藏宝图：包含区域内的每个宝藏站点及其线索。 */
export interface TreasureMapEntry {
  site: { x: number; z: number };
  clue: BuriedTreasureClue;
}

/** 由 seed 派生地标起点（确定性）。 */
export function treasureLandmark(seed: Seed): { x: number; z: number } {
  const rng = createRng(hashSeed(`treasure:landmark:${seed >>> 0}`));
  return { x: rng.int(32768), z: rng.int(32768) };
}

/** 为某宝藏站点生成确定性线索（藏宝图条目）。 */
export function makeTreasureClue(
  site: { x: number; z: number },
  seed: Seed
): BuriedTreasureClue {
  const lm = treasureLandmark(seed);
  const stepsX = site.x - lm.x;
  const stepsZ = site.z - lm.z;
  const ew = stepsX >= 0 ? "东" : "西";
  const ns = stepsZ >= 0 ? "南" : "北";
  const label = `从 (${lm.x}, ${lm.z}) 出发，向${ew} ${Math.abs(stepsX)} 格、向${ns} ${Math.abs(stepsZ)} 格，X 标记处下挖。`;
  return { landmarkX: lm.x, landmarkZ: lm.z, stepsX, stepsZ, label };
}

/** 解析线索 -> 目标站点（确定性，与生成一致）。 */
export function resolveTreasureClue(
  clue: BuriedTreasureClue,
  seed: Seed
): { x: number; z: number } {
  const lm = treasureLandmark(seed);
  return { x: lm.x + clue.stepsX, z: lm.z + clue.stepsZ };
}

/**
 * 生成某矩形区域的藏宝图（站点 + 线索）。region 为世界方块坐标。
 * 需要提供宝藏站点发现函数（避免与生成器耦合，由调用方注入）。
 */
export function makeTreasureMap(
  seed: Seed,
  sites: Array<{ x: number; z: number }>
): TreasureMapEntry[] {
  return sites.map((site) => ({ site, clue: makeTreasureClue(site, seed) }));
}

/* ---------------- 挖掘奖励 ---------------- */

const LOOT_TABLE: Array<{ id: ItemStack["id"]; weight: number; max: number }> = [
  { id: "gold_ingot", weight: 20, max: 4 },
  { id: "iron_ingot", weight: 18, max: 4 },
  { id: "emerald", weight: 14, max: 3 },
  { id: "diamond", weight: 8, max: 2 },
  { id: "coal", weight: 24, max: 6 },
  { id: "lapis", weight: 12, max: 5 },
  { id: "bone", weight: 12, max: 4 },
  { id: "nautilus_shell", weight: 4, max: 1 },
  { id: "heart_of_the_sea", weight: 2, max: 1 },
  { id: "treasure_map", weight: 3, max: 1 },
  { id: "bread", weight: 8, max: 2 },
];

/** 单个确定性战利品抽取。 */
function rollLoot(rng: ReturnType<typeof createRng>): ItemStack {
  const total = LOOT_TABLE.reduce((s, e) => s + e.weight, 0);
  let pick = rng.range(0, total);
  for (const e of LOOT_TABLE) {
    if (pick < e.weight) {
      const count = 1 + rng.int(e.max) % e.max;
      return { id: e.id, count };
    }
    pick -= e.weight;
  }
  return { id: "gold_ingot", count: 1 };
}

/**
 * 挖掘埋藏宝藏：若 (x, z) 洋底表面下埋有箱子则返回确定性战利品，否则返回空数组。
 */
export function digBuriedTreasure(
  world: WorldRead,
  x: number,
  z: number,
  seed: Seed
): ItemStack[] {
  const h = world.getHeight(x, z);
  if (h < 1) return [];
  if (world.getBlock({ x, y: h - 1, z }) !== "chest") return [];
  const rng = createRng(hashSeed(`treasure:loot:${seed >>> 0}:${x}:${z}`));
  const count = 3 + rng.int(3); // 3..5 个战利品
  const loot: ItemStack[] = [];
  for (let i = 0; i < count; i++) loot.push(rollLoot(rng));
  return loot;
}

/** 在所有给定站点中，找出真实埋有箱子的站点（作用于世界）。 */
export function validTreasureSites(
  world: WorldRead,
  sites: Array<{ x: number; z: number }>
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (const s of sites) {
    const h = world.getHeight(s.x, s.z);
    if (h >= 1 && world.getBlock({ x: s.x, y: h - 1, z: s.z }) === "chest") out.push(s);
  }
  return out;
}
