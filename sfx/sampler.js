// 极简采样播放器：解码 WebAudioFont 数据里的 base64 MP3，按 zone 变调、循环、加包络。
// 解码一次得到的 AudioBuffer 可被任意 context 复用。
const RELEASE = 0.06;
// ahdsr 为 true 的 zone 使用自然衰减包络（钢琴、拨弦等）：[累计时间(秒), 音量]
const DECAY = [[0, 1], [0.5, 1], [2, 0.5], [5, 0]];

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

export async function decodePreset(ctx, preset) {
  await Promise.all(preset.zones.map(async (z) => {
    if (z.buffer) return;
    if (!z.file) throw new Error('unsupported zone: no mp3 data');
    z.buffer = await ctx.decodeAudioData(bytes(z.file));
  }));
}

function pickZone(preset, midi) {
  let best = null, dist = Infinity;
  for (const z of preset.zones) {
    const d = midi < z.keyRangeLow ? z.keyRangeLow - midi : midi > z.keyRangeHigh ? midi - z.keyRangeHigh : 0;
    if (d < dist) { best = z; dist = d; }
    if (d === 0) break;
  }
  if (!best || dist > 2) throw new Error(`note ${midi} is outside the instrument range`);
  return best;
}

// 在 t 时刻演奏 midi 音，持续 dur 秒后释放。slides: [{ when, delta }]（相对音头的秒数、半音数）。
export function playZone(ctx, out, preset, t, midi, dur, vol, slides = []) {
  const z = pickZone(preset, midi);
  const env = ctx.createGain();
  env.connect(out);
  const pts = z.ahdsr ? DECAY : [[0, 1]];
  const at = (x) => {
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      return v0 + ((x - t0) / (t1 - t0)) * (v1 - v0);
    }
    return pts[pts.length - 1][1];
  };
  env.gain.setValueAtTime(vol * pts[0][1], t);
  for (const [pt, pv] of pts) if (pt > 0 && pt < dur) env.gain.linearRampToValueAtTime(vol * pv, t + pt);
  env.gain.setValueAtTime(Math.max(vol * at(dur), 1e-6), t + dur);
  env.gain.linearRampToValueAtTime(0, t + dur + RELEASE);

  const src = ctx.createBufferSource();
  src.buffer = z.buffer;
  const cents = 100 * midi - (z.originalPitch - 100 * z.coarseTune - z.fineTune);
  src.playbackRate.value = 2 ** (cents / 1200);
  for (const s of slides) src.detune.linearRampToValueAtTime(100 * s.delta, t + s.when);
  const looped = z.loopStart >= 1 && z.loopStart < z.loopEnd;
  if (looped) {
    src.loop = true;
    src.loopStart = z.loopStart / z.sampleRate;
    src.loopEnd = z.loopEnd / z.sampleRate;
  }
  src.connect(env);
  src.start(t);
  src.stop(t + dur + RELEASE + 0.01);
  return env;
}
