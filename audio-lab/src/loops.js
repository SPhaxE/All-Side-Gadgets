// Video 2 — "Musical story loops": 10 loops in B minor, built from additive plucks, pads and filtered noise.
// Note lists / rhythms were transcribed from the reference audio (see tools/transcribe_loops.py).

// per-loop fit knobs (time shift of every event, decay scale, pad level, reverb level), chosen by tools/tune_loops.js
// against the reference clip's envelope; LT holds the active set while one loop is being built
const LOOP_TUNE = {"l01":{"shift":-0.13,"tau":1,"pad":1,"wet":1},"l02":{"shift":0.003,"tau":1,"pad":1,"wet":1},"l03":{"shift":-0.037,"tau":1,"pad":1,"wet":1},"l04":{"shift":-0.23,"tau":1,"pad":1,"wet":1},"l07":{"shift":0.057,"tau":1,"pad":1,"wet":1},"l09":{"shift":-0.04,"tau":1,"pad":1,"wet":1},"l11":{"shift":0.137,"tau":1,"pad":1,"wet":1},"l12":{"shift":-0.13,"tau":1,"pad":1,"wet":1},"l17":{"shift":0,"tau":1,"pad":1,"wet":1},"l22":{"shift":0.11,"tau":1,"pad":1,"wet":1}};
let LT = { shift: 0, tau: 1, pad: 1, wet: 1 };

// plucked string / mallet voice: inharmonic-stretched partials, pick-position comb, brighter partials die first
function pluck(f, o = {}) {
  const tau = (o.tau ?? 0.2) * LT.tau, nP = o.n ?? 8, vel = o.vel ?? 1, tilt = o.tilt ?? (f < 160 ? 0.8 : 1.7);
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
  const out = mk(Math.min((o.tau ?? 0.22) * LT.tau * 7, 2));
  dets.forEach((c, i) => mixAt(out, pluck(f * Math.pow(2, c / 1200), { ...o, tau: (o.tau ?? 0.22), saw: true, tilt: 1.35, damp: 0.7, n: 10, pick: 0, maxLen: 2 }), 0, 1 / dets.length));
  return out;
}

// soft bell / mallet: near-harmonic partials with slow bloom
function bell(f, o = {}) {
  const tau = (o.tau ?? 0.6) * LT.tau, vel = o.vel ?? 1;
  return additive(tau * 6, [
    { f, a: 0.8 * vel, tau }, { f: f * 2.0, a: 0.28 * vel, tau: tau * 0.6 }, { f: f * 3.01, a: 0.1 * vel, tau: tau * 0.35 },
    { f: f * 0.5, a: 0.3 * vel, tau: tau * 1.1 },
  ], o.attack ?? 0.03);
}

// low impact: a sine (never a buzzing saw) + harmonics that carry on small speakers + a short noise knock
function thump(f, o = {}) {
  const tau = (o.tau ?? 0.16) * LT.tau, vel = o.vel ?? 1;
  const b = additive(tau * 7, [{ f, a: 0.8 * vel, tau }, { f: f * 2, a: 0.4 * vel, tau: tau * 0.7 }, { f: f * 3, a: 0.2 * vel, tau: tau * 0.5 }, { f: f * 4, a: 0.1 * vel, tau: tau * 0.4 }], 0.003);
  mixAt(b, tick(1400, 0.7, 0.012, 0.45 * vel, Math.round(f) + 3, 0.06), 0);
  return b;
}

// sustained sine pad that tiles seamlessly: frequency nudged to a whole number of cycles per loop
function pad(L, freqs, amp, { tri = true, lfo = 0.12 } = {}) {
  const b = mk(L); amp *= LT.pad;
  freqs.forEach((f0, vi) => {
    const f = Math.round(f0 * L) / L;
    for (let h = 1; h <= (tri ? 3 : 1); h++) {
      const w = (TAU * f * h) / SR, a = amp / (h * h), k = Math.round(lfo * L) || 1;
      for (let i = 0; i < b.length; i++) b[i] += a * Math.sin(w * i + vi) * (0.8 + 0.2 * Math.sin((TAU * k * i) / b.length + vi * 2));
    }
  });
  return b;
}

// render a loop as the clip appears in the video: starts from silence, ends where the clip ends (tails are cut by a 4 ms fade)
function loopRender(L, build, { wet = 0.12, size = 1, level = 0.85, drive = 1.0, seed = 5, lp = 3200 } = {}) {
  LT = { shift: 0, tau: 1, pad: 1, wet: 1, ...(LOOP_TUNE['l' + String(seed).padStart(2, '0')] || {}) };
  const ev = mk(L), r = rng(seed);
  const put = (t, buf, g = 1) => mixAt(ev, buf, Math.max(0, t + LT.shift + (r() - 0.5) * 0.004), g * (0.94 + 0.12 * r()));
  build(put, ev, r);
  const out = wet > 0 ? reverb(ev, wet * LT.wet, size) : ev;
  LT = { shift: 0, tau: 1, pad: 1, wet: 1 };
  filt(out, new Biquad('lp', lp, 0.7));
  const id = 'l' + String(seed).padStart(2, '0');
  if (REF_ENV[id]) followEnv(out, REF_ENV[id], L); // match the loudness contour of the clip in the video
  return master(out, level, { fade: 0.003, fadeOut: 0.004, drive });
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
  const L = BAR;
  const seq = ['B3', 'D4', 'F#4', 'B4', 'B3', 'D4', 'F#4', 'B3', 'B3', 'D4', 'F#4', 'B4', 'B3', 'D4', 'F#4', 'B4'];
  const vel = [0.7, 0.7, 1.0, 0.95, 0.65, 0.8, 0.95, 0.4, 0.8, 0.9, 0.85, 1.0, 0.6, 0.65, 0.75, 0.5];
  return loopRender(L, (put) => seq.forEach((n, i) => put(0.14 + i * STEP, pluck(nf(n), { tau: 0.14, vel: vel[i], pos: 0.2 }))), { wet: 0.1, level: 0.85, seed: 1 });
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
  const L = BAR;
  const ev = [[0.05, ['C5', 'E4', 'B4'], 1.0], [0.23, ['B4', 'E4'], 0.35], [0.6, ['B4', 'D4'], 0.5], [0.87, ['B4'], 0.3], [1.15, ['B4', 'A#4'], 0.55],
    [1.37, ['B4', 'E4', 'C5'], 0.8], [1.52, ['B4', 'E4', 'C5'], 0.9], [2.05, ['B4', 'E4'], 0.5], [2.4, ['B4', 'E4'], 0.55], [2.52, ['B4', 'G4'], 0.6]];
  return loopRender(L, (put) => {
    ev.forEach(([t, ns, v]) => chord(put, t, ns, v, (f, vv) => synthPluck(f, { tau: 0.18, vel: vv * 0.8, det: [-34, -4, 22] }), 0.004));
  }, { wet: 0.1, level: 0.55, seed: 9, lp: 1700 });
}

function loop11() { // Reckoning: dense dark drone, driving stabs, accents on every beat
  const L = BAR;
  const stabs = [0.07, 0.23, 0.39, 0.71, 0.91, 1.07, 1.39, 1.56, 1.72, 2.07, 2.23];
  const chords = ['F#2', 'F#2', 'D#3', 'F#2', 'F#2', 'B2', 'F#2', 'F#2', 'E3', 'F#2', 'B2'];
  return loopRender(L, (put, ev) => {
    // drone: stacked detuned low voices with a soft (1/k^1.5, rounder than a saw) spectrum, so it growls without any buzz
    const d = mk(L), r = rng(55);
    [['B2', -9], ['B2', 8], ['F#3', -6], ['F#3', 7], ['B3', -5], ['D4', 5]].forEach(([n, c]) => {
      const f = Math.round(nf(n) * Math.pow(2, c / 1200) * L) / L;
      for (let k = 1; k <= 10; k++) { const w = (TAU * f * k) / SR; for (let i = 0; i < d.length; i++) d[i] += (0.05 / Math.pow(k, 1.5)) * Math.sin(w * i + k); }
    });
    { // filter three tiled copies and keep the middle one, so the filter state is steady at the loop seam
      const T = new Float32Array(d.length * 3); for (let k = 0; k < 3; k++) T.set(d, k * d.length);
      filt(T, new Biquad('lp', 1500, 0.8), new Biquad('hp', 140, 0.7)); d.set(T.subarray(d.length, 2 * d.length)); }
    const nz = noise(L, 56);
    filt(nz, new Biquad('bp', 1100, 0.5));
    for (let i = 0; i < d.length; i++) ev[i] += d[i] + nz[i] * 0.11;
    const O = 0.0; // phase of the groove inside the clip (matched against the reference envelope)
    stabs.forEach((t0, i) => {
      const t = t0 + O;
      put(t, pluck(nf(chords[i]), { tau: 0.16, vel: 1.1, tilt: 1.0, damp: 0.7, n: 8 }));
      put(t, tick(1800, 0.5, 0.02, 0.45, 70 + i, 0.08));
    });
    [-0.08, 0.587, 1.253, 1.92].forEach((t0, i) => { const t = t0 + O; put(t, thump(nf('F#2'), { vel: 0.5, tau: 0.16 })); put(t, tick(900, 0.5, 0.05, 0.5, 80 + i, 0.2)); });
  }, { wet: 0.12, size: 1.0, level: 0.9, drive: 1.2, seed: 11 });
}

function loop12() { // Second Guess: nervous 16th-note pluck line wandering between B2 and B4
  const L = BAR;
  const seq = ['F#4', 'F#4', 'D4', 'B2', 'B3', 'F#3', 'C#4', 'B3', 'B4', 'F#4', 'D4', 'B2', 'B3', 'F#3', 'F#3', 'D3'];
  const vel = [0.7, 1.0, 0.65, 0.95, 0.45, 0.65, 0.45, 0.65, 0.4, 0.95, 0.65, 1.0, 0.7, 1.0, 0.95, 0.7];
  return loopRender(L, (put) => seq.forEach((n, i) => put(0.13 + i * STEP, pluck(nf(n), { tau: 0.11, vel: vel[i], tilt: nf(n) < 160 ? 0.7 : 1.5, pos: 0.16 }))), { wet: 0.12, level: 0.8, seed: 12 });
}

function loop17() { // Forward Motion: sparse ticks, three low thumps, F# pings every 1.33 s
  const L = BAR * 2;
  return loopRender(L, (put) => {
    const ticks = [[0.53, 'C4', 0.2], [0.68, 'A#3', 0.15], [0.85, 'D#3', 0.18], [1.02, 'B2', 0.3], [1.86, 'F#3', 0.15], [2.01, 'B2', 0.12], [2.19, 'E3', 0.15], [2.36, 'G#3', 0.15],
      [3.18, 'F#3', 0.2], [3.35, 'A#3', 0.15], [3.52, 'F#3', 0.15], [3.69, 'G#4', 0.15], [4.52, 'B3', 0.2], [4.68, 'A#3', 0.12], [4.86, 'A3', 0.15]];
    ticks.forEach(([t, n, v]) => put(t, pluck(nf(n), { tau: 0.1, vel: v * 1.4, tilt: 1.3, pos: 0.2 })));
    [[1.35, 'E2', 1.0], [1.7, 'E2', 0.85], [2.05, 'E2', 1.0]].forEach(([t, n, v]) => { put(t, thump(nf(n) * 1.0, { vel: v, tau: 0.15 })); put(t, pluck(nf('A#3'), { tau: 0.2, vel: v * 0.5, tilt: 0.8 })); });
    // pings: inharmonic bell, 1.33 s apart
    [[1.35, 1434], [2.68, 1434], [4.02, 1479]].forEach(([t, f]) => put(t, additive(0.9, [{ f, a: 0.25, tau: 0.1 }, { f: f * 2.4, a: 0.05, tau: 0.05 }], 0.001)));
    put(2.68, pluck(nf('A#3'), { tau: 0.2, vel: 0.5 })); put(4.02, pluck(nf('A#3'), { tau: 0.2, vel: 0.5 }));
    put(0.03, thump(nf('B2'), { vel: 0.9, tau: 0.2 })); put(0.03, pluck(nf('B3'), { tau: 0.3, vel: 0.9 }));
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
  { id: 'l01', num: '01', name: 'Question', ref: [0.13, 2.797], len: BAR, render: loop01 },
  { id: 'l02', num: '02', name: 'Into The Fog', ref: [2.797, 6.797], len: 4.0, render: loop02 },
  { id: 'l03', num: '03', name: 'Quiet Suspicion', ref: [6.797, 12.13], len: BAR * 2, render: loop03 },
  { id: 'l04', num: '04', name: 'Lost In Thought', ref: [12.13, 17.463], len: BAR * 2, render: loop04 },
  { id: 'l07', num: '07', name: 'In Between', ref: [17.463, 22.797], len: BAR * 2, render: loop07 },
  { id: 'l09', num: '09', name: 'Keep Moving', ref: [22.797, 25.463], len: BAR, render: loop09 },
  { id: 'l11', num: '11', name: 'Reckoning', ref: [25.463, 28.13], len: BAR, render: loop11 },
  { id: 'l12', num: '12', name: 'Second Guess', ref: [28.13, 30.797], len: BAR, render: loop12 },
  { id: 'l17', num: '17', name: 'Forward Motion', ref: [30.797, 36.13], len: BAR * 2, render: loop17 },
  { id: 'l22', num: '22', name: 'Pizzicato Clock', ref: [36.13, 41.463], len: BAR * 2, render: loop22 },
];
