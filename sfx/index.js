// 音效库入口：createSfx / render / SFX_NAMES / TRACKS
import { mulberry32, encodeWav } from './core.js';
import { SOUNDS } from './sounds.js';
import { TRACKS, loopLength, buildLoop } from './loops.js';

export { SOUNDS, TRACKS, encodeWav };
export const SFX_NAMES = Object.keys(SOUNDS);
const TAIL = 4; // 循环尾巴（秒），渲染后叠回开头，保证首尾无缝

const seedOf = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const findTrack = (id) => TRACKS.find((t) => t.id === id);

// 渲染音效名或循环 id 为 AudioBuffer（循环长度恰为 bars*4*60/bpm）
export async function render(key, { sampleRate = 44100 } = {}) {
  const track = typeof key === 'number' ? findTrack(key) : null;
  if (typeof key === 'number' && !track) throw new Error(`unknown loop: ${key}`);
  if (!track && !SOUNDS[key]) throw new Error(`unknown sound: ${key}`);
  const len = track ? Math.round(loopLength(track) * sampleRate) : 0;
  const total = track ? len + TAIL * sampleRate : Math.ceil(SOUNDS[key].duration * sampleRate);
  const ctx = new OfflineAudioContext(2, total, sampleRate);
  const master = ctx.createGain();
  master.connect(ctx.destination);
  if (track) buildLoop(ctx, master, 0, mulberry32(track.seed), track);
  else SOUNDS[key].build(ctx, master, 0, mulberry32(seedOf(key)));
  const buf = await ctx.startRendering();
  if (!track) return buf;
  const out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate });
  for (let c = 0; c < 2; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) dst[i] = src[i] + (i < total - len ? src[len + i] : 0);
  }
  return out;
}

export function createSfx({ ctx = new AudioContext(), destination, volume = 0.8 } = {}) {
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(destination || ctx.destination);

  function play(name, { when = 0, gain = 1, pan = 0 } = {}) {
    const def = SOUNDS[name];
    if (!def) throw new Error(`unknown sound: ${name}`);
    const t0 = ctx.currentTime + when;
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p).connect(master);
    def.build(ctx, g, t0, mulberry32(seedOf(name) ^ (Math.random() * 1e9)));
    const ended = new Promise((r) => setTimeout(r, (when + def.duration) * 1000));
    return { stop: () => g.disconnect(), ended };
  }

  const cache = new Map();
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
      if (!cache.has(id)) cache.set(id, render(id, { sampleRate: ctx.sampleRate }));
      const buffer = await cache.get(id);
      if (current) fadeOut(current, fadeIn);
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buffer; src.loop = true;
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
  return { ctx, play, loops };
}
