// 真实乐器采样：WebAudioFont 数据（FluidR3 GM 音色，授权见 sfx/vendor/LICENSES.txt）。
// 乐器数据由页面以 <script> 载入，每个文件定义一个全局预设变量；这里负责解码和调度。
import { decodePreset, playZone } from './sampler.js';
const G = globalThis;
const tone = (n) => `_tone_${String(n * 10).padStart(4, '0')}_FluidR3_GM_sf2_file`;
const drum = (n) => `_drum_${n}_0_FluidR3_GM_sf2_file`;

export const INSTR = {
  piano: tone(0), celesta: tone(8), glock: tone(9), xylo: tone(13),
  cello: tone(42), bass: tone(43), tremolo: tone(44), pizz: tone(45), harp: tone(46), timpani: tone(47),
  choir: tone(52), square: tone(80), warm: tone(89), sweep: tone(95), sea: tone(122),
  kick: drum(36), side: drum(37), snare: drum(38), hat: drum(42), crash: drum(49),
  cabasa: drum(69), claves: drum(75), wood: drum(76), tri: drum(81),
};
const DRUM_NOTE = { kick: 36, side: 37, snare: 38, hat: 42, crash: 49, cabasa: 69, claves: 75, wood: 76, tri: 81 };

let loading;
// 解码全部乐器采样。解码出的 AudioBuffer 可被任意 context 复用。
export function loadInstruments() {
  return (loading ||= (async () => {
    const presets = Object.entries(INSTR).map(([k, v]) => {
      if (!G[v]) throw new Error(`instrument script missing: ${k} (${v})`);
      return G[v];
    });
    const dec = new OfflineAudioContext(2, 1, 44100);
    await Promise.all(presets.map((p) => decodePreset(dec, p)));
  })());
}

// 在 t 时刻演奏一个音。slides: [{ when, delta }]，delta 为半音数，用于滑音。
export function note(ctx, out, name, t, midi, dur, vol = 0.5, slides) {
  const preset = G[INSTR[name]];
  if (!preset) throw new Error(`unknown instrument: ${name}`);
  const pitch = DRUM_NOTE[name] ?? midi;
  return playZone(ctx, out, preset, t, pitch, dur, vol, slides);
}
