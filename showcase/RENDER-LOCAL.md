# 本地 GPU 渲染指南（RTX 3060 / 16GB RAM，1080p60）

引擎是网页 + WebGL。在云端只能用 CPU 软件渲染（SwiftShader）加逐帧截图，所以很慢（1080p30 约 47 分钟）。本地方案是：

1. Chrome 用**你的显卡**渲染每一帧。
2. `readPixels` 直接读出原始像素，经本机 HTTP 交给 ffmpeg。
3. ffmpeg 用 **NVENC 显卡编码**，直接出 mp4。

整个过程不写中间图片，也不截图。

## 1. 准备（一次性）

| 软件 | 版本 | 说明 |
|---|---|---|
| NVIDIA 驱动 | 近一年内的版本 | 3060 支持 NVENC |
| Node.js | 20 LTS 或更新 | https://nodejs.org |
| ffmpeg | 带 `h264_nvenc` 的版本 | Windows 推荐 gyan.dev 的 “full” 版，把 `bin` 加入 PATH；Linux 发行版自带的通常也有 |
| Git | 任意 | 拉代码 |

检查 ffmpeg 是否支持显卡编码：

```bash
ffmpeg -hide_banner -encoders | grep nvenc        # Windows PowerShell: ffmpeg -hide_banner -encoders | findstr nvenc
```

没有 nvenc 也能用，会自动改用 CPU 编码（libx264），只是编码慢一些。

拉代码、装依赖：

```bash
git clone https://github.com/SPhaxE/All-Side-Gadgets.git
cd All-Side-Gadgets
git checkout claude/clever-allen-27vz0a
cd showcase
npm install
npx playwright install chromium        # 或者直接用你装好的 Google Chrome：后面的命令加 --chrome
```

## 2. 确认 Chrome 用的是显卡

```bash
npm run check
```

正常应输出类似 `renderer: ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 ... Direct3D11 ...)`。

如果出现 `SwiftShader` 或 `SOFTWARE rendering`，按顺序尝试：

1. 加 `--chrome`，用系统里装的 Google Chrome（显卡支持最好）。
2. Windows 加 `--gl d3d11`；Linux 加 `--gl vulkan` 或 `--gl gl`；macOS 加 `--gl metal`。
3. 不要加 `--headless`。默认会弹出一个浏览器窗口来渲染，这样最稳定。渲染时不要最小化这个窗口。

```bash
node tools/render-gpu.js --check --chrome --gl d3d11
```

## 3. 实时预览（边改边看）

```bash
npm run play                     # 60fps 实时播放，可加 --chrome / --gl d3d11
```

| 按键 | 作用 |
|---|---|
| 空格 | 暂停 / 继续 |
| ← / → | 上一个 / 下一个特效 |
| , / . | 逐帧后退 / 前进 |
| F | 全屏 |

左下角显示时间码、帧号、当前特效和实际帧率。实时播放跟不上 60fps 不影响最终渲染：渲染是逐帧离线进行的，每一帧都完整。

## 4. 渲染

```bash
npm run render                                   # 全片 1080p60 -> out/reel_1080p60.mp4
node tools/render-gpu.js --scene 5               # 只渲第 5 个特效（含前后转场）-> out/scene05_1080p60.mp4
node tools/render-gpu.js --mb 4                  # 4 子帧运动模糊（电影感更强，渲染时间约 ×4）
node tools/render-gpu.js --cq 14                 # 画质更高（数值越小越好，默认 17）
node tools/render-gpu.js --codec hevc            # H.265，同画质体积更小
node tools/render-gpu.js --out out/frames/%05d.png   # 输出 PNG 序列（后期软件用）
node tools/render-gpu.js --from 600 --to 900     # 只渲第 600–899 帧
```

全部参数：

| 参数 | 默认 | 说明 |
|---|---|---|
| `--fps` | 60 | 输出帧率；动画按秒计算，任何帧率都正确 |
| `--scale` | 1 | 1 = 1920×1080；0.5 = 960×540 快速草稿 |
| `--mb` / `--shutter` | 1 / 0.5 | 运动模糊子帧数 / 快门开启比例 |
| `--encoder` | auto | auto（优先 NVENC）/ nvenc / x264 |
| `--codec` | h264 | h264 / hevc |
| `--cq` | 17 | 质量 |
| `--gl` | auto | auto / d3d11 / vulkan / gl / metal / swiftshader |
| `--chrome` | 关 | 使用系统 Google Chrome |
| `--headless` | 关 | 无窗口渲染（部分系统无窗口时拿不到显卡） |
| `--scene k` | — | 只渲第 k 个特效（含前后转场） |

## 5. 预计耗时（RTX 3060，1080p60）

- 全片（v1 是 90s = 5400 帧；v2 是 120s = 7200 帧）：多数特效在显卡上能达到实时，最重的几段（分形、黏土、地形这类光线步进）大约每秒 10–30 帧。**全片约 5–15 分钟**。
- 开 `--mb 4` 约是 4 倍时间。
- 显存占用一般在 1GB 以内，16GB 内存足够。

## 6. 常见问题

- **渲染出来全黑或报 WebGL 错误**：先跑 `npm run check`，确认用的是显卡；再加 `--chrome`。
- **提示 `h264_nvenc` 不可用**：ffmpeg 版本不带 NVENC，或显卡驱动太旧；会自动回退到 CPU 编码。
- **字体不对**：字体已经打包在 `assets/fonts/`，不依赖系统字体。中日文字体是按代码里出现的字做的子集；新增中日文文字后需要重新生成子集（`tools/build-fonts.py` 读取的是 Linux 系统字体路径，这一步由我在仓库里完成即可）。
- **想确认首尾无缝**：用 `ffmpeg -stream_loop 2 -i out/reel_1080p60.mp4 -c copy out/loop_test.mp4` 拼三遍播放。
