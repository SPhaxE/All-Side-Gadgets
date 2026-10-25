# 20 种视效演示视频 · 交接文档

状态：**进行中，已按要求在 04 完成后暂停。还没有产出任何视频。**
分支：`claude/clever-allen-27vz0a`　目录：`showcase/`

## 1. 目标与硬性要求（来自用户）

- 一个视觉效果拉满的动态演示视频，依次展示图中 20 种视效：
  1 Liquid morph · 2 ASCII art · 3 Holographic foil · 4 Bauhaus shapes · 5 Neon glow · 6 Dithering · 7 Clay 3D · 8 Halftone dots · 9 Kinetic typography · 10 Pixel art · 11 Particle swarm · 12 Risograph print · 13 Glitch effect · 14 Topographic lines · 15 Glassmorphism · 16 Paper cutout · 17 Vaporwave grid · 18 Flow fields · 19 Metaballs · 20 Ray-marched fractals
- **首尾无缝衔接**，循环播放察觉不出（不能有淡黑、片头片尾卡）。
- **先不做音效**，但脚本里要注明每段合适的音效/配乐搭配，供下阶段制作。
- 项目规则（`CLAUDE.md` / `.claude/rules/`）：新功能先让 `architect` 出方案（已做）；长命令一律 `run_in_background`；同一问题修 2 次仍失败要先咨询 advisor/architect；合并或上线前让 `architect` 终审。

## 2. 已定架构

方案经过 `architect`（Opus）评审，采纳了其中的修改。

- **渲染**：一个 HTML 页面（`index.html`）+ 单个 WebGL2 上下文。无 GPU，用 Chromium 的 SwiftShader（启动参数见 `tools/render.js`）。Playwright 逐帧调用 `window.renderFrame(i)` 后截图，再用 ffmpeg 编码。
- **全部场景无状态**：画面只是 `(局部时间 s, 全局时间 tg)` 的纯函数。禁止 `Math.random` / `Date.now` / `performance.now`，不做帧反馈、不做 boids 之类积分仿真。这样才能多进程分块渲染，也才能保证循环。
- **时间轴**（`src/core.js`）：30fps；每段 `D=4.5s`；转场总长 0.9s（`HT=0.45`，居中于场景边界）；`T=20×4.5=90s`，`N=2700` 帧。`renderFrame(f)` 内部取 `f mod N`，`PHASE=0.5`，所以第 0 帧是场景 1 的干净画面，20→1 的转场整段落在片尾。**第 N 帧必须与第 0 帧逐字节相同**（待验证，见 §6）。
- **场景接口**：`Engine.register(编号, 场景)`。工厂：
  - `shaderScene({w,h,frag,hudDark})`：frag 里写 `vec3 scene(vec2 fc)`，序言里有 `hash/noise/fbm/pal/rot/hsv2rgb/ease` 等，uniform 有 `uRes uS uT uTau`。
  - `canvasScene({w,h,draw(ctx,s,w,h)})`：Canvas2D 绘制后 `texImage2D` 上传。
  - `postScene({w,h,draw,frag})`：Canvas2D 层作为 `uTex` 交给 shader 合成/后处理。
  - `customScene({init,render})`：多 pass 或自管程序（02 ASCII 是例子）。
- **转场**（`src/transitions.js`）：20 个主题化转场，`type` = 出场场景序号（0 起），一个 `transition()` 大 switch。20→1 是"液态翘曲擦除"。**写好了，但从未目检过。**
- **HUD**（`core.js` 的 `drawHud`）：左下编号+英文名+中文名，竖向滑动切换；右下 20 刻度环形拨盘；左上标签；右上转圈标记。全部对 T 周期化，所以环形拨盘在 20→1 时无跳变。场景的 `hudDark:true` 表示该场景是浅色底，HUD 改用深色字。
- 合成层末尾加 ±1/255 的确定性噪声（种子 = 帧号）防色带。
- 字体：系统自带 Inter / Inter Display / JetBrains Mono / WenQuanYi Zen Hei，页面在 `__ready` 前会 `document.fonts.load`。不依赖外部资源。

## 3. 目录

```
showcase/
  index.html            加载 core、transitions、20 个场景文件
  src/core.js           引擎、时间轴、HUD、合成
  src/transitions.js    20 个转场 GLSL
  src/scenes/NN-name.js 场景（见 §4 状态）
  tools/render.js       分块并行渲染；默认清空输出目录，--resume 才续跑
  tools/shot.js         单帧/单场景截图：node tools/shot.js <outdir> scene:5:2.0 frame:1234 [--scale 0.5]
  out/                  产物与中间文件，已 gitignore（frames、shots）
```

## 4. 场景状态

| # | 文件 | 状态 |
|---|---|---|
| 1 Liquid morph | `01-liquid.js` | ✅ 已目检。铬面液态 + 形状 morph（log-sum-exp 软并 + 大步长差分法线）。小球中心有轻微"风车"高光，可接受 |
| 2 ASCII art | `02-ascii.js` | ✅ 已目检。3D 环面→160×45 小图→字形图集（亮度梯度 + `-/|\` 边缘字符）+ 数字雨。已把相机拉远，**拉远后的版本没再看** |
| 3 Holographic foil | `03-holo.js` | ✅ 已目检（调整前一版）。三张全息卡 + 薄膜彩虹 + 闪粉 + 扫光。调大了卡片并减弱衍射纹，**调整后没再看** |
| 4 Bauhaus | `04-bauhaus.js` | ✅ 已目检。7×4 瓦片翻转波（对角/径向/散点）。刚修了环形瓦片的楔形缺口，已确认。注意：深色瓦片上 HUD 深色字可读性差，需要评估（见 §5） |
| 5 Neon glow | `05-neon.js` | ⚠️ **已写，编译通过、能出图，但没看过画面**，不要当作完成 |
| 6–19 | `06-…19-…js` | ⬜ 占位 stub（渐变色块），**要整体重写**，只有文件名和注册编号是对的 |
| 20 Ray-marched fractals | `20-fractal.js` | ✅ 已目检。Mandelbulb 俯冲，轨道陷阱着色 + 雾 + 发光，约 1.4s/帧（含截图、1280×720 内部分辨率） |

## 5. 下一步（按顺序）

1. 目检 05（`node tools/shot.js out/shots scene:5:0.2 scene:5:3.0`），再复看 02/03 的调整后画面。
2. 写 06–19。设计思路已定，要点：
   - 06 抖动：Bayer/聚点/随机三种阈值 + CGA 青品红白黑调色板，用移动竖线切换模式；像素块 ≥3px。
   - 07 黏土：SDF 光线步进 1280×720，哑光 + 噪声指纹凹凸 + 软阴影 + 软 AO，**15fps 定格**（`floor(s*15)/15`，不要 12fps），三个带眼睛的角色挤压拉伸弹跳。
   - 08 半调：旋转 CMYK 网点（角度 15/75/0/45），网点周期 ≥12px，正片叠底套印，纸色底（`hudDark:true`）。
   - 09 动态字体：Canvas2D，Inter 900 巨型字，逐字下落回弹 → 切片错位 → 多行跑马 → 字母翻转；背景色块擦除切换（柠绿/黑/粉/米白）。
   - 10 像素画：320×180 Canvas2D + 最近邻放大（`nearest:true`，场景 w=320,h=180），视差山脉/城市/落日/跑步精灵，10fps 精灵动画。
   - 11 粒子群：自管 WebGL，`gl_VertexID` 在顶点着色器里按 `f(id,s)` 解析计算位置，≥5 万粒子 ×4 个时间偏移做拖影，加色混合；混沌→成形→炸散。
   - 12 孔版印刷：荧光粉/蓝/黄三个专色，正片叠底，套印错位 ≥4px，颗粒 + 纸纹，纸色底。
   - 13 故障：`postScene`，Canvas2D 画底图（巨字 GLITCH + 色条），shader 做切片位移/RGB 分离（≥4px）/块损坏/扫描线，静止与爆发交替。
   - 14 等高线：fbm 高度场，`fract` + `fwidth` 抗锯齿，每 5 条加粗，深底按高程着色，边框刻度。
   - 15 玻璃拟态：背景用解析"模糊"（放宽边缘）的锐利彩色形状，圆角玻璃卡片 + 高光描边 + 噪点 + UI 元素；**bloom/模糊必须在 GL 里做，不要用 `ctx.filter`**（软件渲染太慢）。
   - 16 剪纸：Canvas2D 分层纸片 + 投影 + 不规则切边 + 纸纹，15fps 定格抖动，浅色底。
   - 17 蒸汽波：条纹落日 + 透视滚动网格 + 铬字（含日文，IPA Gothic）+ VHS 扫描线。
   - 18 流场：Canvas2D 从种子点在随时间变化的向量场里前向积分，线段沿路径滑动、按 `hash(id, floor(s/life))` 循环重生，按角度着色。
   - 19 融球：2D 熔岩灯等值色带 + 颈部桥接 + 高光，**与 01 明显区分**（01 是 3D 铬面，19 是平面色带）。
   - 评审给的每场景"必须有"要素：见本次会话 `architect` 的清单，要点已融进上面各条。
3. 整体检查：浅色底场景（4/8/12/16 及部分 9）与暗色场景要交替；每场景在约 60% 处（s≈2.7）要有一个"高潮瞬间"；编码会抹掉细节，所以：套印/RGB 分离 ≥4px、抖动块 ≥3px、网点 ≥8px、ASCII 字符 ≥10px。
4. 目检 20 个转场（每个边界出 6 帧触点图），尤其是 `transitions.js` 里完全没验证过的那些。
5. **实测渲染吞吐**：分开测"着色"和"截图"耗时（PNG vs JPEG），再测 1/2/4 个 worker 的总吞吐，算出 2700 帧总耗时。SwiftShader 本身多线程，4 个 worker 很可能拿不到 4 倍。最坏帧在 19→20 转场（两个场景同时渲）。必要时给光线步进场景降内部分辨率。
6. 低清草稿（`--scale 0.5` 或隔帧）审节奏 → 1080p 全量渲染（**放后台跑**，`run_in_background`）。
7. 编码（见 §7）→ 验证 → 生成分镜 → 交 `architect` 终审 → `SendUserFile` 把 mp4 发给用户（用户在 app 里看，只 push 分支不方便看）。

## 6. 验收清单（都还没做）

- `renderFrame(N)` 与 `renderFrame(0)` 逐字节一致（`renderFrame` 内部会取模，所以要比较 `f=0` 与"第 N 帧"的内部时间，可用 `renderScene` 之类的调试入口或临时去掉取模）。
- 冷启动单帧渲染与顺序渲染结果一致（确定性）。
- `diff(帧 N-1, 帧 0)` ≤ 相邻帧 diff 中位数 ×1.5；用 `ffmpeg -stream_loop 1` 拼两遍，抽接缝前后帧目检。
- `ffprobe -count_frames` 帧数 = 2700。
- 每个场景 9 帧触点图 + 每个转场 6 帧触点图（`tools/` 里还没有触点图脚本，用 PIL 写一个即可，numpy/PIL 已装）。

## 7. 编码参数（建议）

```
ffmpeg -framerate 30 -i f%05d.jpg \
  -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -bf 0 -g 30 -keyint_min 30 -sc_threshold 0 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an out.mp4
```

- 必须显式指定 bt709，否则饱和色会偏。
- 不要把 mp4 提交进库如果超过 100MB（GitHub 单文件上限）。CRF 16 + 颗粒较多的场景估计 120–250MB；要入库的话另出 720p / CRF 23 的预览版，或先问用户。
- 帧目录体积大（PNG 约 5–10GB），渲完清理。

## 8. 分镜脚本与音效（还没做）

- 单一事实源：计划新增 `src/timeline.js`（顺序、名称、每段 beats、音效/配乐提示），HUD 的 `NAMES` 和分镜都从它生成，避免时间码和视频对不上。`tools/gen-storyboard.js` 生成中文 `docs/storyboard.md`（逐段时间码 + 画面节拍 + 音效/配乐建议）。
- 时间码：场景 k（1 起）的"主体"区间是 `[(k-1)×4.5, k×4.5)` 秒减去 `PHASE=0.5`（视频第 0 秒对应全局时间 0.5s）。转场区间居中于边界、总长 0.9s。
- 音效这一阶段**不做**，只在分镜里写建议。

## 9. 已知坑

- GLSL 里不要用内建函数名做自定义函数名（`sign` 撞过名，已改成 `neonSign`）。
- 所有场景 shader 在 `initEngine()` 时一起编译，任何一个编译失败整个页面都不会 ready（`window.__error` 有错误文本，`tools/shot.js` 会打印）。
- `core.js` 里 `composite()` 早期有死代码已清理；HUD 的 `themeMix` 在转场中点附近线性切换。
- 用 `file://` 打开页面，因此场景文件都是普通 `<script>`，不要用 ES module（会被 CORS 拦）。
- `shot.js` 单次含启动开销，场景耗时以 `render.js` 的 `ms/frame` 为准。
- HUD 在深色瓦片（04）和极亮背景上的可读性还没有系统处理，评审意见是 HUD 要细、半透明、不抢戏，必要时给 HUD 加按场景的亮度自适应。

## 10. 未提交的内容说明

本次提交包含：引擎、转场、渲染/截图工具、场景 01–05 与 20 的实现、其余场景占位 stub、本文档。`out/` 下的截图和帧不入库。
