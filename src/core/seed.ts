/**
 * 确定性种子工具。
 *
 * 约定（全局契约，供所有模块遵守）：
 * - 任何需要可复现性的随机来源都必须通过 {@link createRng} 由 seed 派生。
 * - 相同 seed + 相同调用序列 => 相同输出。
 * - 不要直接调用 Math.random()（渲染/UI 偶然抖动除外）。
 */

/** 任意可哈希的种子输入（数字、字符串或字节）。 */
export type SeedInput = number | string | Uint8Array;

/** 32 位无符号整数种子。 */
export type Seed = number;

/** 确定性伪随机数生成器。next() 返回 [0,1)。 */
export interface Rng {
  next(): number;
  /** 返回 [0, upper) 的整数。 */
  int(upper: number): number;
  /** 返回 [lo, hi) 的浮点数。 */
  range(lo: number, hi: number): number;
}

/** FNV-1a 字符串哈希，用于把字符串种子折叠成 32 位整数。 */
export function hashSeed(input: SeedInput): Seed {
  if (typeof input === "number") {
    return input >>> 0;
  }
  let h = 0x811c9dc5;
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    // multiply by 16777619
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * mulberry32 —— 32 位 PCG 风格快速 PRNG（公共领域算法）。
 * 完全确定：同 seed 必得同序列。
 */
export function mulberry32(seed: Seed): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(upper: number): number {
      return Math.floor(next() * upper);
    },
    range(lo: number, hi: number): number {
      return lo + (hi - lo) * next();
    },
  };
}

/** 便捷工厂：输入任意种子源，返回确定性 Rng。 */
export function createRng(input: SeedInput): Rng {
  return mulberry32(hashSeed(input));
}
