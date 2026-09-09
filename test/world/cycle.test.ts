import { describe, expect, it } from "vitest";
import {
  isDay,
  isNight,
  skyBrightness,
  sunAngle,
  sleepUntilDawn,
  phaseLabel,
  normalizeTime,
  DAY_CYCLE_TICKS,
} from "../../src/world/cycle";

describe("day/night cycle (目标 10)", () => {
  it("defines day vs night boundaries", () => {
    expect(isDay(0)).toBe(true); // 日出
    expect(isDay(6000)).toBe(true); // 正午
    expect(isDay(11999)).toBe(true);
    expect(isNight(12000)).toBe(true); // 日落
    expect(isNight(18000)).toBe(true); // 午夜
    expect(isNight(23999)).toBe(true);
    // 完整循环回绕
    expect(isDay(DAY_CYCLE_TICKS)).toBe(true);
  });

  it("brightness peaks at noon and troughs at midnight", () => {
    const noon = skyBrightness(6000);
    const midnight = skyBrightness(18000);
    expect(noon).toBeGreaterThan(0.9);
    expect(midnight).toBeLessThan(0.2);
    expect(skyBrightness(0)).toBeGreaterThan(midnight);
  });

  it("sun angle is high at noon, negative at night", () => {
    expect(sunAngle(6000)).toBe(90);
    expect(sunAngle(18000)).toBeLessThan(0);
  });

  it("phase label is day/night/midnight", () => {
    expect(phaseLabel(6000)).toBe("day");
    expect(phaseLabel(15000)).toBe("night");
    expect(phaseLabel(18000)).toBe("midnight");
  });

  it("sleep skips to next dawn deterministically", () => {
    expect(sleepUntilDawn(15000)).toBe(DAY_CYCLE_TICKS);
    expect(sleepUntilDawn(0)).toBe(DAY_CYCLE_TICKS);
    expect(normalizeTime(sleepUntilDawn(15000))).toBe(0);
  });
});
