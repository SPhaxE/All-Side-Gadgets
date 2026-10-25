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

// ---- the 12 numbers the video skips (05 06 08 10 13 14 15 16 18 19 20 21): same family, same key and tempo,
// written to continue the story arc between their neighbours. Their names are not in the video.

// pad whose level swells and fades as a circular raised-cosine window (so it still tiles seamlessly)
function padSwell(L, names, centre, width, amp, opts = {}) {
  const p = pad(L, names.map(nf), amp, opts);
  for (let i = 0; i < p.length; i++) {
    let d = Math.abs(i / SR - centre); d = Math.min(d, L - d);
    p[i] *= d < width / 2 ? 0.5 * (1 + Math.cos((2 * Math.PI * d) / width)) : 0;
  }
  return p;
}
const addTo = (ev, p) => { for (let i = 0; i < ev.length; i++) ev[i] += p[i]; };

function loop05() { // Doubt Creeps In: slow descending mallet line
  const L = BAR * 2, seq = ['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'F#4', 'E4'], v = [0.6, 0.7, 0.8, 0.7, 0.9, 0.7, 0.6, 0.5];
  return loopRender(L, (put, e) => {
    addTo(e, pad(L, ['B3', 'F#4'].map(nf), 0.04, { tri: false }));
    seq.forEach((n, i) => put(0.05 + i * (L / 8), pluck(nf(n), { tau: 0.45, vel: v[i], tilt: 1.5, damp: 0.9, pos: 0.2 })));
  }, { wet: 0.3, size: 1.5, level: 0.65, seed: 105, lp: 2600 });
}
function loop06() { // Hollow Room: wide pad, two far-away bell strikes
  const L = BAR * 2;
  return loopRender(L, (put, e) => {
    addTo(e, padSwell(L, ['B3', 'D4', 'F#4'], L * 0.5, L, 0.08, { tri: false }));
    put(0.2, bell(nf('B4'), { vel: 0.8, tau: 0.9 }));
    put(2.9, bell(nf('E5'), { vel: 0.55, tau: 0.9 }));
  }, { wet: 0.45, size: 1.9, level: 0.55, seed: 106, lp: 2200 });
}
function loop08() { // Searching: restless eighth-note ostinato
  const seq = ['B4', 'D5', 'F#5', 'D5', 'B4', 'D5', 'A5', 'F#5'], v = [1, 0.6, 0.8, 0.55, 0.9, 0.6, 0.8, 0.6];
  return loopRender(BAR, (put) => seq.forEach((n, i) => put(0.02 + i * EIGHTH, pluck(nf(n), { tau: 0.14, vel: v[i], tilt: 1.5, pos: 0.18 }))), { wet: 0.14, level: 0.75, seed: 108, lp: 2800 });
}
function loop10() { // Closing In: pulse that builds beat by beat
  return loopRender(BAR, (put) => {
    for (let i = 0; i < 8; i++) put(i * EIGHTH, synthPluck(nf('E4'), { tau: 0.12, vel: 0.35 + 0.08 * i, det: [-18, 0, 16] }));
    for (let i = 0; i < 16; i++) put(i * STEP, tick(4200, 0.8, 0.003, 0.03 + 0.012 * i, 130 + i, 0.02));
    [0, 1, 2, 3].forEach((i) => put(i * 0.667, thump(nf('B2'), { vel: 0.4 + 0.18 * i, tau: 0.15 })));
  }, { wet: 0.12, level: 0.8, seed: 110, lp: 2200 });
}
function loop13() { // Cold Trail: sparse high bells, thin air
  const L = BAR * 2;
  return loopRender(L, (put, e) => {
    addTo(e, pad(L, ['B4', 'F#4'].map(nf), 0.035, { tri: false }));
    [[0.0, 'F#5', 0.7], [1.0, 'B5', 0.5], [2.1, 'D6', 0.4], [3.3, 'F#5', 0.6], [4.4, 'A5', 0.45]].forEach(([t, n, v]) => put(t, bell(nf(n), { vel: v, tau: 0.45, attack: 0.004 })));
  }, { wet: 0.4, size: 1.7, level: 0.55, seed: 113, lp: 3600 });
}
function loop14() { // Held Breath: swelling chord and a slow heartbeat
  const L = BAR * 2;
  return loopRender(L, (put, e) => {
    addTo(e, padSwell(L, ['B3', 'D4', 'F#4', 'C#5'], L * 0.5, L * 0.95, 0.09, { tri: false }));
    [0.4, 1.73, 3.07, 4.4].forEach((t, i) => { put(t, thump(nf('F#2'), { vel: 0.5, tau: 0.13 })); put(t + 0.24, thump(nf('F#2'), { vel: 0.28, tau: 0.1 })); });
  }, { wet: 0.3, size: 1.5, level: 0.6, seed: 114, lp: 2000 });
}
function loop15() { // Small Hours: lullaby music-box melody
  const L = BAR * 2, mel = [['F#4', 0], ['A4', 1], ['B4', 2], ['A4', 3], ['F#4', 4], ['E4', 5], ['D4', 6], ['E4', 7]];
  return loopRender(L, (put) => mel.forEach(([n, i]) => put(i * (L / 8) + 0.05, pluck(nf(n), { tau: 0.55, vel: 0.8, tilt: 1.4, damp: 1.2, pos: 0.25 }))), { wet: 0.3, size: 1.4, level: 0.6, seed: 115, lp: 2600 });
}
function loop16() { // Turning Point: arpeggio climbs, noise swell, one hit on the downbeat
  return loopRender(BAR, (put) => {
    const arp = ['B3', 'D4', 'F#4', 'B4', 'D5', 'F#5', 'B5', 'D6'];
    arp.forEach((n, i) => put(0.05 + i * EIGHTH, pluck(nf(n), { tau: 0.2, vel: 0.5 + 0.07 * i, tilt: 1.4, pos: 0.2 })));
    put(0.0, sweepNoise(BAR - 0.1, (t) => 600 * Math.pow(6, t / 2.4), 1.0, (t) => 0.1 * Math.pow(t / 2.4, 2), 117));
    put(0.0, thump(nf('B2'), { vel: 0.9, tau: 0.2 }));
  }, { wet: 0.2, level: 0.8, seed: 116, lp: 3200 });
}
function loop18() { // Distant Signal: a ping and its fading echoes
  const L = BAR * 2;
  return loopRender(L, (put, e) => {
    addTo(e, pad(L, ['B3', 'F#4'].map(nf), 0.03, { tri: false }));
    [[0.05, 1.0], [1.38, 0.45], [2.72, 0.2], [4.05, 0.1]].forEach(([t, v]) => put(t, additive(1.2, [{ f: nf('A5'), a: 0.4 * v, tau: 0.25 }, { f: nf('A5') * 2.4, a: 0.05 * v, tau: 0.1 }], 0.001)));
  }, { wet: 0.45, size: 1.8, level: 0.55, seed: 118, lp: 3400 });
}
function loop19() { // Slow Reveal: four chords rise out of the pad one after another
  const L = BAR * 2, chords = [['B3', 'D4', 'F#4'], ['G3', 'B3', 'D4'], ['D4', 'F#4', 'A4'], ['A3', 'C#4', 'E4']];
  return loopRender(L, (put, e) => chords.forEach((c, i) => addTo(e, padSwell(L, c, (i + 0.5) * (L / 4), L / 2.2, 0.1, { tri: true }))), { wet: 0.3, size: 1.4, level: 0.6, seed: 119, lp: 2200 });
}
function loop20() { // Hanging Tension: a minor second grinding in the pad, two dry plucks
  const L = BAR * 2;
  return loopRender(L, (put, e) => {
    addTo(e, pad(L, ['B3', 'C4', 'F#4', 'G4'].map(nf), 0.05, { tri: false, lfo: 0.5 }));
    put(0.0, pluck(nf('B2'), { tau: 0.4, vel: 0.9, tilt: 0.8 })); put(2.67, pluck(nf('F#3'), { tau: 0.4, vel: 0.8, tilt: 1.0 }));
  }, { wet: 0.25, size: 1.5, level: 0.6, seed: 120, lp: 2000 });
}
function loop21() { // Last Clue: quick pizzicato phrase that lands on a bell B
  const ph = [['D5', 0], ['C#5', 1], ['B4', 2], ['A4', 3], ['F#4', 4], ['A4', 5], ['B4', 6]];
  return loopRender(BAR, (put) => {
    ph.forEach(([n, i]) => put(0.05 + i * EIGHTH * 0.75, pluck(nf(n), { tau: 0.16, vel: 0.8, tilt: 1.5, pos: 0.14, damp: 1.0 })));
    put(0.05 + 7 * EIGHTH * 0.75 + 0.1, bell(nf('B4'), { vel: 0.9, tau: 0.7 }));
  }, { wet: 0.2, level: 0.75, seed: 121, lp: 2800 });
}

// ref = clip position in the video-2 audio track; len = loop length in seconds
const LOOPS_VIDEO = [
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

const LOOPS_FILLED = [
  { id: 'l05', num: '05', name: 'Doubt Creeps In', len: BAR * 2, render: loop05 },
  { id: 'l06', num: '06', name: 'Hollow Room', len: BAR * 2, render: loop06 },
  { id: 'l08', num: '08', name: 'Searching', len: BAR, render: loop08 },
  { id: 'l10', num: '10', name: 'Closing In', len: BAR, render: loop10 },
  { id: 'l13', num: '13', name: 'Cold Trail', len: BAR * 2, render: loop13 },
  { id: 'l14', num: '14', name: 'Held Breath', len: BAR * 2, render: loop14 },
  { id: 'l15', num: '15', name: 'Small Hours', len: BAR * 2, render: loop15 },
  { id: 'l16', num: '16', name: 'Turning Point', len: BAR, render: loop16 },
  { id: 'l18', num: '18', name: 'Distant Signal', len: BAR * 2, render: loop18 },
  { id: 'l19', num: '19', name: 'Slow Reveal', len: BAR * 2, render: loop19 },
  { id: 'l20', num: '20', name: 'Hanging Tension', len: BAR * 2, render: loop20 },
  { id: 'l21', num: '21', name: 'Last Clue', len: BAR, render: loop21 },
].map((s) => ({ ...s, filled: true }));
// all 22 numbers in order
const LOOPS = [...LOOPS_VIDEO, ...LOOPS_FILLED].sort((a, b) => +a.num - +b.num);
