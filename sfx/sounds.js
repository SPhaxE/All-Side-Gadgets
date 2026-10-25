// 12 个音效，全部由真实乐器采样演奏而成（GM 音色），乐器选择贴合各自的主题。
// build(ctx, out, t0, rnd)：只往 out 接节点，不创建 AudioContext，实时和离线共用。
import { filter, gain } from './core.js';
import { note } from './instruments.js';

const exp = (p, a, b, t0, t1) => {
  p.setValueAtTime(a, t0);
  p.exponentialRampToValueAtTime(b, t1);
};
const rise = (n, steps) => Array.from({ length: steps }, (_, i) => ({ when: ((i + 1) / steps) * n.when, delta: ((i + 1) / steps) * n.delta }));
const glide = (when, delta) => rise({ when, delta }, 8);

// 海浪采样 + 带通扫频，做出 woosh 的“风声”
function whoosh(ctx, out, t0, dur, q, [f0, f1, f2], attack, vol, pan = 0) {
  const bp = filter(ctx, 'bandpass', f0, q);
  const g = gain(ctx, 0);
  const p = ctx.createStereoPanner();
  bp.connect(g).connect(p).connect(out);
  exp(bp.frequency, f0, f1, t0, t0 + attack);
  exp(bp.frequency, f1, f2, t0 + attack, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (pan) { p.pan.setValueAtTime(-pan, t0); p.pan.linearRampToValueAtTime(pan, t0 + dur); }
  note(ctx, bp, 'sea', t0, 68, dur, 1);
}

export const SOUNDS = {
  // 方波主音（GM Lead 1）随机跳音，像 8 位游戏角色说话
  '8 Bit Talking': { duration: 1.5, build(ctx, out, t0, rnd) {
    for (let t = 0; t < 1.2; t += 0.055 + rnd() * 0.03) {
      if (rnd() < 0.18) continue;
      note(ctx, out, 'square', t0 + t, 55 + Math.floor(rnd() * 24), 0.05, 0.5);
    }
  } },
  // 老式闪光灯：充电啸叫（扫频 pad）上滑，接 镲 + 边击 的“啪”
  'Old Flash': { duration: 1.8, build(ctx, out, t0) {
    note(ctx, out, 'sweep', t0, 72, 0.85, 0.35, glide(0.8, 22));
    note(ctx, out, 'glock', t0 + 0.1, 96, 0.7, 0.18, glide(0.7, 4));
    note(ctx, out, 'side', t0 + 0.85, 37, 0.1, 0.9);
    note(ctx, out, 'crash', t0 + 0.85, 49, 0.4, 0.6);
  } },
  // 电影感“嗖”：海浪扫频 + 定音鼓重击 + 镲尾
  'Cinematic Woosh': { duration: 2.6, build(ctx, out, t0) {
    whoosh(ctx, out, t0, 1.8, 1.5, [200, 3200, 400], 0.8, 0.9, 1);
    note(ctx, out, 'timpani', t0 + 0.8, 36, 1.2, 0.9);
    note(ctx, out, 'crash', t0 + 0.85, 49, 1.2, 0.4);
  } },
  // 夜视仪开机：电流声 + 扫频 pad 上升
  'Night Vision': { duration: 2.2, build(ctx, out, t0) {
    note(ctx, out, 'side', t0, 37, 0.1, 0.6);
    note(ctx, out, 'sweep', t0 + 0.02, 60, 1.4, 0.45, glide(1.0, 24));
    note(ctx, out, 'celesta', t0 + 1.05, 96, 0.8, 0.25);
  } },
  // 对讲机“滴滴”：两声方波短鸣，第二声更高
  Nextel: { duration: 0.5, build(ctx, out, t0) {
    note(ctx, out, 'square', t0, 76, 0.07, 0.55);
    note(ctx, out, 'square', t0 + 0.13, 81, 0.08, 0.55);
  } },
  // 屏幕打字：木琴高音快速敲击
  'Digital Text': { duration: 1.1, build(ctx, out, t0, rnd) {
    for (let t = 0; t < 0.8; t += 0.03 + rnd() * 0.025) note(ctx, out, 'xylo', t0 + t, 84 + Math.floor(rnd() * 14), 0.03, 0.45);
  } },
  // 升起：颤音弦乐滑音上行 + 渐快军鼓滚奏，结尾定音鼓 + 镲
  Riser: { duration: 4.2, build(ctx, out, t0) {
    const g = gain(ctx, 0.0001, out);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + 3);
    g.gain.setValueAtTime(1, t0 + 3.01);
    note(ctx, g, 'tremolo', t0, 48, 3.1, 0.7, glide(3, 24));
    note(ctx, g, 'tremolo', t0, 55, 3.1, 0.5, glide(3, 24));
    for (let t = 0, gap = 0.2; t < 3; t += gap, gap = Math.max(0.03, gap * 0.9)) note(ctx, g, 'snare', t0 + t, 38, 0.1, 0.35);
    note(ctx, out, 'timpani', t0 + 3.05, 40, 1.0, 0.9);
    note(ctx, out, 'crash', t0 + 3.05, 49, 1.0, 0.5);
  } },
  // 计数器：木鱼渐快滴答，结束一记钟琴“叮”
  Counter: { duration: 2.2, build(ctx, out, t0) {
    let t = 0, gap = 0.07;
    for (; t < 1.0; t += gap, gap = Math.max(0.035, gap - 0.003)) note(ctx, out, 'wood', t0 + t, 76, 0.05, 0.55);
    note(ctx, out, 'glock', t0 + t, 96, 1.2, 0.5);
  } },
  // 自行车链条：沙锤（cabasa）刮擦节奏，由快渐慢
  'Bicycle Chain': { duration: 1.9, build(ctx, out, t0, rnd) {
    for (let t = 0; t < 1.5; ) {
      note(ctx, out, 'cabasa', t0 + t, 69, 0.08, 0.35 + rnd() * 0.3);
      t += 1 / (30 - 22 * (t / 1.5));
    }
  } },
  // 相机快门：边击 + 踩镲两下，第二下轻一点
  'Camera Click': { duration: 0.5, build(ctx, out, t0) {
    note(ctx, out, 'side', t0, 37, 0.1, 0.9);
    note(ctx, out, 'hat', t0, 42, 0.05, 0.5);
    note(ctx, out, 'side', t0 + 0.08, 37, 0.1, 0.55);
    note(ctx, out, 'hat', t0 + 0.08, 42, 0.05, 0.3);
  } },
  // 闪亮：钟琴与钢片琴向上琶音，加三角铁闪光
  Shine: { duration: 2.4, build(ctx, out, t0, rnd) {
    const scale = [84, 88, 91, 93, 96, 100];
    scale.forEach((m, i) => note(ctx, out, i % 2 ? 'celesta' : 'glock', t0 + i * 0.055, m, 0.6 + rnd() * 0.3, 0.45));
    note(ctx, out, 'tri', t0, 81, 1.0, 0.5);
  } },
  // 短促“嗖”：海浪扫频
  Woosh: { duration: 0.8, build(ctx, out, t0) {
    whoosh(ctx, out, t0, 0.6, 1.5, [500, 2200, 700], 0.18, 0.9);
  } },
};
