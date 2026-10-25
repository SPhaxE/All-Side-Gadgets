# 音效复刻台 (audio-lab)

两段参考视频(`references/videos/`)里的声音,用纯 JS 合成(无采样)。测试网页是单文件,发布用 `dist/index.html`。

## 现状(阶段性完结)
- 视频1:12 个音效 —— 8 Bit Talking、Old Flash、Cinematic Woosh、Night Vision、Nextel、Digital Text、Riser、Counter、Bicycle Chain、Camera Click、Shine、Woosh。
- 视频2:10 条 B 小调循环(90 BPM)—— 01 Question、02 Into The Fog、03 Quiet Suspicion、04 Lost In Thought、07 In Between、09 Keep Moving、11 Reckoning、12 Second Guess、17 Forward Motion、22 Pizzicato Clock。
- 另有 12 个补充编号(05 06 08 10 13 14 15 16 18 19 20 21),视频里没有,名称和内容是自拟的。
- 页面只使用**优化版**(`renderOpt`):音高吸附 B 小调、循环锁十六分音符且首尾无缝、音效加短房间感、去掉 28 Hz 以下低频。
- 还保留了**复刻版**(`render`,按原视频波形外轮廓做分段增益匹配,边缘贴合度 92–100%),只给工具用,页面不再显示。复刻版会带着原音频的压缩瑕疵,所以不作为成品。

## 目录
- `src/dsp.js` 滤波、加性合成、混响、母带;`OPT` 开关和 `T()` 音高吸附;边缘贴合度 `edgeScore` 与 `followEdge`
- `src/sfx.js` 12 个音效;`src/loops.js` 10 条循环;`src/loops_extra.js` 12 条补充
- `src/ref-env.js` 参考片段的波形外轮廓(由 `tools/gen_ref_env.py` 生成)
- `src/page.html` + `src/ui.js` 页面;`build.mjs` 拼成 `dist/index.html`(发布)、`dist/preview.html`(本地预览)、`dist/engine.js`(Node 用)

## 常用命令
```
node audio-lab/build.mjs                                  # 构建
node tools/render_sfx.js OUT_DIR sfx opt                  # 渲染优化版音效为 wav(loops 同理;去掉 opt 为复刻版)
python3 tools/check_audio.py OUT_SFX OUT_LOOPS            # 削波/直流/首尾爆音/接缝/低频噪声检查
node tools/envscore.js                                    # 复刻版的边缘贴合度
node tools/tune_loops.js / tune_sfx.js                    # 重新拟合复刻版的时间偏移
python3 tools/analyze_ref.py / compare.py                 # 参考音频的频谱与对比图
```

## 后续可做
- 逐个听感调整(哪个声音不对按名字调)。
- 补充的 12 条是否保留、是否改名。
- 视频2 的 07 / 09 / 11 / 17 原音频较密,优化版是近似而不是转写。
