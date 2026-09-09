import { describe, expect, it } from "vitest";
import {
  TRIDENT,
  throwTrident,
  stepFlight,
  hitCheck,
  resolveHit,
  beginReturn,
  stepReturn,
  pickupTrident,
  riptideDash,
  isAquatic,
} from "../../src/entities/trident";
import { consumeDurability, weaponBroken } from "../../src/entities/combat";

const user = { id: 1, position: { x: 0, y: 10, z: 0 } } as const;
// 前方 14 格的水生目标（在 24 格射程内，命中半径内）。
const cod = { id: 2, kind: "cod", position: { x: 14, y: 10, z: 0 } } as const;
// 非水生目标。
const zombie = { id: 3, kind: "zombie", position: { x: 16, y: 10, z: 0 } } as const;

/** 飞行直至命中（固定 seed，确定性）。 */
function flyUntilHit(seed: number): ReturnType<typeof resolveHit> {
  const thrown = throwTrident({ seed, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: ["loyalty", "impaling"] });
  expect(thrown.broken).toBe(false);
  let p = thrown.proj!;
  let guard = 0;
  while (p.phase === "flying" && guard < 100) {
    p = stepFlight(p);
    guard++;
    if (hitCheck(p, cod)) {
      return resolveHit(p, cod, "clear");
    }
  }
  throw new Error("not reached target");
}

describe("trident (IMP-8 / W8)", () => {
  it("投掷→飞行→命中→拾回 全流程确定性（seed 受限）", () => {
    // 固定 seed → 完全可复现。
    const thrown = throwTrident({
      seed: 0xbeef,
      user,
      dir: { x: 1, y: 0, z: 0 },
      durability: 250,
      enchant: ["loyalty", "impaling"],
    });
    expect(thrown.broken).toBe(false);
    expect(thrown.remainingDurability).toBe(249); // 投掷消耗 1 耐久
    let p = thrown.proj!;
    expect(p.phase).toBe("flying");
    expect(p.t).toBe(0);

    // 飞行 → 命中
    let guard = 0;
    while (p.phase === "flying" && guard < 100) {
      p = stepFlight(p);
      guard++;
      if (hitCheck(p, cod)) {
        const hit = resolveHit(p, cod, "clear");
        p = hit.proj;
        break;
      }
    }
    expect(p.phase).toBe("hit");
    expect(p.hitId).toBe(cod.id);
    expect(p.impalingBonus).toBe(TRIDENT.impalingBonusHalfHearts);

    // Loyalty 返回 → 拾回
    let ret = beginReturn(p);
    guard = 0;
    while (ret.phase === "returning" && guard < 100) {
      ret = stepReturn(ret, user.position);
      guard++;
    }
    expect(ret.phase).toBe("picked");
    expect(pickupTrident(ret)).toBe(thrown.remainingDurability);
  });

  it("同 seed 全流程可复现（确定性）", () => {
    const a = flyUntilHit(0xbeef);
    const b = flyUntilHit(0xbeef);
    expect(a.proj.position).toEqual(b.proj.position);
    expect(a.damageHalfHearts).toBe(b.damageHalfHearts);
  });

  it("耐久消耗与损坏判定可复现（复用 combat 耐久接口）", () => {
    // 投掷即消耗 1 耐久（内部走 consumeDurability）。
    const fresh = throwTrident({ seed: 1, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: [] });
    expect(fresh.broken).toBe(false);
    expect(fresh.remainingDurability).toBe(249);
    expect(fresh.usedDurability).toBe(1);

    // 耐久剩 1 时投掷 → 归零损坏，无法投掷。
    const last = throwTrident({ seed: 2, user, dir: { x: 1, y: 0, z: 0 }, durability: 1, enchant: [] });
    expect(last.broken).toBe(true);
    expect(last.remainingDurability).toBe(0);
    expect(last.proj).toBeNull();
    expect(weaponBroken(last.remainingDurability)).toBe(true);

    // 复用接口一致：与直接调用 consumeDurability 结果相同。
    expect(last.remainingDurability).toBe(consumeDurability(TRIDENT, 1));
  });

  it("Loyalty：命中后自动返回并拾回", () => {
    const thrown = throwTrident({ seed: 7, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: ["loyalty"] });
    let p = thrown.proj!;
    let guard = 0;
    while (p.phase === "flying" && guard < 100) {
      p = stepFlight(p);
      guard++;
      if (hitCheck(p, cod)) {
        p = resolveHit(p, cod, "clear").proj;
        break;
      }
    }
    p = beginReturn(p);
    guard = 0;
    while (p.phase === "returning" && guard < 100) {
      p = stepReturn(p, user.position);
      guard++;
    }
    expect(p.phase).toBe("picked");
    expect(pickupTrident(p)).toBe(thrown.remainingDurability);
  });

  it("Riptide：冲刺位移 + 飞行加速（确定性场景）", () => {
    // 冲刺：沿朝向推进约 riptideDash 格。
    const dashed = riptideDash(user, { x: 1, y: 0, z: 0 });
    expect(Math.hypot(dashed.x - user.position.x, dashed.z - user.position.z)).toBeCloseTo(TRIDENT.riptideDash, 1);

    // 冲刺飞行：同样 tick 数下，Riptide 弹道比普通弹道飞行得更远。
    const normal = throwTrident({ seed: 5, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: [] }).proj!;
    const boosted = throwTrident({ seed: 5, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: ["riptide"] }).proj!;
    let np = normal;
    let bp = boosted;
    for (let i = 0; i < 6; i++) {
      np = stepFlight(np);
      bp = stepFlight(bp);
    }
    const nDist = np.position.x - np.origin.x;
    const bDist = bp.position.x - bp.origin.x;
    expect(bDist).toBeGreaterThan(nDist);
  });

  it("Channeling：雷暴天气引雷增伤，晴天空转（确定性场景）", () => {
    const thrown = throwTrident({ seed: 11, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: ["channeling"] });
    let p = thrown.proj!;
    let guard = 0;
    while (p.phase === "flying" && guard < 100) {
      p = stepFlight(p);
      guard++;
      if (hitCheck(p, zombie)) {
        break;
      }
    }
    // 雷暴：引雷 + 闪电伤害。
    const storm = resolveHit(p, zombie, "thunderstorm");
    expect(storm.lightning).toBe(true);
    expect(storm.damageHalfHearts).toBe(TRIDENT.damageHalfHearts + TRIDENT.channelingStrikeHalfHearts);
    // 晴天：不引雷，仅基础伤害。
    const clear = resolveHit(p, zombie, "clear");
    expect(clear.lightning).toBe(false);
    expect(clear.damageHalfHearts).toBe(TRIDENT.damageHalfHearts);
  });

  it("Impaling：对水生生物增伤，对陆生生物无加成（确定性场景）", () => {
    const thrown = throwTrident({ seed: 13, user, dir: { x: 1, y: 0, z: 0 }, durability: 250, enchant: ["impaling"] });
    let p = thrown.proj!;
    let guard = 0;
    while (p.phase === "flying" && guard < 100) {
      p = stepFlight(p);
      guard++;
      if (hitCheck(p, cod) || hitCheck(p, zombie)) {
        break;
      }
    }
    expect(isAquatic("cod")).toBe(true);
    expect(isAquatic("zombie")).toBe(false);
    const vsAquatic = resolveHit(p, cod, "clear");
    expect(vsAquatic.impalingBonus).toBe(TRIDENT.impalingBonusHalfHearts);
    expect(vsAquatic.damageHalfHearts).toBe(TRIDENT.damageHalfHearts + TRIDENT.impalingBonusHalfHearts);
    const vsLand = resolveHit(p, zombie, "clear");
    expect(vsLand.impalingBonus).toBe(0);
    expect(vsLand.damageHalfHearts).toBe(TRIDENT.damageHalfHearts);
  });
});
