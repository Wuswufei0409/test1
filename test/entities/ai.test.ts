import { describe, expect, it } from "vitest";
import {
  updateAi,
  wanderStep,
  fleeStep,
  chaseStep,
  explode,
  freshCreeper,
  tickCreeperFuse,
  horizontalDist,
} from "../../src/entities/ai";
import { MOBS } from "../../src/entities/mob";
import { createRng } from "../../src/core/seed";
import type { WorldMutate } from "../../src/world/types";

describe("mob AI (目标 11)", () => {
  const hostile = { id: 1, kind: "zombie", x: 0, y: 0, z: 0 };
  const target = { id: 2, kind: "player", x: 5, y: 0, z: 0 };

  it("hostile chases then attacks as target approaches", () => {
    const chase = updateAi({ targetId: null, mode: "idle" }, hostile, target, MOBS.zombie);
    expect(chase.mode).toBe("chase");
    const closeTarget = { ...target, x: 1 };
    const attack = updateAi({ targetId: null, mode: "idle" }, hostile, closeTarget, MOBS.zombie);
    expect(attack.mode).toBe("attack");
  });

  it("passive mob flees when player is near", () => {
    const pig = { id: 3, kind: "pig", x: 0, y: 0, z: 0 };
    const near = { ...target, x: 2 };
    const ai = updateAi({ targetId: null, mode: "idle" }, pig, near, MOBS.pig);
    expect(ai.mode).toBe("flee");
    const far = updateAi({ targetId: null, mode: "idle" }, pig, { ...target, x: 30 }, MOBS.pig);
    expect(far.mode).toBe("wander");
  });

  it("wander/chase/flee produce deterministic movement with same seed", () => {
    const pos = { x: 0, y: 64, z: 0 };
    const a = wanderStep(pos, MOBS.pig, createRng(11));
    const b = wanderStep(pos, MOBS.pig, createRng(11));
    expect(a).toEqual(b);
    const ch1 = chaseStep(pos, target, MOBS.zombie);
    expect(ch1.x).toBeGreaterThan(0); // 朝 +x 目标移动
    const fl = fleeStep(pos, { ...target, x: 3, z: 0 }, MOBS.sheep, createRng(11));
    expect(fl.x).toBeLessThan(0); // 背离 +x 目标
  });

  it("horizontal distance is correct", () => {
    expect(horizontalDist({ id: 1, kind: "a", x: 0, y: 0, z: 0 }, { id: 2, kind: "b", x: 3, y: 9, z: 4 })).toBe(5);
  });
});

describe("creeper explosion modifies world (目标 11)", () => {
  it("explode replaces blocks with air within radius", () => {
    const calls: Array<{ pos: { x: number; y: number; z: number }; block: string }> = [];
    const world: WorldMutate = {
      setBlock: (pos, block) => calls.push({ pos, block: String(block) }),
    };
    const affected = explode(world, { x: 10, y: 40, z: 10 }, 2);
    expect(affected.length).toBeGreaterThan(0);
    // 全部替换为 air，且在球体半径内。
    for (const c of calls) {
      expect(c.block).toBe("air");
      const dist = Math.hypot(c.pos.x - 10, c.pos.y - 40, c.pos.z - 10);
      expect(dist).toBeLessThanOrEqual(2);
    }
  });

  it("fuse counts down only when player is near and detonates", () => {
    const c = freshCreeper(3);
    const far1 = tickCreeperFuse(c, false);
    expect(far1.detonated).toBe(false);
    expect(far1.state.fuseTicks).toBe(c.fuseTicks); // 玩家不在附近不倒数
    // 玩家接近后持续倒数直到引信归零。
    let s = c;
    let det = false;
    for (let i = 0; i < c.fuseTicks; i++) {
      const r = tickCreeperFuse(s, true);
      s = r.state;
      det = r.detonated;
    }
    expect(s.fuseTicks).toBe(0);
    expect(det).toBe(true);
  });
});
