// 音效库入口：createSfx / render / SFX_NAMES / TRACKS
import { mulberry32, encodeWav } from './core.js';
import { SOUNDS } from './sounds.js';
import { TRACKS, loopLength, buildLoop } from './loops.js';
import { loadInstruments } from './instruments.js';

export { SOUNDS, TRACKS, encodeWav, loadInstruments };
export const SFX_NAMES = Object.keys(SOUNDS);
const TAIL = 4; // 循环尾巴（秒），渲染后叠回开头，保证首尾无缝
const TARGET_PEAK = 0.8;

const seedOf = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const findTrack = (id) => TRACKS.find((t) => t.id === id);

function normalize(buf, peak = TARGET_PEAK) {
  let max = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let c = 0; c < buf.numberOfChannels; c++) buf.getChannelData(c).forEach((v, i, a) => (a[i] = v * (peak / max)));
  return buf;
}

// 渲染音效名或循环 id 为 AudioBuffer（循环长度恰为 bars*4*60/bpm），峰值归一到 0.8
export async function render(key, { sampleRate = 44100 } = {}) {
  const track = typeof key === 'number' ? findTrack(key) : null;
  if (typeof key === 'number' && !track) throw new Error(`unknown loop: ${key}`);
  if (!track && !SOUNDS[key]) throw new Error(`unknown sound: ${key}`);
  await loadInstruments();
  const len = track ? Math.round(loopLength(track) * sampleRate) : 0;
  const total = track ? len + TAIL * sampleRate : Math.ceil(SOUNDS[key].duration * sampleRate);
  const ctx = new OfflineAudioContext(2, total, sampleRate);
  const master = ctx.createGain();
  // 25Hz 高通去掉部分 pad 采样自带的直流偏移
  const dc = ctx.createBiquadFilter();
  dc.type = 'highpass'; dc.frequency.value = 25;
  dc.connect(ctx.destination);
  master.connect(dc);
  if (track) buildLoop(ctx, master, 0, mulberry32(track.seed), track);
  else SOUNDS[key].build(ctx, master, 0, mulberry32(seedOf(key)));
  const buf = await ctx.startRendering();
  if (!track) {
    // 末尾 50ms 淡出，避免采样余音被截断出现爆音
    const n = Math.floor(0.05 * sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
    }
    return normalize(buf);
  }
  const out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate });
  for (let c = 0; c < 2; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = src[i] + (i < total - len ? src[len + i] : 0);
  }
  return normalize(out);
}

export function createSfx({ ctx = new AudioContext(), destination, volume = 0.8 } = {}) {
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(destination || ctx.destination);
  const ready = loadInstruments();

  const cache = new Map();
  const buffer = (key) => {
    if (!cache.has(key)) cache.set(key, render(key, { sampleRate: ctx.sampleRate }));
    return cache.get(key);
  };

  async function play(name, { when = 0, gain = 1, pan = 0 } = {}) {
    if (!SOUNDS[name]) throw new Error(`unknown sound: ${name}`);
    const buf = await buffer(name);
    const src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
    src.buffer = buf; g.gain.value = gain; p.pan.value = pan;
    src.connect(g).connect(p).connect(master);
    const ended = new Promise((r) => (src.onended = r));
    src.start(ctx.currentTime + when);
    return { stop: () => { try { src.stop(); } catch { /* 已结束 */ } }, ended };
  }

  let current = null;
  function fadeOut(entry, s) {
    const t = ctx.currentTime;
    entry.gain.gain.cancelScheduledValues(t);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, t);
    entry.gain.gain.linearRampToValueAtTime(0, t + s);
    entry.src.stop(t + s + 0.05);
  }
  const loops = {
    get current() { return current ? current.id : null; },
    async start(id, { fadeIn = 0.5 } = {}) {
      if (!findTrack(id)) throw new Error(`unknown loop: ${id}`);
      const buf = await buffer(id);
      if (current) fadeOut(current, fadeIn);
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeIn);
      src.connect(g).connect(master);
      src.start();
      current = { id, src, gain: g };
    },
    stop({ fadeOut: s = 0.5 } = {}) {
      if (current) fadeOut(current, s);
      current = null;
    },
  };
  return { ctx, master, ready, play, loops };
}
