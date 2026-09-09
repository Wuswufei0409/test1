# 素材说明与许可规范

本目录仅存放**原创**或**许可兼容**的资产。**禁止**从 Minecraft 安装包、商业素材包或受版权保护的来源复制任何代码、纹理、模型、音频或商标素材。

## 规范（所有标注方块的资产必须遵守）

1. 每个资产文件都必须在下方「资产登记表」登记：路径、类型、来源、许可证。
2. `原创建意资产`：作者 = 本仓库 Agent 或协作者，许可证默认 MIT（与仓库一致）。
3. `占位资产`：一律为中性占位（纯色/程序生成），不得使用受版权保护的视觉元素。
4. 任何外部依赖资产必须提供可核验的来源链接与许可证全文（或 SPDX 标识）。

## 素材目录结构

```
assets/
  textures/   # 方块/物品像素纹理（阶段 1+ 填充占位）
  models/     # 模型占位（阶段 1+）
  audio/      # 音效/音乐（阶段 1+）
  README.md   # 本文件
```

## 资产登记表

| 路径 | 类型 | 来源 | 许可证 | 说明 |
| ---- | ---- | ---- | ------ | ---- |
| `textures/`（程序生成） | 纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | 阶段 1：48 个方块的程序生成像素纹理，见下方逐项登记 |
| `audio/`（目录级占位） | 音频 | — | — | 暂无音频资产 |
| `models/`（目录级占位） | 模型 | — | — | 暂无模型资产 |

### 纹理逐项登记（程序生成，原创建意资产）

| 路径 | 类型 | 来源 | 许可证 | 说明 |
| ---- | ---- | ---- | ------ | ---- |
| `textures/air.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | air 方块基础色 + 确定性像素噪声 |
| `textures/bedrock.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | bedrock 方块基础色 + 确定性像素噪声 |
| `textures/bookshelf.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | bookshelf 方块基础色 + 确定性像素噪声 |
| `textures/cactus.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | cactus 方块基础色 + 确定性像素噪声 |
| `textures/chest.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | chest 方块基础色 + 确定性像素噪声 |
| `textures/clay.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | clay 方块基础色 + 确定性像素噪声 |
| `textures/coal_ore.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | coal_ore 方块基础色 + 确定性像素噪声 |
| `textures/coarse_dirt.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | coarse_dirt 方块基础色 + 确定性像素噪声 |
| `textures/cobblestone.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | cobblestone 方块基础色 + 确定性像素噪声 |
| `textures/coral.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | coral 方块基础色 + 确定性像素噪声 |
| `textures/coral_block.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | coral_block 方块基础色 + 确定性像素噪声 |
| `textures/crafting_table.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | crafting_table 方块基础色 + 确定性像素噪声 |
| `textures/diamond_ore.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | diamond_ore 方块基础色 + 确定性像素噪声 |
| `textures/dirt.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | dirt 方块基础色 + 确定性像素噪声 |
| `textures/flower_blue_orchid.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | flower_blue_orchid 方块基础色 + 确定性像素噪声 |
| `textures/flower_dandelion.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | flower_dandelion 方块基础色 + 确定性像素噪声 |
| `textures/flower_poppy.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | flower_poppy 方块基础色 + 确定性像素噪声 |
| `textures/furnace.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | furnace 方块基础色 + 确定性像素噪声 |
| `textures/gold_ore.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | gold_ore 方块基础色 + 确定性像素噪声 |
| `textures/grass.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | grass 方块基础色 + 确定性像素噪声 |
| `textures/gravel.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | gravel 方块基础色 + 确定性像素噪声 |
| `textures/ice.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | ice 方块基础色 + 确定性像素噪声 |
| `textures/iron_ore.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | iron_ore 方块基础色 + 确定性像素噪声 |
| `textures/kelp.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | kelp 方块基础色 + 确定性像素噪声 |
| `textures/lapis_ore.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | lapis_ore 方块基础色 + 确定性像素噪声 |
| `textures/lava.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | lava 方块基础色 + 确定性像素噪声 |
| `textures/leaves_oak.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | leaves_oak 方块基础色 + 确定性像素噪声 |
| `textures/leaves_spruce.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | leaves_spruce 方块基础色 + 确定性像素噪声 |
| `textures/log_oak.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | log_oak 方块基础色 + 确定性像素噪声 |
| `textures/log_spruce.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | log_spruce 方块基础色 + 确定性像素噪声 |
| `textures/mushroom_brown.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | mushroom_brown 方块基础色 + 确定性像素噪声 |
| `textures/mushroom_red.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | mushroom_red 方块基础色 + 确定性像素噪声 |
| `textures/obsidian.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | obsidian 方块基础色 + 确定性像素噪声 |
| `textures/packed_ice.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | packed_ice 方块基础色 + 确定性像素噪声 |
| `textures/planks_oak.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | planks_oak 方块基础色 + 确定性像素噪声 |
| `textures/prismarine.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | prismarine 方块基础色 + 确定性像素噪声 |
| `textures/red_sand.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | red_sand 方块基础色 + 确定性像素噪声 |
| `textures/sand.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | sand 方块基础色 + 确定性像素噪声 |
| `textures/sandstone.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | sandstone 方块基础色 + 确定性像素噪声 |
| `textures/sea_grass.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | sea_grass 方块基础色 + 确定性像素噪声 |
| `textures/sea_lantern.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | sea_lantern 方块基础色 + 确定性像素噪声 |
| `textures/snow.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | snow 方块基础色 + 确定性像素噪声 |
| `textures/sponge.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | sponge 方块基础色 + 确定性像素噪声 |
| `textures/stone.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | stone 方块基础色 + 确定性像素噪声 |
| `textures/sugar_cane.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | sugar_cane 方块基础色 + 确定性像素噪声 |
| `textures/tall_grass.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | tall_grass 方块基础色 + 确定性像素噪声 |
| `textures/water.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | water 方块基础色 + 确定性像素噪声 |
| `textures/wheat.png` | 程序生成像素纹理 | 原创（脚本 scripts/generate-textures.mjs） | MIT | wheat 方块基础色 + 确定性像素噪声 | | 纹理 | 原创/程序生成 | MIT | 阶段 0 未放置实际纹理；渲染先用代码内纯色占位 |
| `audio/`（目录级占位） | 音频 | — | — | 暂无音频资产 |
| `models/`（目录级占位） | 模型 | — | — | 暂无模型资产 |

> 阶段 0 不包含任何位图/音频/网格二进制资产，避免引入来源不明素材。后续阶段放入资产时必须先在本文登记。

## 代码生成纹理说明（可选）

渲染层可动态生成像素纹理（canvas 程序绘制），此类属于原创建意资产，无需额外授权，但在 `src/render/` 内注明「程序生成」即可。

## 商标声明

「Minecraft」为 Mojang Studios / Microsoft 的商标，仅作玩法还原的指称性使用；本仓库不包含其商标素材、图标或受保护的视觉资产。
