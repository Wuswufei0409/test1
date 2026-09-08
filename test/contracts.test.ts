import { describe, expect, it } from "vitest";
import { applyDamage, isDead, MAX_HEALTH } from "../src/survival/types";
import { SAVE_FORMAT_VERSION, validateSave } from "../src/save/types";
import { STACK_LIMIT } from "../src/items/types";
import { PLAYER_CONSTANTS } from "../src/player/types";

describe("survival health", () => {
  it("clamps damage to >= 0", () => {
    const h = applyDamage({ value: 4, max: MAX_HEALTH }, { amount: 10, source: "fall" });
    expect(h.value).toBe(0);
    expect(isDead(h)).toBe(true);
  });

  it("keeps within max", () => {
    const h = applyDamage({ value: MAX_HEALTH - 1, max: MAX_HEALTH }, { amount: 0, source: "magic" });
    expect(h.value).toBeLessThanOrEqual(MAX_HEALTH);
    expect(h.value).toBeGreaterThanOrEqual(0);
  });
});

describe("save contract", () => {
  it("version and validate", () => {
    expect(SAVE_FORMAT_VERSION).toBe(1);
    expect(validateSave({ version: 1, seed: 1, worldTime: 0 })).toBeNull();
    expect(validateSave({ version: 0 })).toMatch(/unsupported/);
    expect(validateSave(null)).toMatch(/not an object/);
  });
});

describe("item/player constants", () => {
  it("stack limit positive", () => {
    expect(STACK_LIMIT).toBe(64);
  });
  it("walk speed positive", () => {
    expect(PLAYER_CONSTANTS.walkSpeed).toBeGreaterThan(0);
  });
});
