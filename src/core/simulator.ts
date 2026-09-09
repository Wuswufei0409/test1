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
import type { Difficulty } from "../survival/types";
import {
  freshSurvival,
  tickSurvival,
  type SurvivalState,
} from "../survival/systems";

export interface SimulationSnapshot {
  worldTime: WorldTime;
  player: PlayerState;
  health: Health;
  hunger: Hunger;
  /** 空气（氧气）状态。 */
  air: { value: number; max: number };
  alive: boolean;
}

export class WorldSimulator {
  private survival: SurvivalState;
  private hungryTicks = 0;
  private drownTicks = 0;

  constructor(
    private readonly clock: TickClock,
    private readonly world: GeneratedWorld,
    private player: PlayerState,
    health: Health,
    hunger: Hunger,
    private readonly difficulty: Difficulty = "normal"
  ) {
    this.survival = { health, hunger, alive: true, air: freshSurvival().air };
  }

  /** 推进一个 tick，返回新快照。确定顺序：world -> entities -> player -> survival。 */
  step(input: { forward: boolean; back: boolean }): SimulationSnapshot {
    // 1) 世界 tick（地形/生物群系推进，阶段 1+ 实现方块更新）。
    this.world.getHeight(0, 0); // 触发惰性生成，保持只读。
    // 2) 实体 tick（阶段 1+）。
    // 3) 玩家 tick（阶段 1+ 物理）。此处仅推进时钟。
    this.clock.tick();
    // 4) 生存/饥饿推进。activity 由输入与前向决定（确定性）。
    const active = input.forward || input.back;
    const res = tickSurvival(
      this.survival,
      {
        inWater: this.player.inWater,
        active,
        difficulty: this.difficulty,
      },
      { hungryTicks: this.hungryTicks, drownTicks: this.drownTicks }
    );
    this.survival = res.state;
    this.hungryTicks = res.counters.hungryTicks;
    this.drownTicks = res.counters.drownTicks;
    return this.snapshot();
  }

  private snapshot(): SimulationSnapshot {
    return {
      worldTime: this.clock.worldTime,
      player: this.player,
      health: this.survival.health,
      hunger: this.survival.hunger,
      air: this.survival.air,
      alive: this.survival.alive,
    };
  }
}
