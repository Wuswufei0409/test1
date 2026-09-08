/**
 * 确定性 tick 时钟。
 *
 * 约定：
 * - 世界推进只发生在 {@link TickClock.tick} 内，且固定步长（fixed timestep）。
 * - 每 tick 的调用顺序稳定：先 world，再 entities，再 player，再 survival，
 *   由 {@link WorldSimulator}（见 src/core/simulator.ts）编排。
 * - 渲染循环与逻辑 tick 解耦；渲染只读取当前状态，不修改。
 */

/** 世界时间，单位：tick 数。白天=0..12000，夜晚=12000..24000（对应 Bedrock 白天循环）。 */
export type WorldTime = number;

/** 固定步长，毫秒。20 TPS（每现实秒 20 tick），贴近 Minecraft。 */
export const TICK_MS = 50;

export interface ClockOptions {
  /** 每秒 tick 数。默认 20。 */
  tps?: number;
  /** 初始世界时间（tick）。默认 0（日出）。 */
  startTime?: WorldTime;
}

/** 确定性 tick 时钟。 */
export class TickClock {
  readonly tps: number;
  readonly tickMs: number;
  private _worldTime: WorldTime;

  constructor(options: ClockOptions = {}) {
    this.tps = options.tps ?? 20;
    this.tickMs = 1000 / this.tps;
    this._worldTime = options.startTime ?? 0;
  }

  get worldTime(): WorldTime {
    return this._worldTime;
  }

  /** 推进一整个 tick，返回新世界时间。必须由模拟器在固定步长下调用。 */
  tick(): WorldTime {
    this._worldTime += 1;
    return this._worldTime;
  }

  /**
   * 从 elapsed 毫秒折算应执行的 tick 数。
   * 纯函数、确定性：同 elapsed 永远返回同值。
   */
  static ticksForElapsed(elapsedMs: number, tps = 20): number {
    return Math.max(0, Math.floor(elapsedMs / (1000 / tps)));
  }
}
