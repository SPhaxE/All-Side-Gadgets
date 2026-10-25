// 22 条配乐循环：5 个曲风族群 + 曲目表。曲名 05/06/08/10/13-16/18-21 为占位。
import { env, osc, noise, filter, gain } from './core.js';

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function note(ctx, out, type, midi, t, dur, peak, lpFreq) {
  const g = gain(ctx, 0, out);
  env(g.gain, t, { peak, a: 0.004, d: dur, dur: 0.01, r: 0.02 });
  const lp = filter(ctx, 'lowpass', lpFreq, 0.707, g);
  osc(ctx, type, hz(midi), t, t + dur + 0.1, lp);
}
const kick = (ctx, out, t, peak = 0.5) => {
  const g = gain(ctx, 0, out);
  env(g.gain, t, { peak, a: 0.002, d: 0.18, dur: 0.01, r: 0.02 });
  const o = osc(ctx, 'sine', 60, t, t + 0.25, g);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
};
const tick = (ctx, out, t, peak = 0.2) => {
  const g = gain(ctx, 0, out);
  env(g.gain, t, { peak, a: 0.0005, d: 0.005, dur: 0.005, r: 0.002 });
  noise(ctx, t, t + 0.03, filter(ctx, 'highpass', 5000, 0.707, g));
};

const FAMILIES = {
  // 低音 + 拨音，小二度；question 版最后停在增四度
  suspicion(ctx, out, t0, rnd, { bpm, bars, key, question }) {
    const beat = 60 / bpm, steps = bars * 4;
    for (let i = 0; i < bars; i++) note(ctx, out, 'sine', key - 12, t0 + i * 4 * beat, 4 * beat, 0.35, 400);
    for (let i = 0; i < steps; i += 2) {
      let iv = [0, 1, 0, 7, 3, 1][Math.floor(rnd() * 6)];
      if (question && i >= steps - 2) iv = 6;
      note(ctx, out, 'sine', key + 12 + iv, t0 + i * beat, 1.2, 0.2, 3000);
    }
  },
  // 失谐锯齿 pad，Am–F，0.1Hz LFO 调制滤波
  pad(ctx, out, t0, rnd, { bpm, bars, key }) {
    const bar = (60 / bpm) * 4, len = bars * bar;
    const lp = filter(ctx, 'lowpass', 600, 0.9);
    const g = gain(ctx, 0.12, out);
    lp.connect(g);
    const lfo = osc(ctx, 'sine', 0.1, t0, t0 + len + 4, gain(ctx, 300, lp.frequency));
    for (let b = 0; b < bars; b++) {
      const root = key + (b % 2 ? -4 : 0);
      [0, 3, 7].forEach((iv) => [-8, 8].forEach((c) => {
        const gg = gain(ctx, 0, lp);
        env(gg.gain, t0 + b * bar, { peak: 0.5, a: bar * 0.4, d: bar * 0.6, s: 0.9, dur: bar, r: 0.3 });
        const o = osc(ctx, 'sawtooth', hz(root + iv), t0 + b * bar, t0 + (b + 1) * bar + 0.4, gg);
        o.detune.value = c;
      }));
    }
    const h = gain(ctx, 0.01, out);
    noise(ctx, t0, t0 + len + 4, filter(ctx, 'lowpass', 1500, 0.707, h));
    void rnd; void lfo;
  },
  // 八分音符固定音型 + 四四拍底鼓
  drive(ctx, out, t0, rnd, { bpm, bars, key }) {
    const beat = 60 / bpm, pat = [0, 7, 12, 7, 3, 10, 12, 10];
    for (let i = 0; i < bars * 8; i++) note(ctx, out, 'sawtooth', key + pat[i % 8], t0 + i * beat / 2, 0.12, 0.15, 1800);
    for (let i = 0; i < bars * 4; i++) kick(ctx, out, t0 + i * beat);
    void rnd;
  },
  // 低音锯齿 + 三全音，类定音鼓 + 心跳
  dread(ctx, out, t0, rnd, { bpm, bars, key }) {
    const beat = 60 / bpm, bar = beat * 4;
    for (let b = 0; b < bars; b++) {
      note(ctx, out, 'sawtooth', key - 24, t0 + b * bar, bar, 0.2, 300);
      note(ctx, out, 'sawtooth', key - 18, t0 + b * bar, bar, 0.1, 300);
      kick(ctx, out, t0 + b * bar, 0.7);
      kick(ctx, out, t0 + b * bar + beat * 0.5, 0.45);
      kick(ctx, out, t0 + b * bar + beat * 2, 0.7);
      kick(ctx, out, t0 + b * bar + beat * 2.5, 0.45);
    }
    void rnd;
  },
  // 拨奏 + 时钟 tick
  clock(ctx, out, t0, rnd, { bpm, bars, key }) {
    const beat = 60 / bpm, scale = [0, 2, 3, 5, 7, 8, 10, 12];
    for (let i = 0; i < bars * 8; i++) {
      note(ctx, out, 'triangle', key + 12 + scale[Math.floor(rnd() * 8)], t0 + i * beat / 2, 0.08, 0.3, 4000);
      if (i % 2 === 0) tick(ctx, out, t0 + i * beat / 2);
    }
  },
};

const T = (id, title, family, bpm, bars, key, extra = {}) => ({ id, title, family, bpm, bars, key, seed: id * 7919, ...extra });
export const TRACKS = [
  T(1, 'Quiet Suspicion', 'suspicion', 70, 8, 38),
  T(2, 'Into The Fog', 'pad', 60, 4, 57),
  T(3, 'Quiet Suspicion - Question', 'suspicion', 70, 8, 38, { question: true }),
  T(4, 'Lost In Thought', 'pad', 64, 4, 57),
  T(5, 'Track 05', 'suspicion', 72, 8, 41),
  T(6, 'Track 06', 'pad', 58, 4, 55),
  T(7, 'In Between', 'pad', 66, 4, 57),
  T(8, 'Track 08', 'pad', 62, 4, 52),
  T(9, 'Keep Moving', 'drive', 110, 4, 45),
  T(10, 'Track 10', 'drive', 104, 4, 43),
  T(11, 'Reckoning', 'dread', 80, 4, 45),
  T(12, 'Second Guess', 'dread', 90, 4, 43),
  T(13, 'Track 13', 'dread', 84, 4, 40),
  T(14, 'Track 14', 'suspicion', 76, 8, 36),
  T(15, 'Track 15', 'drive', 116, 4, 47),
  T(16, 'Track 16', 'pad', 68, 4, 50),
  T(17, 'Forward Motion', 'drive', 120, 4, 45),
  T(18, 'Track 18', 'drive', 108, 4, 41),
  T(19, 'Track 19', 'dread', 96, 4, 38),
  T(20, 'Track 20', 'clock', 84, 4, 48),
  T(21, 'Track 21', 'suspicion', 66, 8, 40),
  T(22, 'Pizzicato Clock', 'clock', 90, 4, 48),
];

export const loopLength = (t) => (t.bars * 4 * 60) / t.bpm;
export const buildLoop = (ctx, out, t0, rnd, t) => FAMILIES[t.family](ctx, out, t0, rnd, t);
