/**
 * FarmWorld：耕地/种植/生长/成熟/收获的确定性花园区。
 *
 * 责任：
 * - 维护一块矩形农田的落地状态（dirt/grass→farmland 耕耘）与作物阶段。
 * - 生长由种子确定性 RNG 驱动：光照（由世界时间→天空亮度换算）与邻接水（湿度）
 *   共同调节每 tick 的推进概率，从而「受时间或光照影响且可复现」。
 * - 收获产出为 items 模块物品（wheat/carrot/potato/wheat_seeds），
 *   可直接接入合成（面包）与熔炉（烤马铃薯）链路。
 *
 * 全部纯逻辑、确定性：相同 seed + 相同操作/tick 序列 => 相同结果。
 */

import type { ItemStack } from "../items/types";
import { skyBrightness } from "../world/cycle";
import type { CropDef, CropId, FarmCell, FarmOptions } from "./types";
import { cropDef } from "./types";

/** 确定性 LCG（原创实现，同 seed / 同调用序列必同输出）。 */
class Lcg {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x2f6e2b1;
  }
  next(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 0x100000000;
  }
}

/**
 * 由世界时间推导该时刻的天空光照等级（0..15）：
 * 白天高、夜晚低，因而作物在夜间无法推进。
 */
export function lightLevelAt(worldTime: number): number {
  return Math.floor(skyBrightness(worldTime) * 15);
}

/** 一块确定性农田。坐标 (x∈[0,width), z∈[0,depth))。 */
export class FarmWorld {
  readonly width: number;
  readonly depth: number;
  readonly seed: number;
  readonly growthChance: number;
  readonly dryPenalty: number;
  private readonly cells: FarmCell[];
  private readonly rng: Lcg;

  constructor(width = 16, depth = 16, options: FarmOptions = {}) {
    this.width = width;
    this.depth = depth;
    this.seed = options.seed ?? 0;
    this.growthChance = options.growthChance ?? 0.35;
    this.dryPenalty = options.dryPenalty ?? 0.5;
    this.rng = new Lcg(this.seed);
    this.cells = new Array(width * depth).fill(0).map(() => ({
      ground: "dirt",
      crop: null,
    }));
  }

  private idx(x: number, z: number): number {
    if (x < 0 || x >= this.width || z < 0 || z >= this.depth) {
      throw new Error(`farm coord out of range (${x},${z})`);
    }
    return z * this.width + x;
  }

  /** 读取某格。 */
  cell(x: number, z: number): FarmCell {
    const c = this.cells[this.idx(x, z)];
    return { ground: c.ground, crop: c.crop ? { ...c.crop } : null };
  }

  /**
   * 耕地：把 dirt/grass 翻成 farmland。仅这两种可翻。
   * 返回是否成功。若该格已种植则拒绝。
   */
  till(x: number, z: number): boolean {
    const i = this.idx(x, z);
    const c = this.cells[i];
    if (c.crop) return false;
    if (c.ground !== "dirt" && c.ground !== "grass") return false;
    c.ground = "farmland";
    return true;
  }

  /** 该格是否为已翻好的耕地。 */
  isFarmland(x: number, z: number): boolean {
    return this.cells[this.idx(x, z)].ground === "farmland";
  }

  /** 湿度：四邻接块中有水（或耕地相邻 water）。 */
  hydrated(x: number, z: number): boolean {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= this.width || nz < 0 || nz >= this.depth) continue;
      if (this.cells[this.idx(nx, nz)].ground === "water") return true;
    }
    return false;
  }

  /** 设置格内落地方块（供测试布置水/泥土等）。 */
  setGround(x: number, z: number, block: string): void {
    const i = this.idx(x, z);
    if (this.cells[i].crop) throw new Error("cannot change ground of planted cell");
    this.cells[i].ground = block;
  }

  /**
   * 种植：把种子放到已翻耕的空地上（阶段 0）。
   * 返回是否成功。seed 不需要从背包扣除（调用方管理）。
   */
  plant(x: number, z: number, crop: CropId): boolean {
    const i = this.idx(x, z);
    const c = this.cells[i];
    const def = cropDef(crop);
    if (!def) return false;
    if (c.ground !== "farmland") return false;
    if (c.crop) return false;
    c.crop = { crop, stage: 0, hydrated: this.hydrated(x, z) };
    return true;
  }

  /** 该格是否已种植指定作物。 */
  isPlanted(x: number, z: number, crop?: CropId): boolean {
    const c = this.cells[this.idx(x, z)];
    return !!c.crop && (crop === undefined || c.crop.crop === crop);
  }

  /** 当前生长阶段；未种植返回 -1。 */
  stage(x: number, z: number): number {
    const c = this.cells[this.idx(x, z)];
    return c.crop ? c.crop.stage : -1;
  }

  /**
   * 推进一个 tick 的生长。
   * 光照由 worldTime 推导（若无 lightOverride），因而受昼夜影响；
   * 生长概率 = growthChance * (灌溉 ? 1 : dryPenalty)。
   * 确定性：按固定行优先顺序逐格推进，且每次推进消费固定一次 RNG。
   */
  tick(worldTime = 0, lightOverride?: number): void {
    const light = lightOverride === undefined ? lightLevelAt(worldTime) : lightOverride;
    for (let z = 0; z < this.depth; z++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.cells[this.idx(x, z)];
        if (!c.crop) continue;
        const def = cropDef(c.crop.crop)!;
        // 湿度随邻接水更新
        c.crop.hydrated = this.hydrated(x, z);
        if (c.crop.stage >= def.stages - 1) continue; // 已成熟
        if (light < def.lightRequired) continue; // 光照不足，本 tick 不生长
        const chance = this.growthChance * (c.crop.hydrated ? 1 : this.dryPenalty);
        if (this.rng.next() < chance) {
          c.crop.stage += 1;
        }
      }
    }
  }

  /** 是否成熟（达到最高阶段）。 */
  isMature(x: number, z: number): boolean {
    const c = this.cells[this.idx(x, z)];
    if (!c.crop) return false;
    const def = cropDef(c.crop.crop)!;
    return c.crop.stage >= def.stages - 1;
  }

  /**
   * 收获：成熟则产出掉落并清除该格作物（耕地在）。
   * 掉落为确定性 RNG 抽取。未成熟或未种植返回空数组。
   */
  harvest(x: number, z: number): ItemStack[] {
    const i = this.idx(x, z);
    const c = this.cells[i];
    if (!c.crop) return [];
    const def = cropDef(c.crop.crop)!;
    if (c.crop.stage < def.stages - 1) return [];

    const drops: ItemStack[] = [];
    const n = def.dropRange.min + Math.floor(this.rng.next() * (def.dropRange.max - def.dropRange.min + 1));
    if (n > 0) drops.push({ id: def.id, count: n });
    for (const b of def.bonusDrops) drops.push({ ...b });
    c.crop = null;
    return drops;
  }

  /**
   * 确定性跑满生长：持续 tick（默认白昼光照）直到全部成熟或耗尽 maxTicks。
   * 供受限 tick 的确定性验收 / 全链路测试。
   */
  growUntilMature(worldTime = 6000, maxTicks = 10_000): void {
    for (let t = 0; t < maxTicks; t++) {
      this.tick(worldTime);
      let allMature = true;
      for (const c of this.cells) {
        if (c.crop) {
          const def = cropDef(c.crop.crop)!;
          if (c.crop.stage < def.stages - 1) {
            allMature = false;
            break;
          }
        }
      }
      if (allMature) return;
    }
  }
}

/** 便捷：某作物的成熟判定所需阶段数。 */
export function matureStageOf(crop: CropId): number {
  return (cropDef(crop) as CropDef).stages - 1;
}
