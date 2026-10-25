// 12 个程序化合成音效。build(ctx, out, t0, rnd)：只往 out 接节点，不创建 AudioContext，
// 这样实时播放和离线渲染共用同一份代码。
import { env, osc, noise, filter, gain } from './core.js';

const exp = (p, a, b, t0, t1) => {
  p.setValueAtTime(a, t0);
  p.exponentialRampToValueAtTime(b, t1);
};

// 噪声 + 带通扫频，woosh 类共用
function sweep(ctx, out, t0, dur, q, [f0, f1, f2], attack, peak, pan = 0) {
  const bp = filter(ctx, 'bandpass', f0, q);
  const g = gain(ctx, 0);
  const p = ctx.createStereoPanner();
  bp.connect(g).connect(p).connect(out);
  exp(bp.frequency, f0, f1, t0, t0 + attack);
  exp(bp.frequency, f1, f2, t0 + attack, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (pan) { p.pan.setValueAtTime(-pan, t0); p.pan.linearRampToValueAtTime(pan, t0 + dur); }
  noise(ctx, t0, t0 + dur, bp);
}

const click = (ctx, out, t, len, hp, peak) => {
  const g = gain(ctx, 0, out);
  env(g.gain, t, { peak, a: 0.0005, d: len, dur: len, r: 0.002 });
  noise(ctx, t, t + len + 0.01, filter(ctx, 'highpass', hp, 0.707, g));
};

export const SOUNDS = {
  '8 Bit Talking': { duration: 1.3, build(ctx, out, t0, rnd) {
    const lp = filter(ctx, 'lowpass', 4000, 0.707, out);
    const o = osc(ctx, 'square', 400, t0, t0 + 1.2, lp);
    const g = gain(ctx, 0, lp); o.disconnect(); o.connect(g);
    for (let t = 0; t < 1.2; t += 0.04 + rnd() * 0.03) {
      o.frequency.setValueAtTime(200 + rnd() * 600, t0 + t);
      g.gain.setValueAtTime(rnd() < 0.2 ? 0 : 0.25, t0 + t);
    }
    g.gain.setValueAtTime(0, t0 + 1.2);
  } },
  'Old Flash': { duration: 1.3, build(ctx, out, t0) {
    const g = gain(ctx, 0.12, out);
    const o = osc(ctx, 'sine', 2000, t0, t0 + 0.8, g);
    exp(o.frequency, 2000, 8000, t0, t0 + 0.8);
    g.gain.setValueAtTime(0, t0 + 0.8);
    const b = gain(ctx, 0, out);
    env(b.gain, t0 + 0.8, { peak: 0.7, a: 0.002, d: 0.3, dur: 0.03, r: 0.3 });
    noise(ctx, t0 + 0.8, t0 + 1.3, filter(ctx, 'highpass', 1000, 0.707, b));
  } },
  'Cinematic Woosh': { duration: 2.0, build(ctx, out, t0) {
    sweep(ctx, out, t0, 1.8, 2, [200, 3000, 400], 0.6, 0.7, 1);
    const g = gain(ctx, 0, out);
    env(g.gain, t0, { peak: 0.5, a: 0.5, d: 1.2, dur: 1.5, r: 0.3 });
    const o = osc(ctx, 'sine', 60, t0, t0 + 1.9, g);
    exp(o.frequency, 60, 40, t0, t0 + 1.8);
  } },
  'Night Vision': { duration: 1.8, build(ctx, out, t0) {
    click(ctx, out, t0, 0.005, 800, 0.6);
    const g = gain(ctx, 0.08, out);
    const o = osc(ctx, 'sine', 1000, t0, t0 + 1.0, g);
    exp(o.frequency, 1000, 12000, t0, t0 + 1.0);
    g.gain.setValueAtTime(0, t0 + 1.0);
    const h = gain(ctx, 0, out);
    env(h.gain, t0, { peak: 0.15, a: 0.3, d: 1.2, s: 0.5, dur: 1.4, r: 0.35 });
    noise(ctx, t0, t0 + 1.8, filter(ctx, 'highpass', 3000, 0.707, h));
  } },
  Nextel: { duration: 0.35, build(ctx, out, t0) {
    const lp = filter(ctx, 'lowpass', 5000, 0.707, out);
    [1900, 2400].forEach((f, i) => {
      const g = gain(ctx, 0, lp), t = t0 + i * 0.14;
      env(g.gain, t, { peak: 0.3, a: 0.003, d: 0.05, s: 0.9, dur: 0.06, r: 0.01 });
      osc(ctx, 'square', f, t, t + 0.08, g);
    });
  } },
  'Digital Text': { duration: 0.9, build(ctx, out, t0, rnd) {
    for (let t = 0; t < 0.8; t += 0.03 + rnd() * 0.02) {
      const g = gain(ctx, 0, out), d = 0.015 + rnd() * 0.01;
      env(g.gain, t0 + t, { peak: 0.2, a: 0.001, d, dur: d, r: 0.002 });
      osc(ctx, 'square', 1500 + rnd() * 1500, t0 + t, t0 + t + d + 0.01, g);
    }
  } },
  Riser: { duration: 3.1, build(ctx, out, t0) {
    const lp = filter(ctx, 'lowpass', 300, 0.707);
    const g = gain(ctx, 0, out);
    lp.connect(g);
    exp(lp.frequency, 300, 8000, t0, t0 + 3);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.2, t0 + 3);
    g.gain.setValueAtTime(0, t0 + 3.001);
    [-10, 0, 10].forEach((c) => {
      const o = osc(ctx, 'sawtooth', 100, t0, t0 + 3.01, lp);
      o.detune.value = c;
      exp(o.frequency, 100, 800, t0, t0 + 3);
    });
    const hp = filter(ctx, 'highpass', 500, 0.707, g);
    exp(hp.frequency, 500, 6000, t0, t0 + 3);
    noise(ctx, t0, t0 + 3.01, hp);
  } },
  Counter: { duration: 1.6, build(ctx, out, t0) {
    let t = 0, gap = 0.06;
    while (t < 1.0) {
      const g = gain(ctx, 0, out);
      env(g.gain, t0 + t, { peak: 0.3, a: 0.001, d: 0.01, dur: 0.01, r: 0.002 });
      osc(ctx, 'triangle', 1000 + (t / 1.0) * 1000, t0 + t, t0 + t + 0.02, g);
      t += gap; gap = Math.max(0.03, gap - 0.003);
    }
    const g = gain(ctx, 0, out);
    env(g.gain, t0 + t, { peak: 0.45, a: 0.002, d: 0.5, dur: 0.01, r: 0.1 });
    osc(ctx, 'sine', 2000, t0 + t, t0 + t + 0.7, g);
  } },
  'Bicycle Chain': { duration: 1.6, build(ctx, out, t0, rnd) {
    for (let t = 0; t < 1.5; ) {
      const g = gain(ctx, 0, out), r = 30 - 22 * (t / 1.5);
      env(g.gain, t0 + t, { peak: 0.5 * (0.7 + rnd() * 0.6), a: 0.0005, d: 0.004, dur: 0.004, r: 0.002 });
      noise(ctx, t0 + t, t0 + t + 0.02, filter(ctx, 'bandpass', 3000 + rnd() * 2000, 5, g));
      t += 1 / r;
    }
  } },
  'Camera Click': { duration: 0.3, build(ctx, out, t0) {
    [[0, 1], [0.08, 0.6]].forEach(([dt, k]) => {
      click(ctx, out, t0 + dt, 0.01, 2000, 0.6 * k);
      const g = gain(ctx, 0, out);
      env(g.gain, t0 + dt, { peak: 0.5 * k, a: 0.001, d: 0.02, dur: 0.02, r: 0.005 });
      osc(ctx, 'sine', 150, t0 + dt, t0 + dt + 0.03, g);
    });
  } },
  Shine: { duration: 1.4, build(ctx, out, t0, rnd) {
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const g = gain(ctx, 0, out), d = 0.4 + rnd() * 0.4, t = t0 + i * 0.05;
      env(g.gain, t, { peak: 0.22, a: 0.002, d, dur: 0.01, r: 0.01 });
      osc(ctx, i % 2 ? 'triangle' : 'sine', 2000 + (i * 4000) / n, t, t + d + 0.05, g);
    }
    const g = gain(ctx, 0, out);
    env(g.gain, t0, { peak: 0.1, a: 0.002, d: 0.3, dur: 0.01, r: 0.01 });
    noise(ctx, t0, t0 + 0.4, filter(ctx, 'highpass', 6000, 0.707, g));
  } },
  Woosh: { duration: 0.7, build(ctx, out, t0) {
    sweep(ctx, out, t0, 0.5, 2, [500, 2000, 600], 0.15, 0.6);
  } },
};
