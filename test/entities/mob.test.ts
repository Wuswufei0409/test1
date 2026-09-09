import { describe, expect, it } from "vitest";
import {
  MOBS,
  REQUIRED_CORE_MOBS,
  canSpawn,
  burnsInDaylight,
  chooseMobToSpawn,
  hostileSpawnWeight,
  mobDef,
} from "../../src/entities/mob";
import { createRng } from "../../src/core/seed";
import { skyBrightness } from "../../src/world/cycle";

describe("mob definitions & spawning (目标 11)", () => {
  it("covers the required core mobs", () => {
    for (const k of REQUIRED_CORE_MOBS) {
      expect(MOBS[k]).toBeDefined();
      expect(MOBS[k].maxHealth).toBeGreaterThan(0);
    }
  });

  it("passive mobs spawn by day, hostile by night", () => {
    // 白天亮度较高 -> 被动可生成、敌对被禁止（除和平闸门外还需亮度）。
    expect(canSpawn("pig", 6000, skyBrightness(6000), "normal")).toBe(true);
    expect(canSpawn("zombie", 6000, skyBrightness(6000), "normal")).toBe(false);
    // 夜晚亮度低 -> 敌对可生成。
    expect(canSpawn("zombie", 18000, skyBrightness(18000), "normal")).toBe(true);
    // 和平难度禁止敌对生成。
    expect(canSpawn("zombie", 18000, skyBrightness(18000), "peaceful")).toBe(false);
    // 但被动在和平难度依然可生成。
    expect(canSpawn("chicken", 6000, skyBrightness(6000), "peaceful")).toBe(true);
  });

  it("zombies burn in bright daylight", () => {
    expect(burnsInDaylight("zombie", 6000)).toBe(true);
    expect(burnsInDaylight("zombie", 18000)).toBe(false);
    expect(burnsInDaylight("spider", 6000)).toBe(false); // 蜘蛛不燃烧
  });

  it("chooseMobToSpawn is deterministic per seed/time", () => {
    const cand: Array<"pig" | "zombie"> = ["pig", "zombie"];
    // 白天只可能选到 pig。
    const day = chooseMobToSpawn(cand, 6000, skyBrightness(6000), "normal", createRng(7));
    expect(day).toBe("pig");
    // 夜晚（normal）pig 不能生成，zombie 可生成。
    const night = chooseMobToSpawn(cand, 18000, skyBrightness(18000), "normal", createRng(7));
    expect(night).toBe("zombie");
    // 同 seed 重复结果一致。
    const nightAgain = chooseMobToSpawn(cand, 18000, skyBrightness(18000), "normal", createRng(7));
    expect(nightAgain).toBe(night);
  });

  it("hostile spawn weight by difficulty", () => {
    expect(hostileSpawnWeight("peaceful")).toBe(0);
    expect(hostileSpawnWeight("normal")).toBeGreaterThan(hostileSpawnWeight("easy"));
    expect(hostileSpawnWeight("hard")).toBeGreaterThan(hostileSpawnWeight("normal"));
  });

  it("mobDef lookup works", () => {
    expect(mobDef("creeper")?.attackHalfHearts).toBe(0);
    expect(mobDef("zombie")?.attackHalfHearts).toBe(4);
  });
});
