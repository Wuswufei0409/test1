/**
 * 水体核心模块测试（W9，IMP-9）。
 *
 * 覆盖 4 条验收标准：
 *  1) 水下能见度 / 氧气条 / 溺水流程确定性测试通过
 *  2) 疾跑游泳与 1×1 水道通行、掉落物上浮测试通过
 *  3) 方块在水下放置不产生错误空气洞，vitest 断言
 *  4) typecheck + 相关测试全绿（分支/PR 路由键 IMP-9）
 */

import { describe, it, expect } from "vitest";
import {
  computeVisibility,
  oxygenBar,
  freshDrownFlow,
  tickDrownFlow,
  swimStep,
  freshSwimState,
  channelPassable,
  longestPassableChannel,
  floatItem,
  buildWaterGrid,
  findAirHoles,
  placeUnderwater,
  WATER_VIS,
  SWIM,
} from "../../src/water/water";
import type { DroppedItem } from "../../src/water/types";
import {
  MAX_AIR,
  DROWN_DAMAGE_INTERVAL_TICKS,
} from "../../src/survival/systems";
import type { WorldRead, BlockId } from "../../src/world/types";

/* ------------------------------------------------------------------ *
 * 1. 水下能见度 / 氧气条 / 溺水流程（确定性）
 * ------------------------------------------------------------------ */

function columnWorld(): WorldRead {
  // y 5..9 为水，>9 为空气，<5 为实心。眼格深度可测。
  const idOf = (y: number): BlockId =>
    y >= 5 && y <= 9 ? "water" : y > 9 ? "air" : "stone";
  return {
    seed: 0 as never,
    getBlock: (p: { x: number; y: number; z: number }) => idOf(p.y),
    getBiome: () => "plains",
    getHeight: () => 0,
    isSolid: (p) => idOf(p.y) === "stone",
  };
}

describe("water: underwater visibility (确定性)", () => {
  const world = columnWorld();

  it("未入水时不 submerged 且保持完整能见距离", () => {
    const v = computeVisibility(world, { x: 0, y: 12, z: 0 });
    expect(v.submerged).toBe(false);
    expect(v.depth).toBe(0);
    expect(v.fogDistance).toBe(WATER_VIS.maxFog);
  });

  it("入水后深度随眼格下降而增加", () => {
    const v = computeVisibility(world, { x: 0, y: 8, z: 0 });
    expect(v.submerged).toBe(true);
    expect(v.depth).toBeGreaterThanOrEqual(1);
  });

  it("越深能见距离越小（雾更浓）", () => {
    // 浅水：仅 1 层水（depth=1）；深水：5 层水（depth=5）。
    const shallowWorld: WorldRead = {
      seed: 0 as never,
      getBlock: (p) => (p.y === 9 ? "water" : p.y > 9 ? "air" : "stone"),
      getBiome: () => "plains",
      getHeight: () => 0,
      isSolid: (p) => p.y !== 9 && p.y <= 9,
    };
    const shallow = computeVisibility(shallowWorld, { x: 0, y: 9, z: 0 });
    const deep = computeVisibility(world, { x: 0, y: 9, z: 0 }); // 5 层水列
    expect(shallow.depth).toBe(1);
    expect(deep.depth).toBeGreaterThan(shallow.depth);
    expect(shallow.submerged).toBe(true);
    expect(deep.submerged).toBe(true);
    expect(shallow.fogDistance).toBeGreaterThan(deep.fogDistance);
    expect(deep.fogDistance).toBeGreaterThanOrEqual(WATER_VIS.minFog);
  });
});

describe("water: oxygen bar + drowning flow (确定性)", () => {
  it("初始氧气条为满，比例=1，未耗尽", () => {
    const bar = oxygenBar(freshDrownFlow().survival);
    expect(bar.current).toBe(MAX_AIR);
    expect(bar.max).toBe(MAX_AIR);
    expect(bar.ratio).toBe(1);
    expect(bar.depleted).toBe(false);
  });

  it("水中逐 tick 消耗氧气直至耗尽并判为 depleted", () => {
    let flow = freshDrownFlow();
    // 满氧 +10 时水中每 tick 耗 1 → 经过 MAX_AIR tick 后归零。
    for (let i = 0; i < MAX_AIR; i++) {
      flow = tickDrownFlow(flow, true);
    }
    const bar = oxygenBar(flow.survival);
    expect(bar.depleted).toBe(true);
    expect(bar.ratio).toBe(0);
    expect(flow.survival.alive).toBe(true);
  });

  it("出水后氧气逐步恢复", () => {
    let flow = freshDrownFlow();
    for (let i = 0; i < MAX_AIR; i++) flow = tickDrownFlow(flow, true);
    // 出水一段后回升
    for (let i = 0; i < 4; i++) flow = tickDrownFlow(flow, false);
    const bar = oxygenBar(flow.survival);
    expect(bar.current).toBeGreaterThan(0);
    expect(bar.current).toBeLessThanOrEqual(flow.survival.air.max);
  });

  it("空气耗尽后经 DROWN_DAMAGE_INTERVAL_TICKS 周期性造成溺水伤害（确定性）", () => {
    let flow = freshDrownFlow();
    // 先耗氧。
    for (let i = 0; i < MAX_AIR; i++) flow = tickDrownFlow(flow, true);
    const before = flow.survival.health.value;
    // 再连续溺水约 2 个伤害周期 - 1，应触发至少一次伤害。
    for (let i = 0; i < DROWN_DAMAGE_INTERVAL_TICKS * 2 - 1; i++) {
      flow = tickDrownFlow(flow, true);
    }
    expect(flow.survival.alive).toBe(true);
    expect(flow.survival.health.value).toBeLessThan(before);
    expect(flow.drownHalfHearts).toBeGreaterThan(0);
    expect(flow.hurtThisTick).toBe(true); // 恰在伤害 tick
  });

  it("溺水伤害按固定周期重复且不会超过 0 生命翻转为死亡前仍 alive", () => {
    let flow = freshDrownFlow();
    for (let i = 0; i < MAX_AIR; i++) flow = tickDrownFlow(flow, true);
    const firstHalf = flow.drownHalfHearts;
    for (let i = 0; i < DROWN_DAMAGE_INTERVAL_TICKS; i++) flow = tickDrownFlow(flow, true);
    expect(flow.drownHalfHearts).toBe(firstHalf + 1);
  });
});

/* ------------------------------------------------------------------ *
 * 2. 疾跑游泳 / 1×1 水道 / 掉落物上浮
 * ------------------------------------------------------------------ */

describe("water: sprint swim", () => {
  it("普通游泳以基础速度前进", () => {
    const r = swimStep(freshSwimState(), {
      forward: true, back: false, left: false, right: false,
      jump: false, sneak: false, sprint: false,
    });
    expect(r.speed).toBe(SWIM.baseSwimSpeed);
    expect(r.hz).toBeCloseTo(-SWIM.baseSwimSpeed); // 前方为 -Z
    expect(r.sprintSwim).toBe(false);
  });

  it("疾跑游泳水平速度 = 基础 × 疾跑倍率", () => {
    const r = swimStep(freshSwimState(), {
      forward: true, back: false, left: false, right: false,
      jump: false, sneak: false, sprint: true,
    });
    expect(r.speed).toBeCloseTo(SWIM.baseSwimSpeed * SWIM.sprintSwimMultiplier);
    expect(r.sprintSwim).toBe(true);
  });

  it("跳跃（疾跑）上浮、下蹲下潜", () => {
    const up = swimStep(freshSwimState(), {
      forward: false, back: false, left: false, right: false,
      jump: true, sneak: false, sprint: true,
    });
    expect(up.surfacing).toBe(true);
    expect(up.dy).toBeCloseTo(SWIM.swimUpVelocity);

    const down = swimStep(freshSwimState(), {
      forward: false, back: false, left: false, right: false,
      jump: false, sneak: true, sprint: false,
    });
    expect(down.diving).toBe(true);
    expect(down.dy).toBeCloseTo(SWIM.diveDownVelocity);
  });

  it("对角输入方向归一化（斜向不超速）", () => {
    const r = swimStep(freshSwimState(), {
      forward: true, back: false, left: true, right: false,
      jump: false, sneak: false, sprint: false,
    });
    const h = Math.hypot(r.hx, r.hz);
    expect(h).toBeCloseTo(SWIM.baseSwimSpeed);
  });

  it("无输入时垂直速度按拖曳衰减", () => {
    let state = freshSwimState();
    state = {
      ...state,
      vy: swimStep(state, {
        forward: false, back: false, left: false, right: false,
        jump: true, sneak: false, sprint: true,
      }).dy,
    };
    const next = swimStep(state, {
      forward: false, back: false, left: false, right: false,
      jump: false, sneak: false, sprint: false,
    });
    expect(next.dy).toBeLessThan(state.vy);
  });
});

describe("water: 1×1 channel passage", () => {
  it("1×1 水道（水占据）可通行", () => {
    expect(channelPassable(["water", "water", "water"])).toBe(true);
    expect(channelPassable(["water", "air", "water"])).toBe(true);
  });

  it("被实心阻断的 1×1 水道不可通行", () => {
    expect(channelPassable(["water", "solid", "water"])).toBe(false);
  });

  it("最长可通行 1×1 水道长度正确", () => {
    const grid = buildWaterGrid(5, 1, 1); // 1 深水 + 表层空气行
    grid.cells[0][2] = "solid"; // 中间阻断
    expect(longestPassableChannel(grid, 0)).toBe(2); // 左右各 2
  });
});

describe("water: 掉落物上浮", () => {
  function makeItem(deep: number): DroppedItem {
    return { id: 1, item: "apple", x: 0, y: deep, z: 0, inWater: true };
  }

  it("水中掉落物逐 tick 上升到水面并保持稳定", () => {
    let item = makeItem(3);
    const surfaceY = 0;
    let ticks = 0;
    while (item.inWater && item.y > 0.0001 && ticks < 100) {
      item = floatItem(item, surfaceY);
      ticks += 1;
    }
    expect(item.y).toBe(surfaceY);
    // 继续推进不再低于水面（稳定漂浮）。
    const stable = floatItem(item, surfaceY);
    expect(stable.y).toBe(surfaceY);
  });

  it("不处于水中的掉落物不上浮", () => {
    const item = floatItem({ ...makeItem(3), inWater: false }, 0);
    expect(item.y).toBe(3);
  });
});

/* ------------------------------------------------------------------ *
 * 3. 水下放置不产生错误空气洞
 * ------------------------------------------------------------------ */

describe("water: 水下放置不产生错误空气洞", () => {
  it("在水中放置实心方块后不存在空气洞且无需回填", () => {
    // 5 宽、2 深水体 + 1 层表层空气。
    const grid = buildWaterGrid(5, 2, 1);
    // 在多个水下位置放置。
    for (const row of [0, 1]) {
      for (const col of [1, 2, 3]) {
        const { grid: g, backfilled } = placeUnderwater(grid, row, col);
        expect(findAirHoles(g)).toHaveLength(0);
        expect(backfilled).toBe(0);
      }
    }
  });

  it("findAirHoles 能识别被实心完全封闭的空气洞（判断逻辑有效）", () => {
    // 手工构造：一块四面皆被 solid 包围的 air 空洞。
    const g = buildWaterGrid(3, 2, 1); // 行0,1 水；行2 空气（表层）
    // 将 (1,1) 及其四面都置为实心 → 封闭 void。
    g.cells[1][1] = "air";
    g.cells[0][1] = "solid";
    g.cells[2][1] = "solid";
    g.cells[1][0] = "solid";
    g.cells[1][2] = "solid";
    const holes = findAirHoles(g);
    expect(holes.length).toBeGreaterThan(0);
    expect(holes.some((h) => h.row === 1 && h.col === 1)).toBe(true);
  });

  it("在水中垒墙（跨 1×1 水道）不新增空气洞", () => {
    const grid = buildWaterGrid(5, 3, 1);
    const before = findAirHoles(grid).length;
    // 在中间竖着放置一堵墙（列 2，深 0..2）。
    for (let r = 0; r < 3; r++) {
      const { grid: g } = placeUnderwater(grid, r, 2);
      grid.cells = g.cells;
    }
    expect(findAirHoles(grid).length).toBe(before); // 不新增
  });
});
