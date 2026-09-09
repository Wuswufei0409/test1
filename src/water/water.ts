/**
 * 水体核心逻辑：能见度 / 氧气 / 溺水 / 疾跑游泳 / 1×1 水道 / 掉落物上浮 /
 * 水下放置不产生错误空气洞。
 *
 * 对接（W9，IMP-9）：全部纯函数、确定性，便于 vitest 断言。
 * 氧气与溺水复用生存模块（src/survival/systems.ts）的常数与原语，
 * 保持数值一致。
 */

import type { BlockPos, WorldRead } from "../world/types";
import type { ItemId } from "../items/types";
import {
  AIR_DRAIN_PER_TICK,
  AIR_REGAIN_PER_TICK,
  DROWN_DAMAGE_INTERVAL_TICKS,
  freshSurvival,
  applyDamageTo,
  drownDamage,
  type SurvivalState,
} from "../survival/systems";
import type {
  AirHole,
  CellKind,
  DroppedItem,
  PlaceUnderwaterResult,
  SwimInput,
  SwimState,
  SwimStepResult,
  WaterGrid,
  WaterVisibility,
} from "./types";

/* ------------------------------------------------------------------ *
 * 1. 水下能见度
 * ------------------------------------------------------------------ */

export const WATER_VIS = {
  /** 刚入水（或未入水）时的可见距离（方块）。 */
  maxFog: 15,
  /** 深水最小可见距离（方块）。 */
  minFog: 2,
  /** 每深 1 格可见距离衰减。 */
  fadePerBlock: 0.8,
  /** 水下雾色（偏蓝）。 */
  fogColor: 0x2f6fb0,
} as const;

/**
 * 计算玩家眼格处的水下能见度。
 * 头部没入水中时，可见距离随深度减小；未入水时为完全距离。
 */
export function computeVisibility(
  world: WorldRead,
  eye: BlockPos
): WaterVisibility {
  let depth = 0;
  let y = eye.y;
  while (world.getBlock({ x: eye.x, y, z: eye.z }) === "water") {
    depth += 1;
    y -= 1;
    if (depth > 64) break;
  }
  const submerged = depth >= 1;
  const fogDistance = !submerged
    ? WATER_VIS.maxFog
    : Math.max(
        WATER_VIS.minFog,
        Math.round(WATER_VIS.maxFog - (depth - 1) * WATER_VIS.fadePerBlock)
      );
  return {
    submerged,
    fogDistance: Math.min(WATER_VIS.maxFog, fogDistance),
    fogColor: WATER_VIS.fogColor,
    depth,
  };
}

/* ------------------------------------------------------------------ *
 * 2. 氧气条 + 溺水流程（复用生存模块原语）
 * ------------------------------------------------------------------ */

/** 氧气条读数。 */
export interface OxygenBar {
  current: number;
  max: number;
  /** 剩余比例 [0,1]，用于 HUD 进度。 */
  ratio: number;
  /** 是否处于空气耗尽（溺水）状态。 */
  depleted: boolean;
}

/** 从生存状态读取氧气条。 */
export function oxygenBar(state: SurvivalState): OxygenBar {
  return {
    current: state.air.value,
    max: state.air.max,
    ratio: state.air.max > 0 ? state.air.value / state.air.max : 0,
    depleted: state.air.value <= 0,
  };
}

/** 溺水流程累计器。 */
export interface DrownFlow {
  survival: SurvivalState;
  /** 空气耗尽后的溺水 tick 累计。 */
  drownTicks: number;
  /** 累计溺水半心伤害。 */
  drownHalfHearts: number;
  /** 本 tick 是否触发了一次溺水伤害。 */
  hurtThisTick: boolean;
}

/** 新建初始溺水流程（满血满氧）。 */
export function freshDrownFlow(): DrownFlow {
  return {
    survival: freshSurvival(),
    drownTicks: 0,
    drownHalfHearts: 0,
    hurtThisTick: false,
  };
}

/**
 * 推进一个 tick 的溺水流程（确定性）。
 * - 水中：氧气每 tick 消耗 AIR_DRAIN_PER_TICK；出水：每 tick 恢复 AIR_REGAIN_PER_TICK。
 * - 空气耗尽后溺水 tick 累计，每 DROWN_DAMAGE_INTERVAL_TICKS 造成 1 半心溺水伤害。
 * 返回下一状态；via 复用生存模块的 tickAir / drownDamage / applyDamageTo。
 */
export function tickDrownFlow(flow: DrownFlow, inWater: boolean): DrownFlow {
  let survival = flow.survival;
  if (inWater) {
    survival = {
      ...survival,
      air: {
        value: Math.max(0, survival.air.value - AIR_DRAIN_PER_TICK),
        max: survival.air.max,
      },
    };
  } else {
    survival = {
      ...survival,
      air: {
        value: Math.min(survival.air.max, survival.air.value + AIR_REGAIN_PER_TICK),
        max: survival.air.max,
      },
    };
  }

  let drownTicks = flow.drownTicks;
  let hurt = false;
  if (survival.air.value <= 0 && survival.alive) {
    drownTicks += 1;
    if (drownTicks >= DROWN_DAMAGE_INTERVAL_TICKS) {
      drownTicks = 0;
      survival = applyDamageTo(survival, drownDamage());
      hurt = true;
    }
  } else {
    drownTicks = 0;
  }

  return {
    survival,
    drownTicks,
    drownHalfHearts: flow.drownHalfHearts + (hurt ? 1 : 0),
    hurtThisTick: hurt,
  };
}

/* ------------------------------------------------------------------ *
 * 3. 疾跑游泳 + 1×1 水道通行
 * ------------------------------------------------------------------ */

export const SWIM = {
  /** 普通游泳水平速度（方块/tick）。 */
  baseSwimSpeed: 0.3,
  /** 疾跑游泳倍率（按住疾跑）。 */
  sprintSwimMultiplier: 2.0,
  /** 上浮初速度（方块/tick，按住跳跃）。 */
  swimUpVelocity: 0.5,
  /** 下潜速度（方块/tick，按住下蹲）。 */
  diveDownVelocity: -0.42,
  /** 无输入时的垂直拖曳（趋向静止）。 */
  verticalDrag: 0.92,
  /** 游泳碰撞箱宽/高（方块，小于 1 因此可穿过 1×1 开口）。 */
  hitboxSize: 0.6,
} as const;

/** 初始游泳状态。 */
export function freshSwimState(): SwimState {
  return { vy: 0, surfacing: false, diving: false };
}

/**
 * 游泳单步运动（确定性）。
 * - 水平速度：基础游泳，或按住疾跑时乘以疾跑倍率。
 * - 垂直：按跳跃上浮，按蹲下潜，无输入时施加拖曳。
 */
export function swimStep(
  prev: SwimState | null,
  input: SwimInput
): SwimStepResult {
  const speed = input.sprint
    ? SWIM.baseSwimSpeed * SWIM.sprintSwimMultiplier
    : SWIM.baseSwimSpeed;

  // 水平方向（以 -Z 为前方，axis-agostic 合成）。
  let fx = 0;
  let fz = 0;
  if (input.forward) fz -= 1;
  if (input.back) fz += 1;
  if (input.left) fx -= 1;
  if (input.right) fx += 1;
  const len = Math.hypot(fx, fz);
  let hx = 0;
  let hz = 0;
  if (len > 0) {
    hx = (fx / len) * speed;
    hz = (fz / len) * speed;
  }

  let vy = prev ? prev.vy : 0;
  let surfacing = false;
  let diving = false;
  if (input.jump && input.sprint) {
    surfacing = true;
    vy = SWIM.swimUpVelocity;
  } else if (input.sneak) {
    diving = true;
    vy = SWIM.diveDownVelocity;
  } else {
    vy *= SWIM.verticalDrag;
  }

  const dy = vy;
  return {
    state: { vy, surfacing, diving },
    hx,
    hz,
    dy,
    speed,
    sprintSwim: input.sprint,
    surfacing,
    diving,
  };
}

/**
 * 判定一段 1×1 水道（单列）能否被游泳玩家通过。
 * 游泳碰撞箱（0.6）可容纳于 1 格宽开口；任一列出现实心则阻断。
 */
export function channelPassable(tiles: readonly CellKind[]): boolean {
  return tiles.every((t) => t !== "solid");
}

/**
 * 计算二维水格切片中指定行（Y）最长的 1 宽可通行水道长度。
 * 用于断言「1×1 水道可全程通行」。
 */
export function longestPassableChannel(grid: WaterGrid, row: number): number {
  if (row < 0 || row >= grid.rows) return 0;
  let best = 0;
  let cur = 0;
  for (let c = 0; c < grid.cols; c++) {
    if (grid.cells[row][c] !== "solid") {
      cur += 1;
    } else {
      best = Math.max(best, cur);
      cur = 0;
    }
  }
  return Math.max(best, cur);
}

/* ------------------------------------------------------------------ *
 * 4. 掉落物上浮（浮力）
 * ------------------------------------------------------------------ */

export const FLOAT = {
  /** 上浮速度（方块/tick）。 */
  risePerTick: 0.15,
} as const;

/** 掉落物是否下沉（当前默认全部上浮，贴近游戏行为）。 */
export function itemSinks(_item: ItemId): boolean {
  return false;
}

/**
 * 掉落物浮力推进：处于水中的掉落物每 tick 向水面上升，
 * 到达水面后保持稳定（不再继续上升）。
 */
export function floatItem(item: DroppedItem, surfaceY: number): DroppedItem {
  if (!item.inWater || itemSinks(item.item)) return item;
  return {
    ...item,
    y: Math.min(surfaceY, item.y + FLOAT.risePerTick),
  };
}

/* ------------------------------------------------------------------ *
 * 5. 水下放置方块不产生错误空气洞
 * ------------------------------------------------------------------ */

/** 由纯水 + 纯空气层 + 底部构建基础水格切片。 */
export function buildWaterGrid(
  cols: number,
  waterDepth: number,
  airRows: number
): WaterGrid {
  const rows = waterDepth + airRows;
  const cells: CellKind[][] = [];
  for (let r = 0; r < rows; r++) {
    const kind: CellKind = r < waterDepth ? "water" : "air";
    cells.push(new Array<CellKind>(cols).fill(kind));
  }
  return { rows, cols, cells };
}

function cloneGrid(grid: WaterGrid): WaterGrid {
  return {
    rows: grid.rows,
    cols: grid.cols,
    cells: grid.cells.map((row) => row.slice()),
  };
}

/**
 * 计算每个格子是否「从表层可达」（通过 air/water 四邻连通到最顶层空气行）。
 * 用于识别与表层断连的封闭空气洞。
 */
function surfaceReachable(grid: WaterGrid): boolean[][] {
  const reach: boolean[][] = grid.cells.map((row) => row.map(() => false));
  const queue: Array<[number, number]> = [];
  // 起点：最顶层一行（表层天空）中的 air / water 格。
  const top = grid.rows - 1;
  for (let c = 0; c < grid.cols; c++) {
    const kind = grid.cells[top][c];
    if (kind === "air" || kind === "water") {
      reach[top][c] = true;
      queue.push([top, c]);
    }
  }
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (queue.length > 0) {
    const [r, c] = queue.pop()!;
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) continue;
      if (reach[nr][nc]) continue;
      const kind = grid.cells[nr][nc];
      if (kind === "air" || kind === "water") {
        reach[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }
  return reach;
}

/**
 * 找出切片中所有「错误空气洞」：即不与表层连通的封闭空气格。
 * 这些是本应保持水体、却被错误挖空/隔断的位置。
 */
export function findAirHoles(grid: WaterGrid): AirHole[] {
  const reach = surfaceReachable(grid);
  const holes: AirHole[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[r][c] === "air" && !reach[r][c]) {
        holes.push({ row: r, col: c });
      }
    }
  }
  return holes;
}

/**
 * 水下放置一个实心方块（water -> solid）。
 *
 * 放置后校正：任何因放置而与表层断连、导致水体出现封闭空气洞的格子
 * 都会被回填为 water，从而保证「水下放置方块不产生错误空气洞」。
 */
export function placeUnderwater(
  grid: WaterGrid,
  row: number,
  col: number
): PlaceUnderwaterResult {
  const g = cloneGrid(grid);
  if (row < 0 || row >= g.rows || col < 0 || col >= g.cols) {
    return { grid: g, backfilled: 0 };
  }
  g.cells[row][col] = "solid";
  let backfilled = 0;
  for (const hole of findAirHoles(g)) {
    if (g.cells[hole.row][hole.col] === "air") {
      g.cells[hole.row][hole.col] = "water";
      backfilled += 1;
    }
  }
  return { grid: g, backfilled };
}
