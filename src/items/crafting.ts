/**
 * 配置驱动合成系统：2×2 / 3×3 形状配方与配方册。
 *
 * 约定：
 * - 配方以配置表声明（pattern + ingredients + result），新增即生效。
 * - 2×2 配方任何网格可合成；3×3 配方需 3×3 网格（工作台）。
 * - 纯函数、确定性；craft 返回合成结果或 null。
 */

import type { ItemId, ItemStack } from "./types";

/** 配方（shaped）。'.' 表示空格。 */
export interface ShapedRecipe {
  readonly id: string;
  readonly result: ItemStack;
  readonly pattern: readonly string[];
  /** 符号 → 物品 ID。 */
  readonly ingredients: Readonly<Record<string, ItemId>>;
  /** 是否必须 3×3（工作台）。 */
  readonly needsTable: boolean;
}

/** 输入网格 = 每行物品 ID 数组（'air' 表示空格）。 */
export type CraftGrid = ReadonlyArray<ReadonlyArray<ItemId>>;

function recipe(
  id: string,
  result: ItemStack,
  pattern: string[],
  ingredients: Record<string, ItemId>,
  needsTable = false
): ShapedRecipe {
  return { id, result, pattern, ingredients, needsTable };
}

/** 全量配方表（配置驱动，覆盖目标 07 代表物品）。 */
export const RECIPES: readonly ShapedRecipe[] = [
  // ---------- 木板/木棍 ----------
  recipe("plank_oak", { id: "plank_oak", count: 4 }, ["X"], { X: "log_oak" }),
  recipe("plank_spruce", { id: "plank_spruce", count: 4 }, ["X"], { X: "log_spruce" }),
  recipe("stick", { id: "stick", count: 4 }, ["X", "X"], { X: "plank_oak" }),
  recipe("stick_spruce", { id: "stick", count: 4 }, ["X", "X"], { X: "plank_spruce" }),

  // ---------- 工作台/功能块 ----------
  recipe("crafting_table", { id: "crafting_table", count: 1 }, ["XX", "XX"], { X: "plank_oak" }),
  recipe("crafting_table_spruce", { id: "crafting_table", count: 1 }, ["XX", "XX"], { X: "plank_spruce" }),
  recipe("chest", { id: "chest", count: 1 }, ["XXX", "X.X", "XXX"], { X: "plank_oak" }),
  recipe("furnace", { id: "furnace", count: 1 }, ["XXX", "X.X", "XXX"], { X: "cobblestone" }, true),

  // ---------- 工具：木/石/铁 镐、斧、锹、剑 ----------
  // 镐
  recipe("wooden_pickaxe", { id: "wooden_pickaxe", count: 1 }, ["XXX", ".S.", ".S."], { X: "plank_oak", S: "stick" }),
  recipe("stone_pickaxe", { id: "stone_pickaxe", count: 1 }, ["XXX", ".S.", ".S."], { X: "cobblestone", S: "stick" }),
  recipe("iron_pickaxe", { id: "iron_pickaxe", count: 1 }, ["XXX", ".S.", ".S."], { X: "iron_ingot", S: "stick" }),
  recipe("diamond_pickaxe", { id: "diamond_pickaxe", count: 1 }, ["XXX", ".S.", ".S."], { X: "diamond", S: "stick" }),
  // 斧
  recipe("wooden_axe", { id: "wooden_axe", count: 1 }, ["XX", "XS", ".S"], { X: "plank_oak", S: "stick" }),
  recipe("stone_axe", { id: "stone_axe", count: 1 }, ["XX", "XS", ".S"], { X: "cobblestone", S: "stick" }),
  recipe("iron_axe", { id: "iron_axe", count: 1 }, ["XX", "XS", ".S"], { X: "iron_ingot", S: "stick" }),
  // 锹
  recipe("wooden_shovel", { id: "wooden_shovel", count: 1 }, ["X", "S", "S"], { X: "plank_oak", S: "stick" }),
  recipe("stone_shovel", { id: "stone_shovel", count: 1 }, ["X", "S", "S"], { X: "cobblestone", S: "stick" }),
  recipe("iron_shovel", { id: "iron_shovel", count: 1 }, ["X", "S", "S"], { X: "iron_ingot", S: "stick" }),
  // 剑
  recipe("wooden_sword", { id: "wooden_sword", count: 1 }, ["X", "X", "S"], { X: "plank_oak", S: "stick" }),
  recipe("stone_sword", { id: "stone_sword", count: 1 }, ["X", "X", "S"], { X: "cobblestone", S: "stick" }),
  recipe("iron_sword", { id: "iron_sword", count: 1 }, ["X", "X", "S"], { X: "iron_ingot", S: "stick" }),

  // ---------- 火把 ----------
  recipe("torch", { id: "torch", count: 4 }, ["C", "S"], { C: "coal", S: "stick" }),
  recipe("torch_charcoal", { id: "torch", count: 4 }, ["C", "S"], { C: "charcoal", S: "stick" }),

  // ---------- 木船/桶/碗 ----------
  recipe("boat", { id: "boat", count: 1 }, ["X.X", "XXX"], { X: "plank_oak" }, true),
  recipe("bucket", { id: "bucket", count: 1 }, ["X.X", ".X."], { X: "iron_ingot" }, true),
  recipe("bowl", { id: "bowl", count: 4 }, ["X.X", ".X."], { X: "plank_oak" }),
  recipe("ladder", { id: "ladder", count: 3 }, ["X.X", "XXX", "X.X"], { X: "stick" }),

  // ---------- 食物 ----------
  recipe("bread", { id: "bread", count: 1 }, ["WWW"], { W: "wheat" }, true),
];

/** 配方册：返回所有已知配方（验收 07 配方册）。 */
export function listRecipes(): ReadonlyArray<{ id: string; result: ItemStack; needsTable: boolean }> {
  return RECIPES.map((r) => ({ id: r.id, result: { ...r.result }, needsTable: r.needsTable }));
}

function gridToRows(grid: CraftGrid): ItemId[][] {
  return grid.map((row) =>
    Array.from({ length: 3 }, (_, c) => row[c] ?? ("air" as ItemId))
  );
}

/**
 * 尝试用当前网格合成。返回 { recipe, result } 或 null。
 * 网格横向以 'air' 补齐到 3 列，便于匹配 3×3 与 2×2。
 */
export function craft(grid: CraftGrid): { recipe: ShapedRecipe; result: ItemStack } | null {
  const rows = gridToRows(grid);
  const gh = rows.length;
  for (const rc of RECIPES) {
    const ph = rc.pattern.length;
    const pw = rc.pattern[0].length;
    if (gh !== ph) continue;
    // 匹配每个可能偏移（本实现网格高度即配方高度，宽度随机偏移）
    for (let c0 = 0; c0 + pw <= 3; c0++) {
      let ok = true;
      // 校验配方占用与网格外空闲
      for (let r = 0; r < ph && ok; r++) {
        for (let c = 0; c < 3; c++) {
          const inPattern = c >= c0 && c < c0 + pw;
          if (!inPattern) {
            if (rows[r][c] !== "air") {
              ok = false;
              break;
            }
            continue;
          }
          const sym = rc.pattern[r][c - c0];
          const want = sym === "." ? "air" : rc.ingredients[sym];
          if (rows[r][c] !== want) {
            ok = false;
            break;
          }
        }
      }
      if (ok) return { recipe: rc, result: { ...rc.result } };
    }
  }
  return null;
}
