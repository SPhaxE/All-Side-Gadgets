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

// ---- envelope similarity against the reference clip (same function feeds the page and the Node score tool)
// RMS in 5 ms hops over the reference clip's duration (ours trimmed / zero-padded), averaged into 160 bins, normalised to peak
function envSig(x, secs) {
  if (secs) { const n = Math.round(secs * SR), y = new Float32Array(n); y.set(x.subarray(0, Math.min(n, x.length))); x = y; }
  const h = Math.round(SR * 0.005), n = Math.floor(x.length / h), e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < h; j++) s += x[i * h + j] ** 2; e[i] = Math.sqrt(s / h); }
  const out = new Float32Array(160);
  for (let i = 0; i < 160; i++) { const a = Math.floor((i * n) / 160), b = Math.max(a + 1, Math.floor(((i + 1) * n) / 160)); let s = 0; for (let k = a; k < b; k++) s += e[k]; out[i] = s / (b - a); }
  const m = Math.max(...out) || 1;
  return out.map((v) => v / m);
}
function envSmooth(a, w) {
  const o = new Float32Array(a.length), r = Math.floor(w / 2);
  for (let i = 0; i < a.length; i++) { let s = 0, n = 0; for (let j = i - r; j <= i + r; j++) if (j >= 0 && j < a.length) { s += a[j]; n++; } o[i] = s / n; }
  return o;
}
function envCorr(a0, b0, w) {
  const a = envSmooth(a0, w), b = envSmooth(b0, w);
  let best = -1;
  for (let lag = -3; lag <= 3; lag++) {
    let sa = 0, sb = 0, n = 0;
    for (let i = 0; i < 160; i++) { const j = i + lag; if (j < 0 || j >= 160) continue; sa += a[i]; sb += b[j]; n++; }
    const ma = sa / n, mb = sb / n; let c = 0, va = 0, vb = 0;
    for (let i = 0; i < 160; i++) { const j = i + lag; if (j < 0 || j >= 160) continue; c += (a[i] - ma) * (b[j] - mb); va += (a[i] - ma) ** 2; vb += (b[j] - mb) ** 2; }
    best = Math.max(best, c / Math.sqrt(va * vb || 1));
  }
  return best;
}
const envScore = (x, id, ref, kind) => envCorr(envSig(x, ref[1] - ref[0]), REF_ENV[id], kind === 'loops' ? 7 : 3);

// Dynamics matching: nudge a clip's loudness contour (160 bins, the same bins the similarity score uses) toward the reference
// clip's contour, so the waveform shape in the video is reproduced. Timbre and note content stay ours; the gain is limited.
function followEnv(x, ref, secs, { iters = 2, lo = 0.06, hi = 8 } = {}) {
  const n = Math.round(secs * SR);
  for (let it = 0; it < iters; it++) {
    const e = envSig(x.length === n ? x : x.subarray(0, n), secs);
    const g = new Float32Array(160);
    for (let i = 0; i < 160; i++) g[i] = clamp(Math.pow((ref[i] + 0.03) / (e[i] + 0.03), 0.65), lo, hi);
    const gs = envSmooth(g, 3);
    for (let i = 0; i < x.length; i++) {
      const p = (i / SR / secs) * 160 - 0.5, k = Math.floor(p), f = p - k;
      const a = gs[clamp(k, 0, 159)], b = gs[clamp(k + 1, 0, 159)];
      x[i] *= a + (b - a) * f;
    }
  }
  return x;
}
