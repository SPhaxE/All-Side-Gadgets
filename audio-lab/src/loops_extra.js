// Optional extras: the 12 numbers the video skips (05 06 08 10 13 14 15 16 18 19 20 21). Not in the video; written to continue
// the story arc between neighbouring clips, same key (B minor) and tempo (90 bpm). Names are mine.
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


const LOOPS_EXTRA = [
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
].map((s) => ({ ...s, extra: true }));
