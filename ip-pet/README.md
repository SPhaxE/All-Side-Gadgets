# 暖橙水滴 IP · 复刻 + 可交互桌宠

打开 `index.html` 即可验收（纯静态，无构建、无外部脚本；字体走 Google Fonts，离线时回退系统字体）。

## Part 1 · 8 步复刻（对照 `ref/step*.jpg`）

| 步 | 教程 | SVG 实现 |
|---|---|---|
| 1 | 画一个方 | `rect` 100×100，`#FF764F`（原图取色） |
| 2 | 拖动圆角为水滴 | 三角 r=60，右上角 r=9 的路径 |
| 3 | 渐变 | `linearGradient` 左上→右下 `#FF413B → #FCD685` |
| 4 | 高光形状 | 白色椭圆 rx 8.5 / ry 15，旋转 35° |
| 5 | 内发光 | 教程参数：滤色 · `#FDE3A7` · 60% · 100px · 边缘 → 反相 alpha 模糊后 `in` 原形，`feBlend mode=screen`（SVG 与 AI 的内发光算法不同，内发光 stdDeviation 13、不透明度 0.9 都是对照原图调出的等效值，不是换算值） |
| 6 | 高光高斯模糊 | 教程半径 129.1px；原画板尺寸未知，SVG 用对照原图调出的等效值 `stdDeviation 3.6` |
| 7 | 眼睛与投影 | 圆角矩形眼、ω 嘴描边、`#FF785A` 投影椭圆 |
| 8 | 投影高斯模糊 | `stdDeviation 12`，不透明度 55%（对照原图调出） |

几何数值从原图量取（水滴外接框 692px ↔ 120 单位）。每张卡片的 viewBox 与原图裁切框对齐，切到「原图」可直接对照。

## Part 2 · 按 pet-forge SVG 路线落地

参考 [rullerzhou-afk/pet-forge](https://github.com/rullerzhou-afk/pet-forge)：

0. **拓扑清点**：身体、双眼、嘴、高光、投影；无四肢 → 不做肢体 rig。
1. **基础形象**：教程 8 步即设计稿。源图本身是矢量教程，SVG 手写复刻，**没有**跑 `png2svg`/vtracer 描摹。
2. **可编辑 SVG**：分层命名；滤镜/渐变 id 按实例加前缀（页面上 10 份 SVG 不会互相串 id）。
3. **hello-idle 基线**：`viewBox 0 0 200 200`、`<g id="pet">`、`--breath-period / --breath-min / --breath-max / --blink-min-gap / --blink-max-gap / --blink-duration`。
4. **逐动作迭代**：14 个状态，名称取自 `shared/state-map.md`，按 A/B/C 三类实现：
   - **A 循环**：`idle` `idle-dozing` `sleeping` `thinking` `working-typing` `error` `react-drag`
   - **B 一次性、回到原姿态**：`idle-look` `idle-yawn`（链到 `idle-dozing`）`happy` `notification` `react-poke`
   - **C 过渡、首≠尾**：`collapse-sleep → sleeping`，`wake → idle`
5. **接入运行时**：Agent 事件映射 `UserPromptSubmit→thinking`、`PreToolUse→working-typing`、`PostToolUseFailure→error`、`PermissionRequest→notification`、`Stop→happy`；无事件计时入睡（pet-forge 默认 60s，页面默认 20s 便于验收（`idle-yawn` 播完链到 `idle-dozing`，不回原姿态），可调 8–60s）。拖动时由宿主元素移动、SVG 只做表演，符合 pet-forge「宿主负责位移」的约定。

## 交互

- 单击 → `react-poke`；1.5s 内连点 3 下 → `happy`
- 按住拖起 → `react-drag`（随速度摆动、影子留地面并缩小），松手回弹落地
- 眼睛跟随指针；随机眨眼、随机张望
- 静置 → `idle-yawn → idle-dozing → collapse-sleep → sleeping`；睡着点一下 → `wake → idle`
