// Fit each loop's event time shift to the reference clip's envelope (the clip windows are only known to ~0.1 s).
// Prints a LOOP_TUNE table to paste into audio-lab/src/loops.js. Usage: node tools/tune_loops.js [id,id,...]
const E = require('../audio-lab/dist/engine.js');
const pick = process.argv[2] && process.argv[2].split(',');
const out = {};
for (const s of E.LOOPS) {
  if (pick && !pick.includes(s.id)) continue;
  const base = { ...E.LOOP_TUNE[s.id] };
  let best = base, bs = -9, bv = 0;
  for (let d = -0.3; d <= 0.3001; d += 0.02) {
    const t = { ...base, shift: +(base.shift + d).toFixed(3) };
    E.LOOP_TUNE[s.id] = t;
    const v = E.envScore(s.render(), s.id, s.ref, 'loops');
    const adj = v - Math.abs(d) * 0.15; // among near-equal fits prefer the smallest correction
    if (adj > bs) { bs = adj; best = t; bv = v; }
  }
  E.LOOP_TUNE[s.id] = best; out[s.id] = best;
  console.log(s.id, (bv * 100).toFixed(0) + '%', JSON.stringify(best));
}
console.log('\nconst LOOP_TUNE = ' + JSON.stringify(out) + ';');
