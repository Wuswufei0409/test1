import { describe, expect, it } from "vitest";
import {
  IDLE_COMBAT,
  meleeAttack,
  advanceCooldown,
  consumeDurability,
  weaponBroken,
  applyArmor,
  rangedAttack,
  WEAPONS,
  ARMORS,
} from "../../src/entities/combat";

const stone = WEAPONS.stone_sword;

const attacker = { id: 1, x: 0, y: 0, z: 0 };
const target = { id: 2, x: 1, y: 0, z: 0 }; // 距离 1，在 3 格射程内。

describe("combat (目标 12)", () => {
  it("melee hit within range deals scaled damage and sets hit feedback", () => {
    const r = meleeAttack(IDLE_COMBAT, stone, attacker, target, "normal");
    expect(r.hit).toBe(true);
    expect(r.damageHalfHearts).toBe(stone.damageHalfHearts);
    expect(r.state.hitCount).toBe(1);
    expect(r.state.lastHitId).toBe(target.id);
    expect(r.state.cooldown).toBe(stone.cooldownTicks);
    expect(r.knockback.x).toBeGreaterThan(0); // 沿方向击退
  });

  it("misses during cooldown", () => {
    const primed = { ...IDLE_COMBAT, cooldown: 5 };
    const r = meleeAttack(primed, stone, attacker, target, "normal");
    expect(r.hit).toBe(false);
    expect(r.damageHalfHearts).toBe(0);
  });

  it("misses beyond range", () => {
    const far = { id: 3, x: 100, y: 0, z: 100 };
    const r = meleeAttack(IDLE_COMBAT, stone, attacker, far, "normal");
    expect(r.hit).toBe(false);
  });

  it("cooldown advances", () => {
    expect(advanceCooldown({ ...IDLE_COMBAT, cooldown: 6 }, 6).cooldown).toBe(0);
    expect(advanceCooldown({ ...IDLE_COMBAT, cooldown: 6 }, 3).cooldown).toBe(3);
  });

  it("durability consumes and breaks", () => {
    expect(consumeDurability(stone, 5)).toBe(4);
    expect(consumeDurability(stone, 1)).toBe(0);
    expect(weaponBroken(0)).toBe(true);
    expect(weaponBroken(1)).toBe(false);
  });

  it("armor reduces damage and consumes durability", () => {
    const iron = ARMORS.iron;
    const r = applyArmor(10, iron, 50);
    expect(r.reduced).toBeLessThan(10);
    expect(r.absorption).toBeGreaterThan(0);
    expect(r.remaining).toBe(49);
    // 无耐久时无减伤、不消耗。
    const noDura = applyArmor(10, iron, 0);
    expect(noDura.reduced).toBe(10);
    expect(noDura.used).toBe(0);
  });

  it("ranged hit scales damage with distance within range", () => {
    const bow = WEAPONS.bow;
    const close = rangedAttack(IDLE_COMBAT, bow, 2, "normal");
    const farOk = rangedAttack(IDLE_COMBAT, bow, 20, "normal");
    expect(close.hit).toBe(true);
    expect(close.damageHalfHearts).toBeGreaterThan(farOk.damageHalfHearts);
    // 超射程 miss。
    const tooFar = rangedAttack(IDLE_COMBAT, bow, 100, "normal");
    expect(tooFar.hit).toBe(false);
  });
});
