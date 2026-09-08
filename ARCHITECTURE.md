# 架构说明（阶段 0）

## 目标

无需安装、浏览器可玩的网页端 Minecraft Bedrock 1.4.0 复刻。阶段 0 提供可启动、可测试、可扩展的最小主干，并锁定确定性接口供后续并行模块接入。

## 目录

```
test1/
├── index.html                 # 入口 HTML + HUD 骨架
├── src/
│   ├── main.ts                # 引导：seed 解析、世界组装、渲染循环、tick 驱动
│   ├── style.css              # 首版 HUD/画布样式（窗口缩放自适应）
│   ├── index.ts               # 公共导出（稳定接口集）
│   ├── core/                  # 核心确定性：seed、tick、模拟编排
│   ├── world/                 # 世界：类型、确定性生成器
│   ├── player/                # 玩家：状态/控制/常数
│   ├── items/                 # 物品与背包契约
│   ├── survival/              # 生命/饥饿/伤害契约
│   ├── entities/              # 实体/生物契约
│   ├── save/                  # 存档契约
│   └── render/                # Three.js 渲染骨架
├── test/                      # Vitest 单元 + 固定 seed 冒烟
├── assets/                    # 素材目录（规范见 assets/README.md）
└── .github/workflows/ci.yml   # CI
```

## 关键设计决策

1. **确定性优先**：所有可复现随机经 `createRng(seed)` 派生；`TickClock` 固定 20 TPS；`WorldSimulator.step()` 固定 tick 顺序。这保证「same seed ⇒ same world」可复现，并为后续自动化验收（种子场景、性能采样）打基础。
2. **渲染与逻辑解耦**：`render/` 只读取 `GeneratedWorld` 公共接口，不修改世界；逻辑更新只在 tick 内。稳定接口 `WorldRead` 屏蔽内部实现。
3. **模块强类型契约**：每个模块导出明确接口与常数，后续阶段按契约实现，不改动已锁定签名。
4. **CI 铁闸**：安装 → 类型检查 → 单元测试 → 固定 seed 冒烟 → 构建 → preview 健康检查，所有 PR 必须通过。

## 依赖约定（本仓库）

- 运行时依赖仅有 `three`。
- 其余为开发/构建/测试工具（vite / typescript / vitest / eslint）。
- 不使用游戏引擎；未来功能扩展只允许渲染库层面的依赖，禁止引入会复制 MC 素材的包。
