// 公共原语：随机数、噪声、包络、节点小工具、wav 编码
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new WeakMap();
export function noiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const rnd = mulberry32(12345);
    buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

// 起音 a、衰减 d 到 s 电平、在 t0+dur 开始释放 r
export function env(param, t0, { peak = 1, a = 0.005, d = 0.05, s = 0.0001, dur = 0.1, r = 0.05 }) {
  param.setValueAtTime(0.0001, t0);
  param.linearRampToValueAtTime(peak, t0 + a);
  param.exponentialRampToValueAtTime(Math.max(s * peak, 0.0001), t0 + a + d);
  param.setValueAtTime(Math.max(s * peak, 0.0001), Math.max(t0 + a + d, t0 + dur));
  param.exponentialRampToValueAtTime(0.0001, t0 + dur + r);
}

export function osc(ctx, type, freq, t0, t1, dest) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.connect(dest);
  o.start(t0);
  o.stop(t1);
  return o;
}

export function noise(ctx, t0, t1, dest, offset = 0) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx);
  n.connect(dest);
  n.start(t0, offset);
  n.stop(t1);
  return n;
}

export function filter(ctx, type, freq, q = 0.707, dest) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  if (dest) f.connect(dest);
  return f;
}

export function gain(ctx, value, dest) {
  const g = ctx.createGain();
  g.gain.value = value;
  if (dest) g.connect(dest);
  return g;
}

export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, n = buffer.length, sr = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
  out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data');
  out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch).keys()].map((c) => buffer.getChannelData(c));
  let p = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      p += 2;
    }
  return out.buffer;
}
