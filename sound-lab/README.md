# Sound Lab（Web Audio 音效库）

12 个音效 + 若干背景循环，全部在浏览器里用 Web Audio 实时生成，音色来自真实乐器采样（WebAudioFont 数据集里的 FluidR3 GM，MIT 许可，见 `sfx/vendor/LICENSES.txt`）。播放器是自写的采样器，不依赖 GPL 代码。

## 目录

- `index.html`：试听页（需要通过本地服务器打开，模块从 `sfx/` 加载）
- `sfx/index.js`：入口，导出 `createSfx`、`render`、`SFX_NAMES`、`TRACKS`
- `sfx/sounds.js` 音效，`sfx/loops.js` 循环，`sfx/sampler.js` 采样器，`sfx/instruments.js` 乐器加载，`sfx/core.js` 公共工具（滤波、增益、WAV 编码）
- `sfx/vendor/instruments/`：乐器采样数据
- `scripts/build-page.py`：把模块和采样内联成单个 HTML，用于发布（约 6 MB）
- `scripts/verify.cjs`：在无头 Chromium 里用 OfflineAudioContext 离线渲染全部音效和循环并检查（削波、直流偏移、首尾、可复现性）

## 常用命令

在 `sound-lab/` 目录里运行：

```bash
python3 scripts/build-page.py out/sound-lab.html
```

```bash
node scripts/verify.cjs
```

`verify.cjs` 需要 Playwright（找不到时按原注释设置 `NODE_PATH` 指向装有 playwright 的 `node_modules`）。
