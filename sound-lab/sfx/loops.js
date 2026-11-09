// 22 条配乐循环：5 个曲风族群，全部由真实乐器采样演奏。曲名 05/06/08/10/13-16/18-21 为占位。
import { note } from './instruments.js';

const kick = (ctx, out, t, v = 0.8) => note(ctx, out, 'kick', t, 36, 0.3, v);
const hat = (ctx, out, t, v = 0.25) => note(ctx, out, 'hat', t, 42, 0.1, v);

const FAMILIES = {
  // 悬疑：大提琴低音持续 + 钢琴小二度稀疏拨点 + 钢片琴高音；question 版结尾停在增四度
  suspicion(ctx, out, t0, rnd, { bpm, bars, key, question }) {
    const beat = 60 / bpm, bar = beat * 4;
    for (let b = 0; b < bars; b++) {
      note(ctx, out, 'cello', t0 + b * bar, key - 12, bar * 1.05, 0.5);
      if (b % 2 === 0) note(ctx, out, 'pizz', t0 + b * bar + beat * 2, key - 12, 0.4, 0.5);
    }
    for (let i = 0; i < bars * 4; i += 2) {
      let iv = [0, 1, 0, 7, 3, 1][Math.floor(rnd() * 6)];
      if (question && i >= bars * 4 - 2) iv = 6;
      note(ctx, out, 'piano', t0 + i * beat, key + 12 + iv, 1.4, 0.4);
      if (i % 8 === 6) note(ctx, out, 'celesta', t0 + i * beat + beat, key + 24 + iv, 1.5, 0.22);
    }
  },
  // 雾、沉思、之间：暖 pad 铺和弦（Am–F 式往复）+ 合唱高声部 + 钢琴单音
  pad(ctx, out, t0, rnd, { bpm, bars, key }) {
    const bar = (60 / bpm) * 4;
    for (let b = 0; b < bars; b++) {
      const root = key + (b % 2 ? -4 : 0);
      [0, 7, 12, 15].forEach((iv) => note(ctx, out, 'warm', t0 + b * bar, root + iv - 12, bar * 1.1, 0.35));
      note(ctx, out, 'choir', t0 + b * bar, root + 12, bar * 1.05, 0.28);
      if (rnd() < 0.7) note(ctx, out, 'piano', t0 + b * bar + bar * (0.25 + rnd() * 0.5), root + 24 + [0, 3, 7][Math.floor(rnd() * 3)], 1.6, 0.3);
    }
  },
  // 前进：拨弦八分音型 + 大提琴低音 + 底鼓和踩镲
  drive(ctx, out, t0, rnd, { bpm, bars, key }) {
    const beat = 60 / bpm, bar = beat * 4, pat = [0, 7, 12, 7, 3, 10, 12, 10];
    for (let i = 0; i < bars * 8; i++) note(ctx, out, 'pizz', t0 + (i * beat) / 2, key + pat[i % 8], 0.18, 0.55);
    for (let b = 0; b < bars; b++) {
      note(ctx, out, 'cello', t0 + b * bar, key - 12 + (b % 2 ? -2 : 0), bar * 1.05, 0.45);
      for (let k = 0; k < 4; k++) { kick(ctx, out, t0 + b * bar + k * beat); hat(ctx, out, t0 + b * bar + k * beat + beat / 2); }
    }
    void rnd;
  },
  // 清算、二次猜测：定音鼓心跳 + 低音提琴 + 颤音弦乐三全音 + 低钢琴
  dread(ctx, out, t0, rnd, { bpm, bars, key }) {
    const beat = 60 / bpm, bar = beat * 4;
    for (let b = 0; b < bars; b++) {
      const t = t0 + b * bar;
      note(ctx, out, 'bass', t, key - 24, bar * 1.05, 0.6);
      note(ctx, out, 'tremolo', t, key, bar * 1.05, 0.3);
      note(ctx, out, 'tremolo', t, key + 6, bar * 1.05, 0.22);
      [0, 0.5, 2, 2.5].forEach((o, i) => note(ctx, out, 'timpani', t + o * beat, i % 2 ? 38 : 36, 0.8, i % 2 ? 0.55 : 0.85));
      if (b % 2 === 1) note(ctx, out, 'piano', t + beat * 3, key - 12 + 1, 1.5, 0.35);
    }
    void rnd;
  },
  // 时钟：拨弦、竖琴点奏 + 木鱼 tick + 钢片琴重音
  clock(ctx, out, t0, rnd, { bpm, bars, key }) {
    const beat = 60 / bpm, scale = [0, 2, 3, 5, 7, 8, 10, 12];
    for (let i = 0; i < bars * 8; i++) {
      const t = t0 + (i * beat) / 2, m = key + 12 + scale[Math.floor(rnd() * 8)];
      note(ctx, out, i % 3 === 0 ? 'harp' : 'pizz', t, m, 0.15, 0.5);
      if (i % 2 === 0) note(ctx, out, 'wood', t, 76, 0.05, 0.4);
      if (i % 8 === 0) note(ctx, out, 'celesta', t, m + 12, 1.0, 0.25);
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
