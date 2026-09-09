/**
 * 昼夜循环：世界时间 -> 天空/亮度、日夜判定、避寝与重生（对接目标 10）。
 *
 * 全部纯函数、确定性：给定同一 worldTime 永远返回同一结果，便于固定 seed 回放。
 * 世界时间约定沿用 src/core/tick.ts：一个完整白天循环 24000 tick；
 * 0..12000 为白天，12000..24000 为夜晚（0 为日出）。
 */

import type { WorldTime } from "../core/tick";

/** 完整昼夜循环长度（tick）。 */
export const DAY_CYCLE_TICKS = 24000;
/** 白昼起点（日出，含）。 */
export const DAY_START_TICK = 0;
/** 夜晚起点（日落，含）。 */
export const NIGHT_START_TICK = 12000;
/** 夜晚中点（最深黑暗）。 */
export const NIGHT_MID_TICK = 18000;

/** 归一化到 [0, DAY_CYCLE_TICKS) 的世界时间。 */
export function normalizeTime(t: WorldTime): WorldTime {
  return ((t % DAY_CYCLE_TICKS) + DAY_CYCLE_TICKS) % DAY_CYCLE_TICKS;
}

/** 是否白昼。 */
export function isDay(t: WorldTime): boolean {
  const n = normalizeTime(t);
  return n < NIGHT_START_TICK;
}

/** 是否夜晚。 */
export function isNight(t: WorldTime): boolean {
  return !isDay(t);
}

/** 是否午夜（黑暗最深时段，作用于敌对生成/亡灵燃烧边界）。 */
export function isMidnight(t: WorldTime): boolean {
  const n = normalizeTime(t);
  return n >= NIGHT_MID_TICK;
}

/**
 * 环境亮度 [0,1]。白天高、夜晚低，午夜最低，黄昏/黎明渐变。
 * 用于渲染亮度与敌对生物生成阈值判定。
 * 纯函数：0=全黑，1=正午。
 */
export function skyBrightness(t: WorldTime): number {
  const n = normalizeTime(t);
  // 白天：0..12000 线性升到正午 6000 再回落。
  if (n < NIGHT_START_TICK) {
    const peak = 6000; // 正午
    const half = 6000; // 12000/2
    const d = Math.min(n, 2 * peak - n);
    return Math.min(1, 0.35 + (0.65 * d) / half);
  }
  // 夜晚：12000..24000，午夜 18000 最暗（尽量接近全黑，供敌对生成/亡灵燃烧边界）。
  const nightPos = n - NIGHT_START_TICK; // 0..12000
  const darkness = 1 - Math.abs(nightPos - 6000) / 6000; // 1 在午夜，0 在边界
  return Math.max(0.02, darkness * 0.12);
}

/** 太阳仰角参数（度，渲染/视觉用）。白天太阳在地平线上方。 */
export function sunAngle(t: WorldTime): number {
  const n = normalizeTime(t);
  if (n < NIGHT_START_TICK) {
    // 正午最高 90°，日出/日落接近 0°。
    return (Math.min(n, 2 * 6000 - n) / 6000) * 90;
  }
  return -20; // 夜晚太阳在地平线下。
}

/** 睡眠跳过整晚：把世界时间推进到下一个日出（0 / 24000 边界）。 */
export function sleepUntilDawn(t: WorldTime): WorldTime {
  const n = normalizeTime(t);
  if (isDay(n) && n < NIGHT_START_TICK) {
    // 已是白天且未到黄昏，仍可过到次日白天（简单处理：直接到下一日黎明）。
    return DAY_CYCLE_TICKS;
  }
  // 夜晚则由夜晚起点推进到 24000（次日黎明）。
  return DAY_CYCLE_TICKS;
}

/** 傍晚降入黑夜的时间点（供“夜床可跳夜”判定）。 */
export function isNightBeforeBed(t: WorldTime): boolean {
  return isNight(t);
}

/** 昼夜状态字符串（证据/调试用）。 */
export function phaseLabel(t: WorldTime): "day" | "night" | "midnight" {
  if (isNight(t)) return isMidnight(t) ? "midnight" : "night";
  return "day";
}
