/**
 * 应用入口（阶段 0）。
 * - 从 URL ?seed= 或 localStorage 读取 seed，缺省用固定默认种子。
 * - 组装确定性地形世界 + 最小 Three.js 渲染。
 * - 运行确定性 tick 时钟与渲染循环。
 */

import { hashSeed } from "./core/seed";
import { TickClock } from "./core/tick";
import { StageRenderer } from "./render/scene";
import { GeneratedWorld } from "./world/generator";
import "./style.css";

const DEFAULT_SEED = 1400;

function resolveSeed(): number {
  const fromUrl = new URLSearchParams(window.location.search).get("seed");
  if (fromUrl !== null) {
    const n = Number(fromUrl);
    if (Number.isFinite(n)) return hashSeed(n);
    return hashSeed(fromUrl);
  }
  const stored = localStorage.getItem("mc1400:seed");
  if (stored !== null) {
    const n = Number(stored);
    if (Number.isFinite(n)) return n;
  }
  return DEFAULT_SEED;
}

function boot(): void {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  if (!canvas) throw new Error("canvas element not found");

  const seed = resolveSeed();
  const world = new GeneratedWorld(seed);
  const renderer = new StageRenderer(canvas);
  const clock = new TickClock({ tps: 20, startTime: 0 });

  renderer.renderWorld(world, 0, 0);

  let last = performance.now();
  let accumulated = 0;
  const frame = () => {
    const now = performance.now();
    let dt = Math.min(now - last, 250);
    last = now;
    accumulated += dt;
    const ticks = TickClock.ticksForElapsed(accumulated, clock.tps);
    if (ticks > 0) {
      accumulated -= ticks * clock.tickMs;
      for (let i = 0; i < ticks; i++) clock.tick();
    }
    renderer.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const status = document.getElementById("status");
  if (status) status.textContent = `Minecraft Web 1.4.0 — seed=${seed}`;
}

window.addEventListener("DOMContentLoaded", boot);
