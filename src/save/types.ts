/**
 * 存档模块契约：世界/玩家/背包/时间/方块修改的序列化。
 *
 * 约定：
 * - 存档必须是可 JSON 序列化的纯数据（无函数、无循环引用）。
 * - same seed + same modified blocks => 相同世界（满足验收 03/18）。
 * - 读取须校验版本与校验和；损坏存档要抛明确错误并提供安全回退。
 */

import type { Seed } from "../core/seed";
import type { WorldTime } from "../core/tick";
import type { ItemStack } from "../items/types";
import type { BlockPos, BlockId } from "../world/types";

/** 存档版本。递增以标识格式演进。 */
export const SAVE_FORMAT_VERSION = 1;

export interface SaveData {
  version: number;
  seed: Seed;
  worldTime: WorldTime;
  player: {
    position: BlockPos;
    exact: { x: number; y: number; z: number };
    rotation: { yaw: number; pitch: number };
    health: { value: number; max: number };
    hunger: { value: number; max: number; saturation: number };
    inventory: ReadonlyArray<ItemStack>;
    selectedSlot: number;
  };
  /** 玩家手工修改过的方块（覆盖生成的差异）。 */
  modifiedBlocks: ReadonlyArray<{ pos: BlockPos; block: BlockId }>;
  /** 实体关键状态（阶段 1+ 填充）。 */
  entities: ReadonlyArray<unknown>;
  /** 时间戳（仅信息性，不参与世界确定性）。 */
  savedAt: string;
}

/** 序列化/反序列化契约。 */
export interface SaveCodec {
  encode(data: SaveData): string;
  decode(serialized: string): SaveData;
}

/** 对存档作完整性校验，返回错误信息或 null（通过）。 */
export function validateSave(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return "not an object";
  const d = data as Partial<SaveData>;
  if (d.version !== SAVE_FORMAT_VERSION)
    return `unsupported version: ${d.version}`;
  if (typeof d.seed !== "number") return "missing/invalid seed";
  if (typeof d.worldTime !== "number") return "missing/invalid worldTime";
  return null;
}
