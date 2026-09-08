import { describe, expect, it } from "vitest";
import { TickClock } from "../../src/core/tick";
import { WorldSimulator } from "../../src/core/simulator";
import { DeterministicTerrainGenerator } from "../../src/world/generator";
import type { PlayerState } from "../../src/player/types";
import type { Health, Hunger } from "../../src/survival/types";

function makePlayer(): PlayerState {
  return {
    position: { x: 0, y: 4, z: 0 },
    exact: { x: 0.5, y: 4, z: 0.5 },
    rotation: { yaw: 0, pitch: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    onGround: true,
    inWater: false,
    sprinting: false,
    sneaking: false,
  };
}

describe("TickClock", () => {
  it("advances world time by one per tick", () => {
    const clock = new TickClock({ startTime: 0 });
    expect(clock.tick()).toBe(1);
    expect(clock.tick()).toBe(2);
    expect(clock.worldTime).toBe(2);
  });

  it("ticksForElapsed is deterministic", () => {
    const a = TickClock.ticksForElapsed(1000, 20);
    const b = TickClock.ticksForElapsed(1000, 20);
    expect(a).toBe(20);
    expect(a).toBe(b);
    expect(TickClock.ticksForElapsed(49, 20)).toBe(0);
  });
});

describe("WorldSimulator deterministic order", () => {
  it("advances time deterministically across steps", () => {
    const clock = new TickClock({ startTime: 0 });
    const world = new DeterministicTerrainGenerator(1400);
    void world;
    const sim = new WorldSimulator(
      clock as never,
      new (class {
        getHeight(): number {
          return 10;
        }
      })() as never,
      makePlayer(),
      { value: 20, max: 20 } as Health,
      { value: 20, max: 20, saturation: 5 } as Hunger
    );
    const s1 = sim.step({ forward: false, back: false });
    const s2 = sim.step({ forward: false, back: false });
    expect(s1.worldTime).toBe(1);
    expect(s2.worldTime).toBe(2);
  });
});
