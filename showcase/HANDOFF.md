# 20 种视效演示视频 · 交接文档

状态：**20 个场景和 20 个专属转场都已实现并逐个目检；01–20 的 540p 预览陆续发给用户中。还没渲 1080p 终版，也还没做循环/确定性验证。**
分支：`claude/clever-allen-27vz0a`　目录：`showcase/`

## 1. 目标与硬性要求（来自用户）

- 一个视觉效果拉满的动态演示视频，依次展示 20 种视效：
  1 Liquid morph · 2 ASCII art · 3 Holographic foil · 4 Bauhaus shapes · 5 Neon glow · 6 Dithering · 7 Clay 3D · 8 Halftone dots · 9 Kinetic typography · 10 Pixel art · 11 Particle swarm · 12 Risograph print · 13 Glitch effect · 14 Topographic lines · 15 Glassmorphism · 16 Paper cutout · 17 Vaporwave grid · 18 Flow fields · 19 Metaballs · 20 Ray-marched fractals
- **首尾无缝衔接**，循环播放察觉不出（无淡黑、无片头片尾卡）。
- **先不做音效**，但脚本里注明音效搭配，供下阶段制作 → 已写在 `docs/storyboard.md`（由 `src/timeline.js` 生成）。
- **（后来追加）两个特效之间的切换要丝滑，不能黑切或生硬转场；转场必须对应前后两个特效，不能用全局通用转场。** 已按此重做，见 §3。
- **（后来追加）每完成一项的渲染，出一个 540p 预览给用户看** → `tools/preview.js`，见 §5。
- 项目规则：长命令一律 `run_in_background`；同一问题修 2 次仍失败要先咨询 advisor/architect；合并/上线前让 `architect` 终审。

## 2. 架构

- 一个 HTML 页面（`index.html`）+ 单个 WebGL2 上下文；无 GPU，用 Chromium 的 SwiftShader。Playwright 逐帧调 `window.renderFrame(f)` 截图 → ffmpeg 编码。
- **全部场景无状态**：画面是 `(局部时间 s, 全局时间 tg)` 的纯函数；禁止 `Math.random/Date.now/performance.now`，无帧反馈。因此可多进程分块渲染，并保证循环。
- **时间轴**（`src/core.js`）：30fps；每段 `D=4.5s`；转场 `2×HT = 1.2s`（居中于边界）；`T=90s`，`N=2700` 帧；`PHASE=0.5`（视频第 0 帧 = 场景 1 的 s=0.5）。`renderFrame(f)` 内部取 `f mod N`。场景在 `s∈[-0.6, 5.1]` 都必须有定义。
- **场景接口**：`Engine.register(编号, 场景)`；工厂 `shaderScene / canvasScene / postScene / customScene`（见 `core.js`）。shader 序言有 `hash/noise/fbm/pal/rot/hsv2rgb/ease` 等，uniform 有 `uRes uS uT uTau`。
- **HUD**：左下编号+名称（竖向滑动）、右下 20 刻度环形拨盘（环形所以 20→1 无跳变）、左上标签、右上转圈。`hudDark:true` = 浅色底场景用深色字。
- 合成层末尾加 ±1/255 确定性噪声（种子 = 帧号）防色带。
- 字体：系统自带 Inter / Inter Display / JetBrains Mono / WenQuanYi Zen Hei / IPA Gothic；页面在 `__ready` 前 `document.fonts.load`。

## 3. 转场（`src/transitions.js`）

每个边界一个专属函数 `t0…t19`（`type` = 出场场景序号，0 起），用前后两个特效各自的视觉语言做成，**没有任何全局/参数化的通用转场**。均已目检。

| 边界 | 做法 |
|---|---|
| 1→2 | 液态被逐格“读”成字符（波浪式滚过轮廓），再接入 ASCII 场景 |
| 2→3 | 字符被染成全息彩虹，一道全息扫光把卡片带入 |
| 3→4 | 箔面按色相量化成包豪斯三原色，瓦片按对角线波翻转 |
| 4→5 | 图形只保留轮廓并亮成霓虹灯管，填充沉下去，霓虹字点亮 |
| 5→6 | 霓虹光被 Bayer 有序抖动压成两色，再按同一阈值换成抖动场景 |
| 6→7 | 抖动颗粒被压平变暖，黏土团从桌面鼓起，带受光边与接触阴影 |
| 7→8 | 黏土画面被印成 CMYK 半调，网点大小随两图色调变化 |
| 8→9 | 45° 网点膨胀，每个点里露出动态字体，直到合并 |
| 9→10 | 字体逐步像素化并限色，再与像素场景按 Bayer 顺序逐像素交换 |
| 10→11 | 像素块被噪声风吹散，露出粒子云 |
| 11→12 | 粒子球被印成荧光粉颗粒，辊子送入纸张，海报图层接管 |
| 12→13 | 套印错位扩大成 RGB 分离与撕裂块，换成故障场景 |
| 13→14 | 故障画面亮度被重读成高程，逐行转成等高线 |
| 14→15 | 地图磨成毛玻璃，带斜面高光的玻璃面板从中心膨胀、霜雾散去 |
| 15→16 | 彩色纸片（纸芯 + 投影）层层滑过，最后一张是剪纸场景本身 |
| 16→17 | 纸被剪成条，逐条落下带投影，露出日落网格 |
| 17→18 | 网格被沿噪声流场拖成长流线 |
| 18→19 | 流线被拉向膨胀的融球核，球内是融球场景 |
| 19→20 | 同心色带变 Droste 无限放大隧道，解析为分形 |
| 20→1（回环接缝） | 分形像液体晃动并染铬色，铬面液滴从亮脊长出 |

## 4. 目录

```
showcase/
  index.html            加载 core、transitions、20 个场景
  src/core.js           引擎、时间轴、HUD、合成
  src/transitions.js    20 个专属转场 GLSL
  src/timeline.js       分镜 + 音效 + 配乐的唯一数据源
  src/scenes/NN-name.js 20 个场景
  tools/render.js       分块并行渲染；默认清空输出目录，--resume 才续跑；--seq 按序号命名；--scale 0.5 出 540p
  tools/shot.js         单帧/单场景截图：node tools/shot.js <outdir> scene:5:2.0 frame:1234 [--scale 0.5] [--hud 0]
  tools/sheet.py        触点图：python3 tools/sheet.py out.png <列数> img1 img2 …
  tools/preview.js      某场景（含前后各半个转场）的 540p mp4：node tools/preview.js 12 13 → out/preview/NN-name.mp4
  tools/gen-storyboard.js  生成 docs/storyboard.md
  tools/check-loop.js   循环接缝 + 确定性验证（尚未运行）
  docs/storyboard.md    中文分镜 + 音效脚本（时间码由脚本生成）
  out/                  产物，已 gitignore
```

## 5. 当前进度

- 场景 01–20：全部写完并目检。预览 01–11 已发给用户；12–20 的预览在后台批量渲染（`out/preview_batch3.log`，逐个发送）。
- 已知小问题（不影响出片，可后续打磨）：
  - 04 的 HUD 深色字压在深色瓦片上可读性一般；02/03/09 的第一版参数没有再复看过完整动画。
  - 07 黏土单帧约 3–8s（SwiftShader，1280×720，带软阴影/AO），是全片最慢的场景；18 流场是 CPU/Canvas2D 重度，也偏慢。
  - 06 抖动的“风车”高光、01 小球中心的极轻风车，均可接受。

## 6. 下一步

1. 等 12–20 预览渲完并逐个发给用户。
2. 跑 `node tools/check-loop.js 0.5`（需空闲 CPU）：接缝 `diff(N-1→0)` 应 ≤ 普通相邻帧的 1.5 倍；冷启动与顺序渲染的同一帧必须逐字节一致。
3. **测渲染吞吐**：分开测“着色”和“截图”，再测 1/2/4 worker 总吞吐，估算 2700 帧 1080p 总耗时（07/18 最慢；必要时给 07 加缓存——它 15fps 定格，相邻帧重复）。
4. 全量 1080p 渲染（**后台**，`node tools/render.js --from 0 --to 2700 --out out/frames --workers 4`；可分块 `--from/--to` + `--resume`）。
5. 编码（见 §7）→ `ffprobe -count_frames` 应为 2700 → 用 `ffmpeg -stream_loop 1` 拼两遍，抽接缝前后帧目检。
6. 交 `architect` 终审（项目规则）→ 修阻断项 → `SendUserFile` 把 mp4 发给用户。

## 7. 编码参数（建议）

```
ffmpeg -framerate 30 -i out/frames/f%05d.jpg \
  -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -bf 0 -g 30 -keyint_min 30 -sc_threshold 0 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an out/video.mp4
```

- 必须显式 bt709，否则饱和色偏。
- mp4 若超过 100MB（GitHub 单文件上限）不要入库；出 720p / CRF 23 预览版，或先问用户。
- 帧目录 PNG/JPEG 体积大，渲完清理。

## 8. 已知坑

- GLSL 内建函数名不能做自定义函数名（`sign` 撞过）；**局部变量别和 `uA/uB` 等 uniform 同名**（会遮蔽采样器）。
- 所有场景和转场 shader 在 `initEngine()` 时一起编译，任一失败整个页面都不 ready（`window.__error` 有错误文本，`tools/shot.js` 会打印）。
- 局部时间可以为负（转场里），用 `%` 取下标要写成 `((x % n) + n) % n`（10 像素精灵踩过）。
- `pkill -f` 会匹配到自己的命令行把 shell 杀掉；清进程用 `ps … | grep … | awk | xargs kill`。
- 用 `file://` 打开页面，场景文件是普通 `<script>`，不要用 ES module。
- 预览/渲染读的是**启动时**的源文件：批量渲染途中不要改 `core.js / transitions.js / 场景文件`，否则前后帧不一致。
