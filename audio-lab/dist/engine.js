// Pure-JS DSP primitives. No Web Audio nodes, no samples: everything is computed from math,
// so the same code renders in the browser and in Node (for the offline validation tools).
const SR = 44100;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mk = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dB = (x) => Math.pow(10, x / 20);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function n2f(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  return mtof(12 * (+m[2] + 1) + NOTE[m[1]]);
}

// piecewise curve through [t, v] points, smoothstep between them
function curve(points) {
  return function (t) {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [t0, v0] = points[i - 1], [t1, v1] = points[i];
        const u = (t - t0) / (t1 - t0 || 1e-9);
        return lerp(v0, v1, u * u * (3 - 2 * u));
      }
    }
    return points[points.length - 1][1];
  };
}

// RBJ biquad, coefficients can be re-set while running
class Biquad {
  constructor(type, f, q = 0.7071, gDb = 0) {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(type, f, q, gDb);
  }
  set(type, f, q = 0.7071, gDb = 0) {
    f = clamp(f, 10, SR * 0.47);
    const w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'notch') { b0 = 1; b1 = -2 * c; b2 = 1; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else { // peak
      const A = Math.pow(10, gDb / 40);
      b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// run a static filter chain over a buffer in place
function filt(buf, ...fs) {
  for (const f of fs) for (let i = 0; i < buf.length; i++) buf[i] = f.p(buf[i]);
  return buf;
}

// white noise with its own seed
function noise(sec, seed = 1) {
  const r = rng(seed), b = mk(sec);
  for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1;
  return b;
}

// multiply buffer by an envelope function of time
function shape(buf, fn) {
  for (let i = 0; i < buf.length; i++) buf[i] *= fn(i / SR);
  return buf;
}

// band-pass noise whose centre follows fc(t) (Hz), amplitude amp(t)
function sweepNoise(sec, fc, q, amp, seed = 3, type = 'bp') {
  const r = rng(seed), b = mk(sec), f = new Biquad(type, fc(0), q);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    if ((i & 7) === 0) f.set(type, fc(t), q);
    b[i] = f.p(r() * 2 - 1) * amp(t);
  }
  return b;
}

// additive voice: partials [{f, a, tau}] with exponential decay, short linear attack
function additive(sec, parts, attack = 0.002, phase = 0) {
  const b = mk(sec), n = b.length;
  for (const p of parts) {
    if (p.f >= SR * 0.45 || p.a < 1e-5) continue;
    const w = (TAU * p.f) / SR, ph = p.ph !== undefined ? p.ph : phase;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const e = Math.exp(-t / p.tau) * (t < attack ? t / attack : 1);
      if (e < 1e-4 && t > attack) break;
      b[i] += p.a * e * Math.sin(w * i + ph);
    }
  }
  return b;
}

// mix src into dst at time `at` (s), gain g; extends nothing (clips at end)
function mixAt(dst, src, at, g = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length; i++) {
    const j = o + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * g;
  }
  return dst;
}

// mix with wrap-around (loop tails continue at the start)
function mixWrap(dst, src, at, g = 1) {
  const o = Math.round(at * SR), n = dst.length;
  for (let i = 0; i < src.length; i++) {
    let j = (o + i) % n; if (j < 0) j += n;
    dst[j] += src[i] * g;
  }
  return dst;
}

// small Schroeder-style room; high-passed input so the tail never rumbles
function reverb(buf, wet = 0.15, size = 1, hpHz = 220, damp = 0.35) {
  const ds = [1116, 1188, 1277, 1356].map((d) => Math.round(d * size));
  const fb = 0.78;
  const combs = ds.map((d) => ({ d, buf: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [225, 341].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  const hp = new Biquad('hp', hpHz, 0.7);
  const out = new Float32Array(buf.length);
  for (let n = 0; n < buf.length; n++) {
    const x = hp.p(buf[n]);
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * (1 - damp) + c.lp * damp;
      c.buf[c.i] = x + c.lp * fb;
      c.i = (c.i + 1) % c.d;
      y += o;
    }
    for (const a of aps) {
      const o = a.buf[a.i], v = y + o * 0.5;
      a.buf[a.i] = v;
      a.i = (a.i + 1) % a.d;
      y = o - v * 0.5;
    }
    out[n] = buf[n] + y * wet * 0.25;
  }
  return out;
}

const peakOf = (b) => { let m = 0; for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > m) m = v; } return m; };

// last stage: DC block, gentle saturation, 2 ms fades so no sound starts or ends with a click
function master(buf, peak = 0.85, { fade = 0.002, fadeOut = 0.004, drive = 1.0 } = {}) {
  let x1 = 0, y1 = 0;
  for (let i = 0; i < buf.length; i++) { const y = buf[i] - x1 + 0.9975 * y1; x1 = buf[i]; y1 = y; buf[i] = y; }
  const p0 = peakOf(buf) || 1;
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh((buf[i] / p0) * drive * 1.2) / Math.tanh(drive * 1.2);
  const k = peak / (peakOf(buf) || 1);
  const fi = Math.round(fade * SR), fo = Math.round(fadeOut * SR);
  for (let i = 0; i < buf.length; i++) {
    let g = k;
    if (i < fi) g *= i / fi;
    const r = buf.length - 1 - i; if (r < fo) g *= r / fo;
    buf[i] *= g;
  }
  return buf;
}

// Video 1 — "Sounds you need in your next edits": 12 sound effects, built from oscillators + noise.
// Timings / spectra below were measured from the reference clip (see tools/analyze_ref.py).

// short band-limited noise tick: exp decay, centre fc
function tick(fc, q, tau, amp, seed, len = 0.04) {
  const b = noise(len, seed);
  filt(b, new Biquad('bp', fc, q));
  return shape(b, (t) => amp * Math.exp(-t / tau));
}

// slow random flutter in [~0.5, ~1.5] used for turbulence-like amplitude wobble
function flutter(sec, hz, depth, seed) {
  const b = noise(sec, seed);
  filt(b, new Biquad('lp', hz, 0.7), new Biquad('lp', hz, 0.7));
  const p = peakOf(b) || 1;
  for (let i = 0; i < b.length; i++) b[i] = 1 + (b[i] / p) * depth;
  return b;
}

// low-weighted noise (-6 dB/oct above `corner`): the originals carry most of their energy in the lows
function tiltedNoise(sec, seed, corner = 140) {
  const b = noise(sec, seed);
  const lp = new Biquad('lp', corner, 0.7), lp2 = new Biquad('lp', corner * 2.2, 0.7);
  const out = mk(sec);
  for (let i = 0; i < b.length; i++) out[i] = lp.p(b[i]) * 1.6 + lp2.p(b[i]) * 0.9 + b[i] * 0.05;
  return out;
}

// pure sine with a smooth in/out envelope (sub layers are never saw / square, never glide down)
function subSine(sec, f, amp, env, harm = [1, 0.35, 0.12]) {
  const b = mk(sec);
  for (let k = 0; k < harm.length; k++) {
    const w = (TAU * f * (k + 1)) / SR;
    for (let i = 0; i < b.length; i++) b[i] += harm[k] * Math.sin(w * i);
  }
  return shape(b, (t) => amp * env(t));
}

function eightBitTalking() {
  const dur = 2.4, b = mk(dur), r = rng(11);
  const period = 0.06674, on = 0.024, pulses = 36;
  const seq = [445, 405, 478, 445, 515, 465, 425, 445, 492, 435];
  let f = 445, left = 0, syl = 0;
  for (let k = 0; k < pulses; k++) {
    const t = 0.002 + k * period;
    if (left <= 0) { f = seq[syl++ % seq.length] * (1 + (r() - 0.5) * 0.05); left = 3 + Math.floor(r() * 4); }
    left--;
    const amp = t > 1.4 && t < 1.8 ? 0.9 : 1;
    const n = Math.round(on * SR), o = Math.round(t * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      ph += (f * (1 + 0.04 * (1 - tt / on))) / SR;
      const tri = Math.sin(TAU * ph) + 0.22 * Math.sin(TAU * ph * 2 + 0.6);
      const e = Math.min(1, tt / 0.0015) * Math.min(1, (on - tt) / 0.005);
      b[o + i] += tri * e * amp * 0.5;
    }
  }
  // 5-bit quantise gives the retro grit; low-pass keeps it from buzzing
  for (let i = 0; i < b.length; i++) b[i] = Math.round(b[i] * 15) / 15;
  filt(b, new Biquad('lp', 1500, 0.7), new Biquad('hp', 150, 0.7));
  return master(b, 0.82);
}

function oldFlash() {
  const b = mk(0.82);
  // flash charging whine, rising just before the pop
  { const w = mk(0.1); let ph = 0; for (let i = 0; i < w.length; i++) { const t = i / SR; ph += (TAU * (5200 + 3600 * (t / 0.1))) / SR; w[i] = Math.sin(ph) * 0.06 * Math.min(1, t / 0.01); } mixAt(b, w, 0.0); }
  mixAt(b, tick(3200, 0.9, 0.006, 0.45, 21), 0.0);
  mixAt(b, tick(2400, 0.9, 0.008, 0.38, 22), 0.09);
  // main burst: noise swell then fast decay, with a little capacitor-discharge sizzle
  const env = curve([[0, 0], [0.09, 1]]);
  const fl = flutter(0.5, 90, 0.4, 24);
  const burst = (x, flut) => { shape(x, (t) => (t < 0.09 ? env(t) : Math.exp(-(t - 0.09) / 0.085))); if (flut) for (let i = 0; i < x.length; i++) x[i] *= fl[i]; return x; };
  const hi = noise(0.5, 23);
  filt(hi, new Biquad('lp', 9500, 0.7), new Biquad('hp', 200, 0.7));
  mixAt(b, burst(hi, true), 0.1, 0.55);
  mixAt(b, burst(tiltedNoise(0.5, 27, 260), false), 0.1, 0.5);
  // low thump under the flash (smooth sine, no pitch fall)
  mixAt(b, subSine(0.5, 48, 0.45, (t) => curve([[0, 0], [0.05, 1]])(t) * Math.exp(-t / 0.16), [1, 0.4, 0.15]), 0.14);
  // two tiny after-pops
  mixAt(b, tick(3300, 3, 0.012, 0.16, 25, 0.1), 0.48);
  mixAt(b, tick(4300, 3, 0.012, 0.14, 26, 0.1), 0.71);
  return master(b, 0.85);
}

function cinematicWoosh() {
  const b = mk(2.3);
  const fc = (t) => 250 * Math.pow(8, clamp(t / 0.46, 0, 1));
  const ampC = curve([[0, 0.03], [0.2, 0.2], [0.46, 0.85], [0.6, 0.8], [0.75, 0.75]]);
  const cut = (t) => (t < 0.74 ? 1 : clamp(1 - (t - 0.74) / 0.02, 0, 1));
  const fl = flutter(0.8, 55, 0.4, 32);
  const body = sweepNoise(0.8, fc, 0.9, (t) => ampC(t) * cut(t), 31);
  for (let i = 0; i < body.length; i++) body[i] *= fl[i];
  const low = noise(0.8, 33);
  filt(low, new Biquad('lp', 700, 0.7), new Biquad('hp', 120, 0.7));
  shape(low, (t) => ampC(t) * cut(t) * 0.55);
  filt(body, new Biquad('lp', 3800, 0.7));
  mixAt(b, body, 0.0, 0.8);
  mixAt(b, low, 0.0, 1.0);
  mixAt(b, subSine(0.8, 79, 0.75, (t) => ampC(t) * cut(t)), 0.0);
  mixAt(b, tiltedNoise(0.8, 35, 200).map((v, i) => v * ampC(i / SR) * cut(i / SR) * 0.7), 0.0);
  // long quiet room tail
  const tail = noise(1.6, 34);
  filt(tail, new Biquad('lp', 300, 0.7), new Biquad('hp', 90, 0.7));
  shape(tail, (t) => 0.045 * Math.exp(-t / 0.9) * Math.min(1, t / 0.05));
  mixAt(b, tail, 0.74, 1.0);
  return master(b, 0.85);
}

function nightVision() {
  const dur = 1.55, b = mk(dur);
  // rising tone, 1.6 kHz -> 2.4 kHz, with its 2nd/3rd/4th partials
  const f0 = (t) => 1600 + 800 * clamp((t - 0.07) / 1.45, 0, 1);
  const ampC = curve([[0.05, 0], [0.09, 0.45], [0.17, 0.55], [0.28, 0.2], [0.42, 0.5], [0.59, 1.0], [0.72, 0.5], [0.86, 0.22],
    [0.9, 0.3], [1.0, 0.12], [1.3, 0.06], [1.55, 0]]);
  const w = [0.55, 1.0, 0.5, 0.3];
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    ph += (TAU * f0(t)) / SR;
    const a = ampC(t) * 0.11;
    let s = 0;
    for (let k = 0; k < 4; k++) s += w[k] * Math.sin(ph * (k + 1));
    b[i] = s * a;
  }
  // start pop: broadband tick
  mixAt(b, tick(3500, 0.5, 0.012, 0.9, 41, 0.08), 0.02);
  // thin hiss floor behind the tone
  const hiss = noise(dur, 42);
  filt(hiss, new Biquad('bp', 2200, 0.7));
  shape(hiss, (t) => 0.012 * ampC(t));
  mixAt(b, hiss, 0);
  return master(b, 0.85);
}

function nextel() {
  const b = mk(0.46);
  // three square-wave chirps at ~1.85 kHz (odd harmonics land at 5.5 kHz like the original)
  const bursts = [[0.0, 0.036, 1.0], [0.044, 0.078, 1.0], [0.092, 0.148, 0.9]];
  for (const [s0, s1, a] of bursts) {
    const n = Math.round((s1 - s0) * SR), o = Math.round(s0 * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, d = s1 - s0;
      ph += 1840 / SR;
      const wob = s0 > 0.09 ? 1 - 0.1 * Math.sin((TAU * 38 * t)) : 1;
      b[o + i] += (ph % 1 < 0.5 ? 1 : -1) * a * wob * Math.min(1, t / 0.0008) * Math.min(1, (d - t) / 0.0015) * 0.6;
    }
    mixAt(b, tick(2600, 0.5, 0.006, 1.1, 51 + Math.round(s0 * 100), 0.03), s0);
  }
  filt(b, new Biquad('lp', 7500, 0.7));
  // faint 1.84 kHz ring-out
  mixAt(b, additive(0.3, [{ f: 1840, a: 0.025, tau: 0.07 }], 0.002), 0.15);
  return master(b, 0.88);
}

function digitalText() {
  const b = mk(0.62);
  // blip times / levels measured from the original (11 blips)
  const hits = [[0.0, 0.073, 5500], [0.038, 0.061, 5500], [0.072, 0.076, 5500], [0.11, 0.081, 5500], [0.168, 0.063, 5500],
    [0.222, 0.114, 5500], [0.28, 0.079, 5500], [0.302, 0.053, 2900], [0.37, 0.134, 5500], [0.45, 0.074, 5500], [0.486, 0.05, 2900]];
  hits.forEach(([t, a, f], i) => {
    const g = a / 0.134;
    mixAt(b, tick(f * 0.55, 0.35, 0.008, 1.5 * g, 61 + i, 0.05), t);
    mixAt(b, additive(0.05, [{ f, a: 0.5 * g, tau: 0.009 }, { f: f * 0.5, a: 0.08 * g, tau: 0.007 }], 0.0005), t);
  });
  // quiet data hiss trailing off (this is where the riser takes over)
  const h = noise(0.1, 69);
  filt(h, new Biquad('bp', 4000, 0.5));
  shape(h, (t) => 0.03 * Math.min(1, t / 0.01));
  mixAt(b, h, 0.52);
  return master(b, 0.8);
}

function riser() {
  const dur = 3.7, b = mk(dur);
  const up = 1.97;
  const fc = (t) => 450 * Math.pow(7, clamp(t / up, 0, 1));
  const ampC = (t) => (t < up ? 0.015 * Math.pow(20, t / up) : 0);
  const fl = flutter(up, 140, 0.35, 72);
  const n1 = sweepNoise(up, fc, 1.0, (t) => ampC(t) * (t > up - 0.006 ? clamp((up - t) / 0.006, 0, 1) : 1), 71);
  for (let i = 0; i < n1.length; i++) n1[i] *= fl[i];
  // fixed resonant streaks (the original has a comb of static bright lines)
  const peaks = [1560, 2650, 3050, 4020, 4700, 5100].map((f) => new Biquad('peak', f, 18, 9));
  filt(n1, ...peaks);
  mixAt(b, n1, 0);
  // sub swell: smooth 80 Hz sine that grows with the riser and rings out after the cut
  const subEnv = (t) => (t < 2.2 ? 0.02 * Math.pow(9, t / 2.2) : 0.18 * Math.exp(-(t - 2.2) / 0.6));
  mixAt(b, subSine(dur, 80, 1.15, subEnv, [1, 0.3, 0.1]), 0);
  // thin tone left hanging at 4 kHz after the cut
  mixAt(b, additive(1.4, [{ f: 4020, a: 0.004, tau: 0.4 }], 0.01), up);
  return master(b, 0.88);
}

function counter() {
  const dur = 0.88, b = mk(dur);
  // fast mechanical ticks (strong / weak pairs, 70.6 ms apart) over a faint 500 Hz hum
  for (let k = 0; k < 12; k++) {
    const t = 0.0 + k * 0.0706;
    mixAt(b, tick(2400, 0.45, 0.004, 0.9, 81 + k, 0.03), t);
    mixAt(b, tick(1800, 0.5, 0.004, 0.5, 111 + k, 0.03), t + 0.035);
    mixAt(b, additive(0.05, [{ f: 480, a: 0.3, tau: 0.012 }, { f: 960, a: 0.1, tau: 0.01 }], 0.001), t);
  }
  const hum = mk(dur);
  let ph = 0;
  for (let i = 0; i < hum.length; i++) { ph += 500 / SR; hum[i] = (ph % 1 < 0.5 ? 1 : -1) * 0.03; }
  filt(hum, new Biquad('lp', 1800, 0.7));
  shape(hum, (t) => (t < 0.86 ? 1 : 0));
  mixAt(b, hum, 0);
  return master(b, 0.8);
}

function bicycleChain() {
  const b = mk(0.62), r = rng(91);
  // ratchet clicks measured from the original: spacing eases from 26 ms to 42 ms (freewheel slowing)
  const ts = [0, 0.026, 0.054, 0.082, 0.112, 0.138, 0.168, 0.198, 0.228, 0.26, 0.292, 0.324, 0.364, 0.4, 0.44, 0.48, 0.522];
  const am = [1, 0.64, 0.85, 0.88, 0.45, 0.36, 0.41, 0.78, 0.73, 0.64, 0.5, 0.45, 0.49, 0.71, 0.55, 0.73, 0.79];
  ts.forEach((t, i) => {
    const a = am[i] * (0.9 + 0.2 * r());
    const fc = 8600 - 1500 * (t / 0.56);
    mixAt(b, tick(fc, 1.6, 0.0022, a, 92 + i, 0.015), t);
    mixAt(b, tick(fc * 0.85, 1.6, 0.003, a * 0.45, 292 + i, 0.015), t + 0.008);
    // tiny metallic ring (inharmonic partials)
    mixAt(b, additive(0.03, [{ f: 6900, a: 0.03 * a, tau: 0.004 }, { f: 9300, a: 0.02 * a, tau: 0.003 }], 0.0003), t);
  });
  filt(b, new Biquad('hp', 2500, 0.7));
  return master(b, 0.8);
}

function cameraClick() {
  const b = mk(0.6);
  // pre-focus tick
  mixAt(b, tick(1100, 1.2, 0.006, 0.2, 101, 0.04), 0.062);
  // autofocus-style 4 kHz beep that rings under the first clack
  const beep = additive(0.22, [{ f: 4000, a: 0.34, tau: 0.5 }, { f: 8000, a: 0.04, tau: 0.5 }], 0.003);
  shape(beep, (t) => (t < 0.18 ? 1 : clamp(1 - (t - 0.18) / 0.03, 0, 1)));
  mixAt(b, beep, 0.12);
  // first clack: two noise bursts (16.57 s, 16.62 s in the original)
  mixAt(b, tick(2200, 0.5, 0.008, 0.74, 103, 0.06), 0.158);
  mixAt(b, tick(2600, 0.5, 0.008, 0.68, 104, 0.06), 0.212);
  // shutter closing: broadband bursts (16.79, 16.83, 16.85, 16.91 s)
  mixAt(b, tick(3200, 0.45, 0.018, 1.0, 105, 0.08), 0.38);
  mixAt(b, tick(2400, 0.45, 0.014, 0.74, 106, 0.08), 0.418);
  mixAt(b, tick(2000, 0.45, 0.012, 0.3, 107, 0.08), 0.446);
  mixAt(b, tick(1500, 0.6, 0.01, 0.19, 108, 0.06), 0.502);
  filt(b, new Biquad('hp', 250, 0.7));
  return master(b, 0.85);
}

function shine() {
  const dur = 0.4, b = mk(dur);
  const env = curve([[0.0, 0], [0.06, 0.2], [0.16, 1], [0.21, 0.35], [0.26, 0.06], [0.4, 0]]);
  const low = sweepNoise(dur, (t) => 300 + 120 * clamp(t / 0.2, 0, 1), 1.6, env, 121);
  const hiss = noise(dur, 122);
  filt(hiss, new Biquad('hp', 5000, 0.7));
  shape(hiss, (t) => 0.05 * env(t));
  const swell = additive(dur, [{ f: 470, a: 0.2, tau: 0.09, ph: 0 }, { f: 940, a: 0.05, tau: 0.07 }], 0.04);
  mixAt(b, low, 0, 1.0);
  mixAt(b, hiss, 0, 1.0);
  mixAt(b, swell, 0.1, 0.5);
  // a shine glints: a few quick high pings that twinkle at the peak of the swell
  [[0.1, 5200, 0.16], [0.135, 6900, 0.2], [0.165, 4300, 0.14], [0.19, 8100, 0.12], [0.215, 5900, 0.08]].forEach(([t, f, a]) =>
    mixAt(b, additive(0.12, [{ f, a, tau: 0.03 }, { f: f * 2.01, a: a * 0.25, tau: 0.015 }], 0.0008), t));
  return master(b, 0.8);
}

function woosh() {
  const dur = 0.75, b = mk(dur);
  const env = curve([[0, 0], [0.1, 0.45], [0.16, 1], [0.24, 0.45], [0.33, 0.1], [0.45, 0.05], [0.7, 0.015]]);
  const fl = flutter(dur, 70, 0.3, 132);
  const mid = sweepNoise(dur, (t) => 560 - 240 * clamp(t / 0.35, 0, 1), 1.6, env, 131);
  for (let i = 0; i < mid.length; i++) mid[i] *= fl[i];
  const air = noise(dur, 133);
  filt(air, new Biquad('lp', 3500, 0.7), new Biquad('hp', 800, 0.7));
  shape(air, (t) => 0.012 * env(t));
  mixAt(b, mid, 0);
  mixAt(b, air, 0);
  mixAt(b, subSine(dur, 70, 0.04, env, [1, 0.3]), 0);
  return master(b, 0.82);
}

// ref = where the sound sits in the video-1 audio track (seconds)
const SFX = [
  { id: 'eightbit', name: '8 Bit Talking', ref: [0.11, 2.47], render: eightBitTalking },
  { id: 'oldflash', name: 'Old Flash', ref: [2.69, 3.5], render: oldFlash },
  { id: 'cinwoosh', name: 'Cinematic Woosh', ref: [4.19, 6.47], render: cinematicWoosh },
  { id: 'nightvision', name: 'Night Vision', ref: [6.73, 8.3], render: nightVision },
  { id: 'nextel', name: 'Nextel', ref: [8.59, 9.0], render: nextel },
  { id: 'digitaltext', name: 'Digital Text', ref: [9.07, 9.69], render: digitalText },
  { id: 'riser', name: 'Riser', ref: [9.7, 13.4], render: riser },
  { id: 'counter', name: 'Counter', ref: [14.07, 14.95], render: counter },
  { id: 'bicycle', name: 'Bicycle Chain', ref: [15.1, 15.7], render: bicycleChain },
  { id: 'camera', name: 'Camera Click', ref: [16.4, 17.0], render: cameraClick },
  { id: 'shine', name: 'Shine', ref: [17.49, 17.89], render: shine },
  { id: 'woosh', name: 'Woosh', ref: [18.62, 19.37], render: woosh },
];

// Video 2 — "Musical story loops": 10 loops in B minor, built from additive plucks, pads and filtered noise.
// Note lists / rhythms were transcribed from the reference audio (see tools/transcribe_loops.py).

// plucked string / mallet voice: inharmonic-stretched partials, pick-position comb, brighter partials die first
function pluck(f, o = {}) {
  const tau = o.tau ?? 0.2, nP = o.n ?? 8, vel = o.vel ?? 1, tilt = o.tilt ?? (f < 160 ? 0.8 : 1.7);
  const damp = o.damp ?? 1.0, B = o.B ?? 0.0002, pos = o.pos ?? 0.17, bright = o.bright ?? 1;
  const len = Math.min(tau * 7, o.maxLen ?? 3.5), parts = [];
  for (let k = 1; k <= nP; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    const comb = o.saw ? 1 : Math.abs(Math.sin(Math.PI * k * pos)) + 0.15;
    parts.push({ f: fk, a: 0.5 * vel * Math.pow(k, -tilt) * comb * (k === 1 ? 1 : bright), tau: tau / (1 + damp * (k - 1)), ph: k * 1.3 });
  }
  const b = additive(len, parts, o.attack ?? 0.0025);
  // soft pick transient (band-limited, tiny) so the onset isn't a pure sine blip
  if (o.pick !== 0) mixAt(b, tick(Math.min(4000, f * 6), 0.8, 0.0025, 0.1 * vel * (o.pick ?? 1), Math.round(f) + 7, 0.02), 0);
  return b;
}

// slightly detuned stack of bright plucks (synth-pluck character)
function synthPluck(f, o = {}) {
  const dets = o.det ?? [-30, 0, 28];
  const out = mk(Math.min((o.tau ?? 0.22) * 7, 2));
  dets.forEach((c, i) => mixAt(out, pluck(f * Math.pow(2, c / 1200), { ...o, saw: true, tilt: 1.35, damp: 0.7, n: 10, pick: 0, maxLen: 2 }), 0, 1 / dets.length));
  return out;
}

// soft bell / mallet: near-harmonic partials with slow bloom
function bell(f, o = {}) {
  const tau = o.tau ?? 0.6, vel = o.vel ?? 1;
  return additive(tau * 6, [
    { f, a: 0.8 * vel, tau }, { f: f * 2.0, a: 0.28 * vel, tau: tau * 0.6 }, { f: f * 3.01, a: 0.1 * vel, tau: tau * 0.35 },
    { f: f * 0.5, a: 0.3 * vel, tau: tau * 1.1 },
  ], o.attack ?? 0.03);
}

// low impact: a sine (never a buzzing saw) + harmonics that carry on small speakers + a short noise knock
function thump(f, o = {}) {
  const tau = o.tau ?? 0.16, vel = o.vel ?? 1;
  const b = additive(tau * 7, [{ f, a: 0.8 * vel, tau }, { f: f * 2, a: 0.4 * vel, tau: tau * 0.7 }, { f: f * 3, a: 0.2 * vel, tau: tau * 0.5 }, { f: f * 4, a: 0.1 * vel, tau: tau * 0.4 }], 0.003);
  mixAt(b, tick(1400, 0.7, 0.012, 0.45 * vel, Math.round(f) + 3, 0.06), 0);
  return b;
}

// sustained sine pad that tiles seamlessly: frequency nudged to a whole number of cycles per loop
function pad(L, freqs, amp, { tri = true, lfo = 0.12 } = {}) {
  const b = mk(L);
  freqs.forEach((f0, vi) => {
    const f = Math.round(f0 * L) / L;
    for (let h = 1; h <= (tri ? 3 : 1); h++) {
      const w = (TAU * f * h) / SR, a = amp / (h * h), k = Math.round(lfo * L) || 1;
      for (let i = 0; i < b.length; i++) b[i] += a * Math.sin(w * i + vi) * (0.8 + 0.2 * Math.sin((TAU * k * i) / b.length + vi * 2));
    }
  });
  return b;
}

// render a loop: events mixed with wrap-around, room reverb run over three tiled copies, middle copy kept
function loopRender(L, build, { wet = 0.12, size = 1, level = 0.85, drive = 1.0, seed = 5, lp = 3200 } = {}) {
  const ev = mk(L), r = rng(seed);
  const put = (t, buf, g = 1) => mixWrap(ev, buf, t + (r() - 0.5) * 0.004, g * (0.94 + 0.12 * r()));
  build(put, ev, r);
  const tile = new Float32Array(ev.length * 3);
  for (let k = 0; k < 3; k++) tile.set(ev, k * ev.length);
  // filter / master the tiled signal (so no filter starts from silence), then keep the middle copy
  const wetT = wet > 0 ? reverb(tile, wet, size) : tile;
  filt(wetT, new Biquad('lp', lp, 0.7));
  master(wetT, level, { fade: 0, fadeOut: 0, drive });
  return wetT.slice(ev.length, ev.length * 2);
}

const nf = n2f;
// strummed chord: notes slightly staggered
function chord(put, t, names, vel, mk1, strum = 0.011) {
  names.forEach((n, i) => put(t + i * strum, mk1(nf(n), vel * (i === 0 ? 1 : 0.85))));
}

const STEP = 60 / 90 / 4; // 16th note at 90 bpm
const EIGHTH = STEP * 2;
const BAR = STEP * 16;

function loop01() { // Question: B-D-F#-B arpeggio plucks, 16 sixteenths
  const seq = ['B3', 'D4', 'F#4', 'B4', 'B3', 'D4', 'F#4', 'B3', 'B3', 'D4', 'F#4', 'B4', 'B3', 'D4', 'F#4', 'B4'];
  const vel = [0.7, 0.7, 1.0, 0.95, 0.65, 0.8, 0.95, 0.4, 0.8, 0.9, 0.85, 1.0, 0.6, 0.65, 0.75, 0.5];
  return loopRender(BAR, (put) => seq.forEach((n, i) => put(0.14 + i * STEP, pluck(nf(n), { tau: 0.14, vel: vel[i], pos: 0.2 }))), { wet: 0.1, level: 0.85, seed: 1 });
}

function loop02() { // Into The Fog: drone B4/B5 + four soft bell pulses a second apart, first one biggest
  const L = 4.0;
  return loopRender(L, (put, ev) => {
    const p = pad(L, [nf('B4'), nf('B5'), nf('B3')], 0.05, { lfo: 0.25, tri: false });
    for (let i = 0; i < ev.length; i++) ev[i] += p[i];
    [1.0, 0.42, 0.28, 0.45].forEach((v, i) => {
      put(i, bell(nf('B4'), { vel: v, tau: i === 0 ? 0.55 : 0.5, attack: i === 0 ? 0.01 : 0.05 }));
      if (i === 0) put(0, tick(1800, 0.5, 0.05, 0.35, 12, 0.3));
    });
  }, { wet: 0.28, size: 1.5, level: 0.7, seed: 2 });
}

function loop03() { // Quiet Suspicion: soft strummed dyads/triads on eighths, drone underneath
  const L = BAR * 2;
  const ev = [[0, ['B3', 'F#4'], 1.0], [1, ['A4', 'B4'], 0.5], [2, ['F#4', 'A4', 'B4'], 0.5], [3, ['F#4', 'A4'], 0.8], [4, ['E4', 'F#4', 'A4'], 0.4],
    [5, ['F#4', 'A4'], 0.65], [6, ['D4', 'E4', 'F#4'], 0.35], [7, ['B3', 'D4', 'F#4'], 0.55], [8, ['B3', 'D4', 'A4'], 0.5], [9, ['B4'], 0.75],
    [11, ['F#4', 'A4'], 1.0], [12, ['E4', 'F#4', 'A4'], 0.65], [13, ['F#4', 'A4'], 0.55], [14, ['D4', 'E4', 'F#4'], 0.6], [15, ['B3', 'B4'], 0.85]];
  return loopRender(L, (put, e) => {
    const p = pad(L, [nf('F#4'), nf('A4'), nf('B4')], 0.03);
    for (let i = 0; i < e.length; i++) e[i] += p[i];
    ev.forEach(([s, ns, v]) => chord(put, s * EIGHTH + 0.003, ns, v, (f, vv) => pluck(f, { tau: 0.22, vel: vv * 0.9, tilt: 1.9, pos: 0.14 })));
  }, { wet: 0.2, size: 1.2, level: 0.75, seed: 3, lp: 2600 });
}

function loop04() { // Lost In Thought: bass notes with bell-like answers
  const L = BAR * 2;
  const ev = [[0.28, ['F#2', 'F#3'], 0.55], [0.6, ['D4', 'D5'], 1.0], [0.94, ['C#4', 'C#5'], 0.8], [1.28, ['B2', 'B3'], 0.6], [1.61, ['F#2', 'F#3', 'C#4'], 0.5],
    [1.94, ['B3', 'B4'], 0.7], [2.61, ['B2', 'B3'], 0.5], [2.94, ['F#2', 'F#3', 'C#4'], 0.5], [3.27, ['B3', 'B4'], 1.0], [3.94, ['B2', 'B3', 'F#3'], 0.5],
    [4.27, ['F#2', 'F#3', 'C#4'], 0.55], [4.61, ['B3', 'B4'], 1.0], [4.93, ['A3', 'A4', 'B3'], 0.8]];
  return loopRender(L, (put) => {
    ev.forEach(([t, ns, v]) => chord(put, t, ns, v, (f, vv) => pluck(f, { tau: f < 150 ? 0.28 : 0.3, vel: vv, tilt: f < 160 ? 0.7 : 1.5, pos: 0.15, damp: 0.8 }), 0.006));
  }, { wet: 0.2, size: 1.3, level: 0.8, seed: 4 });
}

function loop07() { // In Between: bright kalimba-like arpeggio over a B minor pad
  const L = BAR * 2;
  const ev = [[0.29, ['B5', 'B3'], 0.7], [0.63, ['B4', 'B5', 'B3'], 0.7], [0.96, ['F#4', 'B4', 'B5'], 0.6], [1.30, ['A5', 'D5', 'B4'], 0.85], [1.63, ['B4', 'D5', 'A5'], 0.7],
    [1.96, ['F#4', 'B4', 'D5', 'A5'], 0.65], [2.30, ['F#5', 'F#4'], 0.9], [2.62, ['B4', 'F#5'], 0.65], [2.79, ['F#5', 'B4'], 0.8], [2.96, ['D5', 'F#5', 'B4'], 0.85],
    [3.30, ['B4', 'D5', 'F#5'], 0.7], [3.63, ['B3', 'B4', 'D5', 'F#5'], 0.7], [3.96, ['E5', 'B3'], 1.0], [4.30, ['B4', 'E5', 'B3'], 0.65], [4.63, ['F#5', 'B4', 'E5'], 0.7], [4.96, ['B4', 'F#5'], 0.6]];
  return loopRender(L, (put, e) => {
    const p = pad(L, [nf('B4'), nf('D5'), nf('F#5'), nf('B3')], 0.11, { tri: false });
    for (let i = 0; i < e.length; i++) e[i] += p[i];
    ev.forEach(([t, ns, v]) => chord(put, t, ns, v, (f, vv) => pluck(f, { tau: 0.3, vel: vv * 0.45, tilt: 1.4, damp: 0.9, B: 0.0004, pos: 0.23 }), 0.008));
  }, { wet: 0.25, size: 1.4, level: 0.6, seed: 7, lp: 2400 });
}

function loop09() { // Keep Moving: detuned synth plucks, slightly uneasy cluster around B4/C5
  const ev = [[0.41, ['C5', 'E4', 'B4'], 1.0], [0.91, ['B4', 'D4'], 0.55], [1.24, ['B4', 'A#4'], 0.85], [1.40, ['B4', 'E4', 'C5'], 0.9], [1.92, ['B4', 'E4'], 0.5], [2.24, ['B4', 'E4'], 0.65], [2.40, ['B4', 'G4'], 0.65]];
  return loopRender(BAR, (put) => {
    ev.forEach(([t, ns, v]) => chord(put, t, ns, v, (f, vv) => synthPluck(f, { tau: 0.18, vel: vv * 0.8, det: [-34, -4, 22] }), 0.004));
    // quiet tick on the off-beats keeps the pulse going
    for (let i = 0; i < 8; i++) put(i * EIGHTH + 0.0, tick(3200, 0.7, 0.004, 0.012, 90 + i, 0.02));
  }, { wet: 0.1, level: 0.55, seed: 9, lp: 1700 });
}

function loop11() { // Reckoning: dense dark drone, driving stabs, accents on every beat
  const stabs = [0.07, 0.23, 0.39, 0.71, 0.91, 1.07, 1.39, 1.56, 1.72, 2.07, 2.23];
  const chords = ['F#2', 'F#2', 'D#3', 'F#2', 'F#2', 'B2', 'F#2', 'F#2', 'E3', 'F#2', 'B2'];
  return loopRender(BAR, (put, ev) => {
    // drone: stacked detuned low voices with a soft (1/k^1.5, rounder than a saw) spectrum, so it growls without any buzz
    const d = mk(BAR), r = rng(55);
    [['B2', -9], ['B2', 8], ['F#3', -6], ['F#3', 7], ['B3', -5], ['D4', 5]].forEach(([n, c]) => {
      const f = Math.round(nf(n) * Math.pow(2, c / 1200) * BAR) / BAR;
      for (let k = 1; k <= 10; k++) { const w = (TAU * f * k) / SR; for (let i = 0; i < d.length; i++) d[i] += (0.05 / Math.pow(k, 1.5)) * Math.sin(w * i + k); }
    });
    { // filter three tiled copies and keep the middle one, so the filter state is steady at the loop seam
      const T = new Float32Array(d.length * 3); for (let k = 0; k < 3; k++) T.set(d, k * d.length);
      filt(T, new Biquad('lp', 1500, 0.8), new Biquad('hp', 140, 0.7)); d.set(T.subarray(d.length, 2 * d.length)); }
    const nz = noise(BAR, 56);
    filt(nz, new Biquad('bp', 1100, 0.5));
    for (let i = 0; i < d.length; i++) ev[i] += d[i] + nz[i] * 0.11;
    const O = 0.17; // phase of the groove inside the clip (matched against the reference envelope)
    stabs.forEach((t0, i) => {
      const t = t0 + O;
      put(t, pluck(nf(chords[i]), { tau: 0.16, vel: 1.1, tilt: 1.0, damp: 0.7, n: 8 }));
      put(t, tick(1800, 0.5, 0.02, 0.45, 70 + i, 0.08));
    });
    [-0.08, 0.587, 1.253, 1.92].forEach((t0, i) => { const t = t0 + O; put(t, thump(nf('F#2'), { vel: 0.5, tau: 0.16 })); put(t, tick(900, 0.5, 0.05, 0.5, 80 + i, 0.2)); });
  }, { wet: 0.12, size: 1.0, level: 0.9, drive: 1.2, seed: 11 });
}

function loop12() { // Second Guess: nervous 16th-note pluck line wandering between B2 and B4
  const seq = ['F#4', 'F#4', 'D4', 'B2', 'B3', 'F#3', 'C#4', 'B3', 'B4', 'F#4', 'D4', 'B2', 'B3', 'F#3', 'F#3', 'D3'];
  const vel = [0.7, 1.0, 0.65, 0.95, 0.45, 0.65, 0.45, 0.65, 0.4, 0.95, 0.65, 1.0, 0.7, 1.0, 0.95, 0.7];
  return loopRender(BAR, (put) => seq.forEach((n, i) => put(0.13 + i * STEP, pluck(nf(n), { tau: 0.11, vel: vel[i], tilt: nf(n) < 160 ? 0.7 : 1.5, pos: 0.16 }))), { wet: 0.12, level: 0.8, seed: 12 });
}

function loop17() { // Forward Motion: sparse ticks, three low thumps, F# pings every 1.33 s
  const L = BAR * 2;
  return loopRender(L, (put) => {
    const ticks = [[0.33, 'C4', 0.2], [0.48, 'A#3', 0.15], [0.65, 'D#3', 0.18], [0.82, 'B2', 0.3], [1.66, 'F#3', 0.15], [1.81, 'B2', 0.12], [1.99, 'E3', 0.15], [2.16, 'G#3', 0.15],
      [2.98, 'F#3', 0.2], [3.15, 'A#3', 0.15], [3.32, 'F#3', 0.15], [3.49, 'G#4', 0.15], [4.32, 'B3', 0.2], [4.48, 'A#3', 0.12], [4.66, 'A3', 0.15]];
    ticks.forEach(([t, n, v]) => put(t, pluck(nf(n), { tau: 0.1, vel: v * 1.4, tilt: 1.3, pos: 0.2 })));
    [[1.15, 'E2', 1.0], [1.5, 'G2', 0.85], [1.85, 'A#2', 1.0]].forEach(([t, n, v]) => { put(t, thump(nf(n) * 1.0, { vel: v, tau: 0.15 })); put(t, pluck(nf('A#3'), { tau: 0.2, vel: v * 0.5, tilt: 0.8 })); });
    // pings: inharmonic bell, 1.33 s apart
    [[1.15, 1434], [2.48, 1434], [3.82, 1479]].forEach(([t, f]) => put(t, additive(0.9, [{ f, a: 0.25, tau: 0.1 }, { f: f * 2.4, a: 0.05, tau: 0.05 }], 0.001)));
    put(2.48, pluck(nf('A#3'), { tau: 0.2, vel: 0.5 })); put(3.82, pluck(nf('A#3'), { tau: 0.2, vel: 0.5 }));
    put(5.15, thump(nf('B2'), { vel: 0.9, tau: 0.2 })); put(5.15, pluck(nf('B3'), { tau: 0.3, vel: 0.9 }));
  }, { wet: 0.25, size: 1.4, level: 0.55, seed: 17 });
}

function loop22() { // Pizzicato Clock: dry pizzicato plucks, two phrases separated by silence
  const L = BAR * 2;
  const ev = [[0.0, ['F#4'], 0.7], [0.4, ['F#4', 'F#5'], 1.0], [2.0, ['E4', 'E5'], 0.55], [2.35, ['B2', 'B3', 'F#4'], 1.0], [2.7, ['D4', 'B3'], 0.55], [3.0, ['E4', 'E5'], 0.6],
    [4.35, ['F#3', 'F#4'], 0.65], [4.7, ['F#4'], 1.0]];
  return loopRender(L, (put) => ev.forEach(([t, ns, v]) => chord(put, t, ns, v, (f, vv) => pluck(f, { tau: 0.2, vel: vv, tilt: 1.35, damp: 0.9, n: 10, pos: 0.12 }), 0.007)), { wet: 0.16, size: 1.2, level: 0.7, seed: 22 });
}

// ref = clip position in the video-2 audio track; len = loop length in seconds
const LOOPS = [
  { id: 'l01', num: '01', name: 'Question', ref: [0.0, 2.8], len: BAR, render: loop01 },
  { id: 'l02', num: '02', name: 'Into The Fog', ref: [2.8, 6.8], len: 4.0, render: loop02 },
  { id: 'l03', num: '03', name: 'Quiet Suspicion', ref: [6.8, 12.2], len: BAR * 2, render: loop03 },
  { id: 'l04', num: '04', name: 'Lost In Thought', ref: [12.2, 17.5], len: BAR * 2, render: loop04 },
  { id: 'l07', num: '07', name: 'In Between', ref: [17.5, 22.9], len: BAR * 2, render: loop07 },
  { id: 'l09', num: '09', name: 'Keep Moving', ref: [22.9, 25.6], len: BAR, render: loop09 },
  { id: 'l11', num: '11', name: 'Reckoning', ref: [25.6, 28.2], len: BAR, render: loop11 },
  { id: 'l12', num: '12', name: 'Second Guess', ref: [28.2, 31.0], len: BAR, render: loop12 },
  { id: 'l17', num: '17', name: 'Forward Motion', ref: [31.0, 36.5], len: BAR * 2, render: loop17 },
  { id: 'l22', num: '22', name: 'Pizzicato Clock', ref: [36.5, 41.6], len: BAR * 2, render: loop22 },
];

if (typeof module !== 'undefined') module.exports = { SR, SFX, LOOPS, peakOf };
