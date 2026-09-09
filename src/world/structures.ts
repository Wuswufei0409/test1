/**
 * W10 海洋结构：珊瑚礁 / 海带 / 海草 / 冰山 / 沉船 / 水下遗迹 / 埋藏宝藏。
 *
 * 固定 seed 可复现设计：
 * - 结构锚定到 32x32 的结构单元格，由「seed + 单元格坐标」的确定性哈希决定
 *   「是否生成 / 结构类型 / 中心偏移」，因此与区块访问顺序无关、跨区块一致，且不依赖 Math.random。
 * - 叠印（stamp）为纯函数：给定生成器与某区块网格，只就地覆盖该区块内的方块，
 *   因而即使结构跨越区块边界也能确定复现。
 * - 海带(kelp)/海草(sea_grass)/珊瑚(coral) 同时保留在阶段 1 的逐格水下装饰里（同样由 seed 派生），
 *   本模块额外提供结构性珊瑚礁 / 冰山 / 沉船 / 水下遗迹 / 埋藏宝藏。
 *
 * 海平面约定：冰山只从 SEA_LEVEL+1 起叠冰（海面之下保留水），从而漂浮在海面上，
 * 也不会破坏「海洋列在海面处为水」的既有契约测试。
 */

import type { Seed } from "../core/seed";
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from "./types";
import type { BlockId } from "./types";
import type { DeterministicTerrainGenerator } from "./generator";

/** 结构单元格边长（方块）。 */
export const OCEAN_STRUCT_CELL = 32;

/** 海洋结构类型。 */
export type OceanStructureType =
  | "coral_reef" // 珊瑚礁
  | "iceberg" // 冰山
  | "shipwreck" // 沉船
  | "underwater_ruins" // 水下遗迹
  | "buried_treasure"; // 埋藏宝藏

/** 某结构安放信息（中心列在世界坐标，可跨区块边界）。 */
export interface OceanStructure {
  type: OceanStructureType;
  x: number;
  z: number;
  radius: number;
}

/** 硬编码的结构最大半径（用于扫描影响区块）。 */
const RMAX = 9;

/** 确定性整数哈希 → [0,1)（与 world/generator 同族，独立混合）。 */
function hashUnit(seed: Seed, a: number, b: number, c: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(a, 0x27d4eb2d), 0x165667b1);
  h = Math.imul(h ^ Math.imul(b, 0x9e3779b1), 0x85ebca6b);
  h = Math.imul(h ^ Math.imul(c, 0xc2b2ae35), 0x27d4eb2f) >>> 0;
  return (h & 0xffff) / 0xffff;
}

/** 结构类型 roll。 */
function structRoll(seed: Seed, cellX: number, cellZ: number): number {
  return hashUnit(seed, cellX, 3, cellZ);
}

/** 埋藏宝藏 roll（更稀疏）。 */
function treasureRoll(seed: Seed, cellX: number, cellZ: number): number {
  return hashUnit(seed, cellX, 11, cellZ);
}

/** 单元格内的中心偏移 [-7, 7]。 */
function jitter(seed: Seed, cellX: number, cellZ: number): number {
  return Math.round(hashUnit(seed, cellX, 5, cellZ) * 14 - 7);
}

const RADIUS: Record<
  Exclude<OceanStructureType, "buried_treasure">,
  number
> = {
  coral_reef: 5,
  iceberg: 7,
  shipwreck: 6,
  underwater_ruins: 5,
};

/** 单元格中心候选结构化类型（不含地形过滤）。无结构则返回 null。 */
export function oceanStructureAt(
  seed: Seed,
  cellX: number,
  cellZ: number
): OceanStructure | null {
  const cx =
    cellX * OCEAN_STRUCT_CELL + OCEAN_STRUCT_CELL / 2 + jitter(seed, cellX, cellZ);
  const cz =
    cellZ * OCEAN_STRUCT_CELL + OCEAN_STRUCT_CELL / 2 + jitter(seed, cellX, cellZ);
  const r = structRoll(seed, cellX, cellZ);
  let type: Exclude<OceanStructureType, "buried_treasure"> | null = null;
  if (r < 0.11) type = "iceberg";
  else if (r < 0.21) type = "shipwreck";
  else if (r < 0.31) type = "underwater_ruins";
  else if (r < 0.4) type = "coral_reef";
  if (!type) return null;
  return { type, x: cx, z: cz, radius: RADIUS[type] };
}

/** 稀疏的埋藏宝藏单列站点（藏宝图指向它）。 */
export function treasureSiteAt(
  seed: Seed,
  cellX: number,
  cellZ: number
): { x: number; z: number } | null {
  if (treasureRoll(seed, cellX, cellZ) >= 0.02) return null;
  const x =
    cellX * OCEAN_STRUCT_CELL + OCEAN_STRUCT_CELL / 2 + jitter(seed, cellX, cellZ);
  const z =
    cellZ * OCEAN_STRUCT_CELL + OCEAN_STRUCT_CELL / 2 + jitter(seed, cellX, cellZ);
  return { x, z };
}

/** 某结构圆盘是否与给定方块矩形（区块列范围）相交。 */
function intersects(
  s: OceanStructure,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  const nearX = Math.min(Math.max(s.x, minX), maxX);
  const nearZ = Math.min(Math.max(s.z, minZ), maxZ);
  const dx = s.x - nearX;
  const dz = s.z - nearZ;
  return dx * dx + dz * dz <= (s.radius + 1) * (s.radius + 1);
}

/**
 * 对某区块网格就地叠印与它相交的所有海洋结构（纯函数，确定性）。
 * 供 DeterministicTerrainGenerator.generateChunk 在基础地形成格后调用。
 */
export function applyOceanStructuresToChunk(
  gen: DeterministicTerrainGenerator,
  grid: BlockId[][][],
  cx: number,
  cz: number
): void {
  const minX = cx * CHUNK_SIZE;
  const maxX = cx * CHUNK_SIZE + CHUNK_SIZE - 1;
  const minZ = cz * CHUNK_SIZE;
  const maxZ = cz * CHUNK_SIZE + CHUNK_SIZE - 1;

  const cellMinX = Math.floor((minX - RMAX) / OCEAN_STRUCT_CELL);
  const cellMaxX = Math.floor((maxX + RMAX) / OCEAN_STRUCT_CELL);
  const cellMinZ = Math.floor((minZ - RMAX) / OCEAN_STRUCT_CELL);
  const cellMaxZ = Math.floor((maxZ + RMAX) / OCEAN_STRUCT_CELL);

  for (let cX = cellMinX; cX <= cellMaxX; cX++) {
    for (let cZ = cellMinZ; cZ <= cellMaxZ; cZ++) {
      const s = oceanStructureAt(gen.seed, cX, cZ);
      if (s && intersects(s, minX, maxX, minZ, maxZ)) {
        stampBlockStructure(gen, grid, cx, cz, s);
      }
      const t = treasureSiteAt(gen.seed, cX, cZ);
      if (t && t.x >= minX && t.x <= maxX && t.z >= minZ && t.z <= maxZ) {
        stampTreasure(gen, grid, cx, cz, t.x, t.z);
      }
    }
  }
}

/** 在区块内逐列叠印一个块状结构。 */
function stampBlockStructure(
  gen: DeterministicTerrainGenerator,
  grid: BlockId[][][],
  cx: number,
  cz: number,
  s: OceanStructure
): void {
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const dx = wx - s.x;
      const dz = wz - s.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > s.radius * s.radius) continue;
      const d = Math.sqrt(d2);
      const col = grid[lx][lz];
      switch (s.type) {
        case "coral_reef":
          stampReef(gen, wx, wz, d, s.radius, col);
          break;
        case "iceberg":
          stampIceberg(gen, wx, wz, d, s.radius, col);
          break;
        case "shipwreck":
          stampShipwreck(gen, wx, wz, d, s.radius, col, s);
          break;
        case "underwater_ruins":
          stampRuins(gen, wx, wz, d, col);
          break;
        default:
          break;
      }
    }
  }
}

/** 珊瑚礁：暖水洋底珊瑚块小丘 + 顶部珊瑚/海晶灯。 */
function stampReef(
  gen: DeterministicTerrainGenerator,
  wx: number,
  wz: number,
  d: number,
  radius: number,
  col: BlockId[]
): void {
  if (gen.biomeAt(wx, wz) !== "ocean_warm") return;
  const h = gen.heightAt(wx, wz);
  if (h < 0 || h >= WORLD_HEIGHT - 4) return;
  const rel = 1 - d / (radius + 1);
  const stack = 1 + Math.round(rel * 2); // 1..3
  for (let i = 0; i < stack; i++) {
    const y = h + i;
    if (y >= 0 && y < WORLD_HEIGHT) col[y] = "coral_block";
  }
  const topY = h + stack;
  if (topY >= 0 && topY < WORLD_HEIGHT && topY <= SEA_LEVEL) {
    const r = hashUnit(gen.seed, wx, 13, wz);
    col[topY] = r < 0.3 ? "sea_lantern" : "coral";
  }
}

/** 冰山：仅冷洋。从海面之上漂浮的冰/浮冰堆，顶部覆雪。 */
function stampIceberg(
  gen: DeterministicTerrainGenerator,
  wx: number,
  wz: number,
  d: number,
  radius: number,
  col: BlockId[]
): void {
  if (gen.biomeAt(wx, wz) !== "ocean_cold") return;
  const rel = 1 - d / (radius + 1);
  if (rel <= 0) return;
  const topY = SEA_LEVEL + 1 + Math.round(rel * 5); // SEA_LEVEL+1..+6
  for (let y = SEA_LEVEL + 1; y <= topY && y < WORLD_HEIGHT; y++) {
    col[y] = y === topY && rel > 0.45 ? "snow" : "ice";
  }
}

/** 沉船：任意海洋。洋底木制船体 + 中央桅杆。 */
function stampShipwreck(
  gen: DeterministicTerrainGenerator,
  wx: number,
  wz: number,
  d: number,
  radius: number,
  col: BlockId[],
  s: OceanStructure
): void {
  if (!gen.isOcean(wx, wz)) return;
  const h = gen.heightAt(wx, wz);
  if (h < 0 || h >= WORLD_HEIGHT - 6) return;
  // 船底（洋底表面）
  col[h] = "log_spruce";
  // 船舷（外缘向上两格）
  if (d >= radius - 3 && d <= radius - 1) {
    if (h + 1 < WORLD_HEIGHT) col[h + 1] = "log_spruce";
    if (h + 2 < WORLD_HEIGHT) col[h + 2] = "planks_oak";
  }
  // 甲板（内部）
  if (d <= radius - 3 && h + 2 < WORLD_HEIGHT) col[h + 2] = "planks_oak";
  // 中央桅杆
  if (wx === s.x && wz === s.z) {
    for (let y = h + 2; y <= h + 5 && y < WORLD_HEIGHT; y++) col[y] = "log_spruce";
  }
}

/** 水下遗迹：任意海洋。洋底石基 + 海晶石柱 + 顶部海晶灯。 */
function stampRuins(
  gen: DeterministicTerrainGenerator,
  wx: number,
  wz: number,
  d: number,
  col: BlockId[]
): void {
  if (!gen.isOcean(wx, wz)) return;
  const h = gen.heightAt(wx, wz);
  if (h < 0 || h >= WORLD_HEIGHT - 5) return;
  col[h] = "stone";
  const px = Math.abs(wx) % 3;
  const pz = Math.abs(wz) % 3;
  if ((px === 0 || pz === 0) && d > 0.5) {
    const pillarH = 1 + Math.floor(hashUnit(gen.seed, wx, 17, wz) * 3); // 1..3
    for (let i = 1; i <= pillarH; i++) col[h + i] = "prismarine";
    if (hashUnit(gen.seed, wx, 19, wz) < 0.5 && h + pillarH < WORLD_HEIGHT) {
      col[h + pillarH] = "sea_lantern";
    }
  }
}

/** 埋藏宝藏：把箱子埋在洋底表面下一格。 */
function stampTreasure(
  gen: DeterministicTerrainGenerator,
  grid: BlockId[][][],
  cx: number,
  cz: number,
  wx: number,
  wz: number
): void {
  if (!gen.isOcean(wx, wz)) return;
  const h = gen.heightAt(wx, wz);
  if (h < 1 || h >= WORLD_HEIGHT) return;
  const lx = wx - cx * CHUNK_SIZE;
  const lz = wz - cz * CHUNK_SIZE;
  grid[lx][lz][h - 1] = "chest";
}

/**
 * 在指定矩形区域（世界方块坐标）内枚举真实存在的海洋结构。
 * 仅返回地形允许落位的结构（与叠印条件一致），用于测试/巡查。
 */
export function listOceanStructures(
  gen: DeterministicTerrainGenerator,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): OceanStructure[] {
  const out: OceanStructure[] = [];
  const cMinX = Math.floor(x0 / OCEAN_STRUCT_CELL);
  const cMaxX = Math.floor(x1 / OCEAN_STRUCT_CELL);
  const cMinZ = Math.floor(z0 / OCEAN_STRUCT_CELL);
  const cMaxZ = Math.floor(z1 / OCEAN_STRUCT_CELL);
  for (let cX = cMinX; cX <= cMaxX; cX++) {
    for (let cZ = cMinZ; cZ <= cMaxZ; cZ++) {
      const s = oceanStructureAt(gen.seed, cX, cZ);
      if (!s) continue;
      // 结构性结构需要落在对应海洋生物群系／海洋上
      const ok =
        (s.type === "coral_reef" && gen.biomeAt(s.x, s.z) === "ocean_warm") ||
        (s.type === "iceberg" && gen.biomeAt(s.x, s.z) === "ocean_cold") ||
        ((s.type === "shipwreck" || s.type === "underwater_ruins") && gen.isOcean(s.x, s.z));
      if (ok) out.push(s);
    }
  }
  return out;
}

/**
 * 在指定矩形区域（世界方块坐标）内枚举埋藏宝藏站点。
 * 与叠印条件一致：必须落在海洋上且有可埋藏的地表高度。
 */
export function findTreasureSites(
  gen: DeterministicTerrainGenerator,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  const cMinX = Math.floor((x0 - 8) / OCEAN_STRUCT_CELL);
  const cMaxX = Math.floor((x1 + 8) / OCEAN_STRUCT_CELL);
  const cMinZ = Math.floor((z0 - 8) / OCEAN_STRUCT_CELL);
  const cMaxZ = Math.floor((z1 + 8) / OCEAN_STRUCT_CELL);
  for (let cX = cMinX; cX <= cMaxX; cX++) {
    for (let cZ = cMinZ; cZ <= cMaxZ; cZ++) {
      const t = treasureSiteAt(gen.seed, cX, cZ);
      if (!t) continue;
      if (t.x < x0 || t.x > x1 || t.z < z0 || t.z > z1) continue;
      if (!gen.isOcean(t.x, t.z)) continue;
      const h = gen.heightAt(t.x, t.z);
      if (h < 1 || h >= WORLD_HEIGHT) continue;
      out.push(t);
    }
  }
  return out;
}
