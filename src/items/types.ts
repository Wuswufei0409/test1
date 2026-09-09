/**
 * 物品/背包模块契约：物品栈、库存、快捷栏。
 *
 * 约定：
 * - 物品不可变；修改背包通过返回新状态或纯函数转换，便于存档与回放测试。
 * - 栈上限 {@link STACK_LIMIT}。
 */

/** 物品 ID（稳定字符串）。阶段 0 先声明工具/材料子集，W5 扩展为完整立方。 */
export type ItemId =
  // 空
  | "air"
  // 基础材料
  | "stick"
  | "coal"
  | "charcoal"
  | "iron_ingot"
  | "gold_ingot"
  | "diamond"
  | "lapis"
  | "flint"
  | "bowl"
  | "wheat"
  | "wheat_seeds"
  | "raw_iron"
  | "raw_gold"
  // 方块物品（可放置）
  | "dirt"
  | "grass_block"
  | "stone"
  | "cobblestone"
  | "sand"
  | "red_sand"
  | "sandstone"
  | "gravel"
  | "clay_ball"
  | "obsidian"
  | "log_oak"
  | "log_spruce"
  | "plank_oak"
  | "plank_spruce"
  | "leaves_oak"
  | "leaves_spruce"
  | "snow_block"
  | "ice"
  | "packed_ice"
  | "cactus"
  | "sugar_cane"
  | "mushroom_red"
  | "mushroom_brown"
  | "glass"
  | "crafting_table"
  | "chest"
  | "furnace"
  | "bookshelf"
  | "sea_lantern"
  | "prismarine"
  | "sponge"
  | "coral"
  | "coral_block"
  | "coal_ore"
  | "iron_ore"
  | "gold_ore"
  | "diamond_ore"
  | "lapis_ore"
  // 工具
  | "wooden_pickaxe"
  | "stone_pickaxe"
  | "iron_pickaxe"
  | "diamond_pickaxe"
  | "wooden_axe"
  | "stone_axe"
  | "iron_axe"
  | "diamond_axe"
  | "wooden_shovel"
  | "stone_shovel"
  | "iron_shovel"
  | "diamond_shovel"
  // 武器（剑；护甲/弓由 W6 统一）
  | "wooden_sword"
  | "stone_sword"
  | "iron_sword"
  | "diamond_sword"
  // 合成物
  | "torch"
  | "bucket"
  | "boat"
  | "ladder"
  // 食物（与 survival/food 保持一致）
  | "apple"
  | "bread"
  | "raw_porkchop"
  | "cooked_porkchop"
  | "carrot"
  | "potato"
  | "baked_potato";

/** 物品栈。count=0 视为空栈。 */
export interface ItemStack {
  readonly id: ItemId;
  readonly count: number;
}

export const STACK_LIMIT = 64;

/** 快捷栏（9 格）。 */
export interface Hotbar extends Slots {
  readonly selected: number;
}
/** 任意一组有序槽位。 */
export interface Slots {
  readonly size: number;
  /** 返回第 index 个槽的拷贝；越界返回空栈。 */
  get(index: number): ItemStack;
}

/** 库存契约（快捷栏 + 背包扩展格）。 */
export interface Inventory {
  readonly hotbar: Hotbar;
  /** 各槽物品数组（仅读）。 */
  readonly slots: ReadonlyArray<ItemStack>;
  /** 尝试堆叠物品，返回剩余未放入的数量（0 = 全部放入）。 */
  add(item: ItemStack): number;
  /** 取出 index 槽，可选数量。返回取出的物品。 */
  remove(index: number, count?: number): ItemStack;
  /** 交换两槽。 */
  swap(a: number, b: number): void;
  /** 深度拷贝（存档/快照）。 */
  toJSON(): ReadonlyArray<ItemStack>;
}
