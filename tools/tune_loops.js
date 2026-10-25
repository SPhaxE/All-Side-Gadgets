// Fit each loop's knobs (event shift, decay scale, pad level, reverb level) to the reference clip's envelope.
// Prints a LOOP_TUNE table to paste into audio-lab/src/loops.js. Usage: node tools/tune_loops.js [id,id,...]
const E = require('../audio-lab/dist/engine.js');
const pick = process.argv[2] && process.argv[2].split(',');
const score = (s, t) => { E.LOOP_TUNE[s.id] = t; return E.envScore(s.render(), s.id, s.ref, 'loops'); };
const out = {};
for (const s of E.LOOPS) {
  if (pick && !pick.includes(s.id)) continue;
  let best = { shift: 0, tau: 1, pad: 1, wet: 1 }, bs = score(s, best);
  for (const sh of [-0.08, -0.06, -0.04, -0.02, 0, 0.02, 0.04, 0.06, 0.08]) for (const ta of [0.45, 0.6, 0.8, 1.0, 1.25]) {
    const t = { ...best, shift: sh, tau: ta }, v = score(s, t); if (v > bs) { bs = v; best = t; }
  }
  for (const pd of [0.3, 0.6, 1, 1.5]) for (const wt of [0.25, 0.6, 1]) {
    const t = { ...best, pad: pd, wet: wt }, v = score(s, t); if (v > bs) { bs = v; best = t; }
  }
  out[s.id] = best;
  console.log(s.id, (bs * 100).toFixed(0) + '%', JSON.stringify(best));
}
console.log('\nconst LOOP_TUNE_FIT = ' + JSON.stringify(out) + ';');
