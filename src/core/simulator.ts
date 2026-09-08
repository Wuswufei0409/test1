/**
 * 确定性世界模拟器：统一编排每 tick 的更新顺序。
 *
 * 约定（契约）：
 * 每个 tick 固定顺序：world -> entities -> player -> survival。
 * 该顺序不可重排，从而保证 same seed + same inputs 的确定性回放。
 */

import type { TickClock, WorldTime } from "./tick";
import type { GeneratedWorld } from "../world/generator";
import type { PlayerState } from "../player/types";
import type { Health, Hunger } from "../survival/types";

export interface SimulationSnapshot {
  worldTime: WorldTime;
  player: PlayerState;
  health: Health;
  hunger: Hunger;
}

export class WorldSimulator {
  constructor(
    private readonly clock: TickClock,
    private readonly world: GeneratedWorld,
    private player: PlayerState,
    private health: Health,
    private hunger: Hunger
  ) {}

  /** 推进一个 tick，返回新快照。确定顺序：world -> entities -> player -> survival。 */
  step(input: { forward: boolean; back: boolean }): SimulationSnapshot {
    // 1) 世界 tick（地形/生物群系推进，阶段 1+ 实现方块更新）。
    this.world.getHeight(0, 0); // 触发惰性生成，保持只读。
    // 2) 实体 tick（阶段 1+）。
    // 3) 玩家 tick（阶段 1+ 物理）。此处仅推进时钟。
    this.clock.tick();
    // 4) 生存/饥饿推进（阶段 1+）。此处保持原值。
    void input;
    return this.snapshot();
  }

  private snapshot(): SimulationSnapshot {
    return {
      worldTime: this.clock.worldTime,
      player: this.player,
      health: this.health,
      hunger: this.hunger,
    };
  }
}
