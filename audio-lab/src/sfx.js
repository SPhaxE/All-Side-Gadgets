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
  const period = 0.06674, on = 0.016, pulses = 36;
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
  const hits = [[0.028, 0.073, 5500], [0.066, 0.061, 5500], [0.1, 0.076, 5500], [0.138, 0.081, 5500], [0.196, 0.063, 5500],
    [0.25, 0.114, 5500], [0.308, 0.079, 5500], [0.33, 0.053, 2900], [0.398, 0.134, 5500], [0.478, 0.074, 5500], [0.514, 0.05, 2900]];
  hits.forEach(([t, a, f], i) => {
    const g = a / 0.134;
    mixAt(b, tick(f * 0.55, 0.35, 0.008, 1.5 * g, 61 + i, 0.05), t);
    mixAt(b, additive(0.05, [{ f, a: 0.5 * g, tau: 0.009 }, { f: f * 0.5, a: 0.08 * g, tau: 0.007 }], 0.0005), t);
  });
  // quiet data hiss trailing off (this is where the riser takes over)
  const h = noise(0.1, 69);
  filt(h, new Biquad('bp', 4000, 0.5));
  shape(h, (t) => 0.03 * Math.min(1, t / 0.01));
  mixAt(b, h, 0.55);
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
    mixAt(b, tick(2400, 0.45, 0.005, 1.0, 81 + k, 0.03), t);
    mixAt(b, tick(1800, 0.5, 0.004, 0.4, 111 + k, 0.03), t + 0.008);
    mixAt(b, tick(2000, 0.5, 0.004, 0.55, 141 + k, 0.03), t + 0.018);
    mixAt(b, tick(2200, 0.5, 0.004, 0.5, 171 + k, 0.03), t + 0.057);
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
  // pre-focus ticks (faint)
  mixAt(b, tick(1100, 1.2, 0.006, 0.12, 101, 0.04), 0.035);
  mixAt(b, tick(1500, 1.2, 0.008, 0.1, 102, 0.05), 0.085);
  // two autofocus-beep clacks: a 4 kHz tone with a noise knock on top, 45 ms each (16.56 and 16.63 s in the original)
  [[0.132, 0.05, 1.0, 103], [0.213, 0.048, 0.9, 104]].forEach(([t, d, g, seed]) => {
    const n = Math.round(d * SR), burst = mk(d);
    for (let i = 0; i < n; i++) {
      const tt = i / SR, e = Math.min(1, tt / 0.003) * Math.min(1, (d - tt) / 0.004);
      burst[i] = (0.5 * Math.sin(TAU * 4000 * tt) + 0.04 * Math.sin(TAU * 8000 * tt)) * e;
    }
    mixAt(b, burst, t, g);
    mixAt(b, tick(2400, 0.5, 0.012, 0.55 * g, seed, 0.06), t);
  });
  // shutter closing: broadband bursts (16.79, 16.83, 16.85, 16.91 s)
  mixAt(b, tick(3200, 0.45, 0.014, 1.0, 105, 0.08), 0.384);
  mixAt(b, tick(2400, 0.45, 0.011, 0.6, 106, 0.08), 0.422);
  mixAt(b, tick(2000, 0.45, 0.01, 0.26, 107, 0.08), 0.448);
  mixAt(b, tick(1500, 0.6, 0.008, 0.16, 108, 0.06), 0.506);
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

// per-sound time offset (s) of the whole render against the video clip, fitted by tools/tune_sfx.js
const SFX_LAG = {"eightbit":-0.002,"oldflash":0.006,"cinwoosh":0,"nightvision":-0.008,"nextel":0,"digitaltext":-0.008,"riser":0,"counter":-0.004,"bicycle":-0.006,"camera":-0.006,"shine":0,"woosh":-0.012};
function shiftBuf(x, sec) {
  const n = Math.round(sec * SR), y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { const j = i - n; if (j >= 0 && j < x.length) y[i] = x[j]; }
  return y;
}
// every sound is matched to the outline of its clip in the video
SFX.forEach((s) => {
  const raw = s.render;
  s.render = () => {
    let x = raw(); const pk = peakOf(x);
    if (SFX_LAG[s.id]) x = shiftBuf(x, SFX_LAG[s.id]);
    return REF_EDGE[s.id] ? finish(followEdge(x, REF_EDGE[s.id], s.ref[1] - s.ref[0]), pk) : x;
  };
});
