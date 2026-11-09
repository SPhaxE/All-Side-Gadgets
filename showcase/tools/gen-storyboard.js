// Generates docs/storyboard.md (Chinese storyboard + sound-design brief) from src/timeline.js so time codes can never drift from the video.
const fs = require('fs'); const path = require('path');
const { TIMELINE } = require('../src/timeline.js');
const D = 6.0, HT = 0.75, PHASE = 0.0, T = TIMELINE.length * D;
const wrap = t => ((t % T) + T) % T;
const tc = t => { t = wrap(t); const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`; };
const vt = (k, s) => (k - 1) * D + s - PHASE;
const range = k => { const a = vt(k, 0), b = vt(k, D); return a < 0 ? `00:00.0 – ${tc(b)}（s=0 在片尾 ${tc(a)}，即视频最后 ${PHASE}s 属于本段开头）` : `${tc(a)} – ${tc(b)}`; };          // video time of scene k's local time s
let md = `# 20 种视效演示 · 分镜与音效脚本\n\n> 由 \`tools/gen-storyboard.js\` 根据 \`src/timeline.js\` 生成，时间码与视频一一对应（1080p / 30fps / ${T}s / ${T * 30} 帧）。音效阶段尚未制作，本文件是下一阶段的制作依据。\n\n`;
md += `## 全局约定\n\n- **节拍网格**：106.67 BPM、4/4。每个特效 = 8 拍 = ${D}s；全片 160 拍 = 40 小节 = ${T}s，每个转场居中于特效边界（前后各 ${HT}s，共 ${HT * 2}s），所以“下一个特效的第 1 拍”落在转场中点。\n- **小节线相对视频起点偏移 -0.5s**：小节线落在特效边界上，即视频 4.0s、8.5s … 以及 89.5s（= -0.5s）；视频第 0 帧在一条小节线之后 0.5s（约 0.89 拍）。做音频时请从“视频 -0.5s”（第 1 小节起点）起算，交付循环时把音频开头 0.5s 对齐到视频第 0 帧，90.0s 处整体循环。\n`;
md += `- **无缝循环**：视频第 0 帧是场景 1 的 s=${PHASE}s，此时 20→1 转场（居中于 89.5s、前后各 ${HT}s，到 90.1s 结束）还剩最后约 0.1s（3 帧）；最后一帧后直接接回第 0 帧。音频也必须在 ${T}s 处循环：混响尾巴要做交叉淡化（建议 1 小节），结尾的上行扫频落回开场音色。\n`;
md += `- **转场音效**：每个转场都是对应前后特效的专属设计，音效也应沿用前后两段的声音素材（见每段“转场”一栏），不要用通用 whoosh 一把梭。\n`;
md += `- **画面里不显示音频元素**，HUD（左下编号/名称、右下拨盘）仅作视觉识别，不需要配声。\n\n`;
md += `## 总览\n\n| # | 特效 | 视频区间 | 本段转出（居中于） |\n|---|---|---|---|\n`;
TIMELINE.forEach((e, i) => { const k = i + 1; md += `| ${String(k).padStart(2, '0')} | ${e.name}（${e.zh}） | ${range(k).split('（')[0]} | ${tc(vt(k, D))} → ${TIMELINE[(i + 1) % 20].name} |\n`; });
md += `\n`;
TIMELINE.forEach((e, i) => {
  const k = i + 1, nx = TIMELINE[(i + 1) % 20];
  md += `## ${String(k).padStart(2, '0')} ${e.name}（${e.zh}）\n\n- **时间码**：${range(k)}；画面从 s=-${HT}s 起就已经在转场里出现\n- **画面**：${e.look}\n\n`;
  md += `| 时间码 | 局部 s | 画面节点 |\n|---|---|---|\n`;
  e.beats.slice().sort((a, b) => a[0] - b[0]).forEach(([s, t]) => { md += `| ${tc(vt(k, s))} | ${s >= 0 ? '+' : ''}${s.toFixed(2)} | ${t} |\n`; });
  md += `\n- **音效**：\n${e.sfx.map(x => `  - ${x}`).join('\n')}\n- **配乐**：${e.music}\n`;
  md += `- **转场 → ${nx.name}**（${tc(vt(k, D - HT))} – ${tc(vt(k, D + HT))}）：${e.transition.zh}\n  - 转场音效：${e.transition.sfx}\n\n`;
});
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'storyboard.md'), md);
console.log('docs/storyboard.md', md.length, 'chars');
