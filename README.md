# Minecraft Web 1.4.0（阶段 0 脚手架）

> 多 Agent 实验：网页端 Minecraft Bedrock 1.4.0 高还原度复刻。本仓库当前为 **阶段 0** —— 工程脚手架、架构契约、确定性 tick/seed 接口、CI 与原创素材规范。

## 技术栈

- **构建/运行**：Vite 5 + TypeScript 5（严格模式）
- **渲染库**：Three.js（允许的渲染库之一，不使用 Unity/Unreal/Godot 引擎）
- **测试**：Vitest（单元 + 固定 seed 冒烟）
- **CI**：GitHub Actions（安装 → 类型检查 → 单元测试 → 固定 seed 冒烟 → 构建 → 预览健康检查）

## 快速开始（可复现）

前置要求：Node.js ≥ 20，npm ≥ 9。

```bash
# 1) 安装依赖
npm ci

# 2) 本地开发（热更新）
npm run dev        # 默认 http://localhost:5173

# 3) 类型检查
npm run typecheck

# 4) 运行测试（含固定 seed 冒烟）
npm test

# 5) 生产构建
npm run build

# 6) 预览构建产物
npm run preview    # http://localhost:4173

# 一条命令全量校验
npm run check
```

**浏览器打开**：启动 `npm run dev` 后，用最新版桌面 Chromium 打开 `http://localhost:5173`。应看到带十字准星与 HUD 的 3D 方块地形画面，控制台无阻断级错误。可用 `?seed=<任意值>` 换一个确定性地形种子。

## 架构契约（供后续模块调用的稳定接口）

模块边界集中在 `src/`，每个模块导出稳定的 TypeScript 接口与常数：

| 模块 | 路径 | 接口/契约 |
| ---- | ---- | --------- |
| 核心确定性 | `src/core/seed.ts` | `createRng`/`hashSeed`/`Rng`，同 seed 必得同序列 |
| 核心确定性 | `src/core/tick.ts` | `TickClock`（20 TPS 固定步长）、`WorldTime`（0..24000） |
| 模拟编排 | `src/core/simulator.ts` | `WorldSimulator`，每 tick 固定顺序 world→entities→player→survival |
| 世界 | `src/world/types.ts` | `WorldRead`/`WorldMutate`、`BlockId`/`BiomeId`/`BlockPos` |
| 世界生成 | `src/world/generator.ts` | `DeterministicTerrainGenerator`、`GeneratedWorld`，同 seed 可复现 |
| 玩家 | `src/player/types.ts` | `PlayerState`/`PlayerInput`/`PLAYER_CONSTANTS` |
| 物品/背包 | `src/items/types.ts` | `ItemStack`/`Hotbar`/`Inventory`、`STACK_LIMIT` |
| 生存 | `src/survival/types.ts` | `applyDamage`/`Difficulty`、生命/饥饿契约 |
| 实体 | `src/entities/types.ts` | `EntityState`/`AiState`/`LootTable` |
| 存档 | `src/save/types.ts` | `SaveData`/`SaveCodec`/`validateSave` |

**确定性约定**：所有可复现随机来源必须经 `createRng` 派生；世界时间只通过 `TickClock.tick()` 在固定步长内推进；渲染与逻辑解耦。后续阶段必须保持同 seed 稳定性与 tick 顺序不变。

## 素材规范

见 [`assets/README.md`](assets/README.md)。`assets/` 仅存放原创或许可兼容占位资产，每个文件都记录来源；禁止从 Minecraft 安装包或商业素材包复制任何资产。

## CI

`.github/workflows/ci.yml` 覆盖：安装、类型检查、单元测试、固定 seed 冒烟测试、构建（`vite build`）与 preview 健康检查（HTTP 200）。部署/发布链接由集成 Issue（`delivery_role=integration`）统一维护。

## 分支协作契约

- 主分支 `main` 始终可运行、可测试。
- 各阶段/模块 Issue 使用独立功能分支，Merge 前必须通过 CI。
- PR 标题/正文含路由 Issue 键（如 `TES-<N>`）以建立链接。
- 共享 Issue / Goal / 代码 / 测试 / 证据为唯一协作真相源；交接只写回完成内容、验证证据、剩余风险与下一步。

## 已知限制（阶段 0）

- 仅有最小 3D 地形画面与确定性地基；无第一人称控制、采集/合成/生存/战斗/水下/存档加载（均为后续阶段）。
- 方块为占位纯色，非原创像素纹理（素材规范已就绪，纹理在后续阶段补充）。
