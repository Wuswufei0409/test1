import { describe, expect, it } from "vitest";
import {
  MAX_HEALTH,
  MAX_HUNGER,
  applyDamage,
  isDead,
  DIFFICULTY_MULTIPLIER,
} from "../../src/survival/types";
import {
  freshSurvival,
  fallDamage,
  hostileDamage,
  meleeDamage,
  applyDamageTo,
  kill,
  respawn,
  tickAir,
  tickHunger,
  tickSurvival,
  MAX_AIR,
  AIR_DRAIN_PER_TICK,
  HUNGER_DECAY_TICKS_ACTIVE,
  STARVATION_DAMAGE_INTERVAL_TICKS,
  DIFFICULTY_PARAMS,
  FALL_SAFE_BLOCKS,
} from "../../src/survival/systems";
import { eat, FOODS, foodName } from "../../src/survival/food";

describe("survival: health/damage clamps", () => {
  it("fresh state is full and alive", () => {
    const s = freshSurvival();
    expect(s.health.value).toBe(MAX_HEALTH);
    expect(s.hunger.value).toBe(MAX_HUNGER);
    expect(s.alive).toBe(true);
  });

  it("applyDamage clamps within [0, max] and kills at 0", () => {
    const h = applyDamage(
      { value: 4, max: MAX_HEALTH },
      { amount: 10, source: "fall" }
    );
    expect(h.value).toBe(0);
    expect(isDead(h)).toBe(true);
  });

  it("hostile damage scales by difficulty; peaceful deals none", () => {
    expect(hostileDamage(6, "peaceful").amount).toBe(0);
    expect(hostileDamage(6, "easy").amount).toBe(3);
    expect(hostileDamage(6, "normal").amount).toBe(6);
    expect(hostileDamage(6, "hard").amount).toBe(9);
    expect(DIFFICULTY_MULTIPLIER.peaceful).toBe(0);
  });

  it("melee and fall sources are valid and deterministic", () => {
    expect(meleeDamage(4).source).toBe("melee");
    expect(meleeDamage(4).amount).toBe(4);
    const fall = fallDamage(5);
    expect(fall.source).toBe("fall");
    expect(fall.amount).toBe(5 - FALL_SAFE_BLOCKS); // 2
  });
});

describe("survival: fall/drown damage flow", () => {
  it("fall below safe height deals no damage", () => {
    expect(fallDamage(3).amount).toBe(0);
    expect(fallDamage(2).amount).toBe(0);
  });

  it("applyDamageTo via hostile damage reduces health and alive", () => {
    const s = freshSurvival();
    // 4 半心 = 8 点伤害，不足致死 -> 存活；10 半心 = 20 点 = 满血 -> 致死。
    const hurt = applyDamageTo(s, hostileDamage(4, "normal"));
    expect(hurt.health.value).toBe(MAX_HEALTH - 4 * 2);
    expect(hurt.alive).toBe(true);
    const dead = applyDamageTo(s, hostileDamage(10, "normal"));
    expect(dead.health.value).toBe(0);
    expect(dead.alive).toBe(false);
  });

  it("kill sets dead", () => {
    expect(kill(freshSurvival()).alive).toBe(false);
  });
});

describe("survival: air / oxygen", () => {
  it("drains underwater and regains above water", () => {
    const s = freshSurvival();
    const under = tickAir(s, true);
    expect(under.air.value).toBe(MAX_AIR - AIR_DRAIN_PER_TICK);
    const regained = tickAir({ ...s, air: { value: 0, max: MAX_AIR } }, false);
    expect(regained.air.value).toBeGreaterThan(0);
  });
});

describe("survival: hunger decay", () => {
  it("decays hunger while active and reaches zero", () => {
    let s = freshSurvival();
    let hungryTicks = 0;
    // 活动间隔为 HUNGER_DECAY_TICKS_ACTIVE：累计达到该间隔后扣 1 点。
    for (let i = 0; i <= HUNGER_DECAY_TICKS_ACTIVE; i++) {
      const r = tickHunger(s, true, hungryTicks, "normal");
      s = r.state;
      hungryTicks = r.hungryTicks;
    }
    expect(s.hunger.value).toBe(MAX_HUNGER - 1);
  });

  it("starvation deals damage when hunger is zero on normal", () => {
    const zero = { ...freshSurvival(), hunger: { value: 0, max: MAX_HUNGER, saturation: 0 } };
    const r = tickHunger(zero, false, STARVATION_DAMAGE_INTERVAL_TICKS - 1, "normal");
    // 达到间隔（-1 + 1 = interval）应触发 1 半心饥饿伤害。
    expect(r.state.health.value).toBe(MAX_HEALTH - 2);
  });
});

describe("survival: integrated tick", () => {
  it("drown damages after air runs out underwater", () => {
    let s = { ...freshSurvival(), air: { value: MAX_AIR, max: MAX_AIR } };
    let counters = { hungryTicks: 0, drownTicks: 0 };
    // 耗空氧气。
    for (let i = 0; i < MAX_AIR; i++) {
      const r = tickSurvival(s, { inWater: true, active: false, difficulty: "normal" }, counters);
      s = r.state;
      counters = r.counters;
    }
    expect(s.air.value).toBe(0);
    // 继续潜水直到触发一次溺水伤害。
    for (let i = 0; i < 20; i++) {
      const r = tickSurvival(s, { inWater: true, active: false, difficulty: "normal" }, counters);
      s = r.state;
      counters = r.counters;
    }
    expect(s.health.value).toBeLessThan(MAX_HEALTH);
  });
});

describe("survival: respawn", () => {
  it("respawn resets health/hunger/air to full", () => {
    const dead = kill(freshSurvival());
    const { state } = respawn({ x: 0, y: 64, z: 0 });
    expect(state.health.value).toBe(MAX_HEALTH);
    expect(state.hunger.value).toBe(MAX_HUNGER);
    expect(state.air.value).toBe(MAX_AIR);
    expect(state.alive).toBe(true);
    expect(dead.alive).toBe(false);
  });
});

describe("survival: food", () => {
  it("covers representative foods", () => {
    expect(FOODS.bread.hungerRestore).toBeGreaterThan(0);
    expect(foodName("apple")).toBe("苹果");
    expect(Object.keys(FOODS).length).toBeGreaterThanOrEqual(3);
  });

  it("eat restores hunger within max", () => {
    const low = { value: 2, max: MAX_HUNGER, saturation: 0 };
    const after = eat(low, "bread");
    expect(after.value).toBe(Math.min(MAX_HUNGER, 2 + FOODS.bread.hungerRestore));
    expect(after.value).toBeLessThanOrEqual(MAX_HUNGER);
  });
});

describe("survival: difficulty matrix", () => {
  it("exposes deterministic difficulty params", () => {
    expect(DIFFICULTY_PARAMS.allowHostileDamage.peaceful).toBe(false);
    expect(DIFFICULTY_PARAMS.allowHostileDamage.normal).toBe(true);
    expect(DIFFICULTY_PARAMS.hostileDamageBaseHalfHearts.hard).toBeGreaterThan(
      DIFFICULTY_PARAMS.hostileDamageBaseHalfHearts.easy
    );
  });
});
