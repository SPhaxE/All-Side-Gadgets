# Visual FX Reel · 本地渲染包

20 种视效无缝循环片（1920×1080，60fps，120 秒）。素材帧和舞者遮罩已经预先生成好，解压即可渲染。

## 一次性准备

1. 安装 **Node.js**（LTS 版）：https://nodejs.org
2. 安装 **ffmpeg** 并加入 PATH（Windows 推荐 https://www.gyan.dev/ffmpeg/builds/ 的 full 版，自带 NVIDIA 显卡编码）
3. 显卡驱动保持较新

## 渲染

- **Windows**：双击 `render-windows.bat`
- **Linux / macOS**：`./render.sh`

第一次运行会自动安装依赖（约 150MB 的 Chromium），并检查是否用上了显卡。渲染时会弹出一个浏览器窗口，**不要最小化它**。
成片在 `out/reel_1080p60.mp4`。

## 常用参数（加在脚本后面，或直接用 node 命令）

```
render-windows.bat --scene 5        只渲第 5 个特效（含前后转场），快速看效果
render-windows.bat --mb 4           4 子帧运动模糊，更有电影感（时间约 ×4）
render-windows.bat --cq 14          更高画质（数值越小越好，默认 17）
render-windows.bat --codec hevc     H.265，同画质文件更小
render-windows.bat --fps 30         30fps
npm run play                         实时预览（空格暂停，←/→ 切特效）
```

更多说明、常见问题见 `RENDER-LOCAL.md`。
