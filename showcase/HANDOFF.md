# 20 种视效演示 · 交接文档（v2）

分支：`claude/clever-allen-27vz0a`　目录：`showcase/`

## 状态

- v2 全部 20 个场景已重做，20 个转场都是按前后两个特效专门设计的 bridge（`src/bridges.js`），一镜到底，回环（20→01）连续。
- 规格：1920×1080，60fps（可任意），每段 6s，转场 1.5s 居中于边界，全片 120s = 7200 帧，`PHASE = 0`（视频第 0 帧在 20|01 边界上）。
- 云端只能用 SwiftShader 做 540p/30fps 草稿；最终成片由用户本地 GPU 渲染（`RENDER-LOCAL.md`）。
- 创意文档：`docs/v2-animation-script.md`、`docs/v2-transition-script.md`。实际实现与文档有出入的地方以代码为准（见下表）。

## 场景实现（与脚本的差异）

| # | 文件 | 实现要点 |
|---|---|---|
| 01 | `01-liquid.js` | 渐变哑光 SDF：球→穿孔云朵十字→开口螺旋环→三球颈部拉伸→人形（双手合十）；首帧与 20 末帧同一个球 |
| 02 | `02-ascii.js` | 舞者素材 + rembg 人物遮罩：人物暖白高密度字符、路面暗青；高潮字符涟漪；结尾格点结晶 |
| 03 | `03-holo.js` | 12 张衍射光栅镭射卡（4 种纹样），主卡翻转，飞拼成 6×2 墙，接缝愈合，沿包豪斯格子切开 |
| 04 | `04-bauhaus.js` + `lib/bauhaus-geo.js` | 6×3 格，每格一个独立运转的小机关（风车、人字纹、同心圆、四角扇形、滑动半圆等），按拍错落，高潮全体同动 |
| 05 | `05-neon.js` | 同一组包豪斯填充的颜色边缘 = 霓虹灯管；逐格点亮、拉远雨夜街景、变色闪、逐根熄灭，最后一根变成马轮廓 |
| 06 | `06-dither.js` | 白马素材：Bayer（实时）+ Floyd–Steinberg / Atkinson（离线真实误差扩散）三带对比、像素放大、双色调定格、点鼓成球 |
| 07 | `07-clay.js` | 12fps 定格捏黏土：彩色弹丸合团→拇指坑→盘条陶罐→三朵花弹性开放，转台 |
| 08 | `08-halftone.js` | 07 的花被印成 CMYK 网点；网角旋转出摩尔纹、网点形状变化（圆→线→十字）、四色分层拉开再合拢、推进到一个黑点 |
| 09 | `09-kinetic.js` | 瑞士网格：黑点变成 FORM 的 O，FOLLOWS 圆柱旋转，MOTION 翻牌，字重呼吸 + 色块反相扫过 |
| 10 | `10-pixel.js` | 《神奈川冲浪里》像素重制（320×180），巨浪卷起、浪唇压下、浪花碎成像素再变成鸟群 |
| 11 | `11-particles.js` | 7 万只椋鸟黄昏群飞（折叠、拉带、密度波）→ 天色转夜 → 鸟变星汇成旋涡星系 |
| 12 | `12-riso.js` | 五专色孔版海报（粉太阳 + 对称山），斜带剪切 → 竖向镜像脊柱 → 满屏斜纹 → 归位 |
| 13 | `13-glitch.js` | 超跑素材三联竖屏 + 按拍插入设计帧（扫描线被车剪影顶起、像素剪影、发光轮廓、数据 HUD、RGB 撕裂） |
| 14 | `14-topo.js` | 3D 地形低飞：橙色台地白线、暗谷蓝线、高潮呼吸 + 光脉冲、拉高俯视 |
| 15 | `15-glass.js` | 五种玻璃：长虹棱纹、方格、粗磨砂、水波纹、经典磨砂 UI 卡片；结尾变纸 |
| 16 | `16-paper.js` | 8 层剪纸立体书：真实层间投影、纸纤维、白芯切边、横移视差、太阳升起、纸鸟群 |
| 17 | `17-vapor.js` | 蒸汽波神殿：雾中柱廊、粉色大理石镜面地面、铬球反射、复古系统窗口、高潮日落 + 水波 |
| 18 | `18-flow.js` | 《星月夜》笔触流场：~2.6 万笔触沿涡场滑动，高潮汇成巨大漩涡 |
| 19 | `19-metaballs.js` | 3D 熔岩灯：半透明蜡块上浮相接分裂、玻璃瓶折射、光柱；融合→链状→长出递归小球 |
| 20 | `20-fractal.js` | Mandelbulb 幂次 2→8→2，俯冲，最后抚平成 01 开场的渐变球 |

## 素材（不入库）

- 原始素材：`assets/footage/horse.mp4`、`dancer.mp4`、`car.mp4`（用户提供的压缩包里的三段视频，改名放入）。
- 派生帧：`node tools/build-assets.js`（几秒）→ `assets/build/`；舞者遮罩：`python3 tools/build-masks.py`（需 `pip install "rembg[cpu]"`，CPU 约 3 分钟）。
- 两者都在 `.gitignore` 中。

## 引擎要点（`src/core.js`）

- `Engine.bridge(type, {glsl | render})`：每个边界一个独立程序；`render` 可整窗接管（同一物体贯穿边界）。
- 场景 `render(s, tg)` 可为 async（素材纹理按需加载，LRU 缓存，`src/lib/footage.js`）。
- `shaderScene({scaled:true})`：内部分辨率跟随 `?scale`，草稿更快；着色器需用设计空间单位。
- `?mb=N` 运动模糊，`?play` 实时播放，`readFrame()` 供 GPU 渲染管线读像素。
- 字体打包在 `assets/fonts/`（`tools/build-fonts.py` 生成 CJK 子集）。

## 工具

- `tools/render-gpu.js`：本地 GPU 渲染（readPixels → ffmpeg/NVENC），`--scene k`、`--from/--to`、`--mb`。
- `tools/play.js`：实时预览。
- `tools/shot.js`：单帧/单场景截图（`scene:k:s`、`frame:f`）。
- `tools/sheet.py`：触点图。

## 待办

- `src/timeline.js` / `docs/storyboard.md` 仍是 v1 文案（时间常量已改为 v2），需要按 v2 场景重写节拍和音效说明后重新生成。
- `src/transitions.js` 是 v1 遗留，现已全部被 bridges 覆盖，可删除。
- 在用户本地 GPU 上实测各场景耗时；光线步进场景（01/03/07/14/17/19/20）可按需提高步数和超采样。
- 合并前：全片 1080p 接缝 / 跳变检测（`tools/check-loop.js` 需按 v2 常量更新）。
