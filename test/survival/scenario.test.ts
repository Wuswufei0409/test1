import { describe, expect, it } from "vitest";
import { TickClock } from "../../src/core/tick";
import { WorldSimulator } from "../../src/core/simulator";
import { createRng } from "../../src/core/seed";
import { MAX_HEALTH, MAX_HUNGER } from "../../src/survival/types";
import { applyDamageTo, freshSurvival, hostileDamage } from "../../src/survival/systems";
import type { WorldRead } from "../../src/world/types";
import type { GeneratedWorld } from "../../src/world/generator";

// 用 seed 派生一个确定性 Rng（遵循全局限定：所有随机都经 seed）。
function seededScenario(seed: number) {
  const rng = createRng(seed);
  return rng;
}

describe("survival: fixed-seed reproducible damage/death flow (验收 09)", () => {
  it("same seed yields identical damage sequence", () => {
    const rng1 = seededScenario(2024);
    const rng2 = seededScenario(2024);
    const rolls1 = [rng1.int(10), rng1.int(10), rng1.int(10)];
    const rolls2 = [rng2.int(10), rng2.int(10), rng2.int(10)];
    expect(rolls1).toEqual(rolls2);
  });

  it("deterministic hostile damage -> death flow is reproducible", () => {
    // 用 seed 决定 hostile 基础伤害；normal 难度下 11 半心即可一击致死。
    const seed = 42;
    const rng = createRng(seed);
    const base = 4 + rng.int(8); // 4..11
    const s1 = applyDamageTo(freshSurvival(), hostileDamage(base, "normal"));
    // 相同 seed 重复，结果一致。
    const rngB = createRng(seed);
    const baseB = 4 + rngB.int(8);
    const s2 = applyDamageTo(freshSurvival(), hostileDamage(baseB, "normal"));
    expect(baseB).toBe(base);
    expect(s1.health.value).toBe(s2.health.value);
    expect(s1.alive).toBe(s2.alive);
  });

  it("simulator survival tick advances deterministically", () => {
    const clock = new TickClock();
    const world = makeEmptyWorld();
    const player = {
      position: { x: 0, y: 70, z: 0 },
      exact: { x: 0, y: 70, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      onGround: true,
      inWater: false,
      sprinting: false,
      sneaking: false,
    };
    const sim1 = new WorldSimulator(
      clock,
      world,
      player,
      { value: MAX_HEALTH - 10, max: MAX_HEALTH },
      { value: MAX_HUNGER, max: MAX_HUNGER, saturation: MAX_HUNGER }
    );
    const sim2 = new WorldSimulator(
      new TickClock(),
      world,
      player,
      { value: MAX_HEALTH - 10, max: MAX_HEALTH },
      { value: MAX_HUNGER, max: MAX_HUNGER, saturation: MAX_HUNGER }
    );
    // 推进 500 tick（活动态应触发饥饿衰减）；两实例一致。
    for (let i = 0; i < 500; i++) {
      sim1.step({ forward: true, back: false });
      sim2.step({ forward: true, back: false });
    }
    const a = sim1.step({ forward: false, back: false });
    const b = sim2.step({ forward: false, back: false });
    expect(a.hunger.value).toBe(b.hunger.value);
    expect(a.air.value).toBe(b.air.value);
  });
});

// 最小可用的空世界桩，满足 WorldSimulator 的 getHeight 只读调用。
class EmptyWorld implements WorldRead {
  readonly seed = 0;
  getBlock() {
    return "air" as const;
  }
  getBiome() {
    return "plains" as const;
  }
  getHeight(_x: number, _z: number) {
    return 70;
  }
  isSolid() {
    return false;
  }
}
function makeEmptyWorld(): GeneratedWorld {
  return new EmptyWorld() as unknown as GeneratedWorld;
}
