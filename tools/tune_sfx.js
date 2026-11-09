// Fit each one-shot's time offset against the reference clip (edge fit). Usage: node tools/tune_sfx.js [id,id,...]
const E = require('../audio-lab/dist/engine.js');
const pick = process.argv[2] && process.argv[2].split(',');
const out = {};
for (const s of E.SFX) {
  if (pick && !pick.includes(s.id)) continue;
  let best = 0, bs = -9, bv = 0;
  for (let lag = -0.06; lag <= 0.0601; lag += 0.002) {
    E.SFX_LAG[s.id] = +lag.toFixed(4);
    const v = E.edgeScore(s.render(), s.id, s.ref), adj = v - Math.abs(lag) * 0.3;
    if (adj > bs) { bs = adj; best = +lag.toFixed(4); bv = v; }
  }
  E.SFX_LAG[s.id] = best; out[s.id] = best;
  console.log(s.id.padEnd(12), (bv * 100).toFixed(0) + '%', 'lag', best);
}
console.log('\nconst SFX_LAG = ' + JSON.stringify(out) + ';');
