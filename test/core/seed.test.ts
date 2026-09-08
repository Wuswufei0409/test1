import { describe, expect, it } from "vitest";
import { createRng, hashSeed, mulberry32 } from "../../src/core/seed";

describe("seed determinism", () => {
  it("same seed produces identical rng sequence", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("hashSeed is stable and 32-bit", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
    expect(hashSeed("hello")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("hello")).toBeLessThanOrEqual(0xffffffff);
  });

  it("int/range are within bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      const f = rng.range(-2, 3);
      expect(f).toBeGreaterThanOrEqual(-2);
      expect(f).toBeLessThan(3);
    }
  });
});
