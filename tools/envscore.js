// Node: envelope-similarity score of every sound (same metric as the page shows)
const E = require('../audio-lab/dist/engine.js');
const pick = process.argv[2];
for (const [kind, list] of [['sfx', E.SFX], ['loops', E.LOOPS]]) for (const s of list) {
  if (pick && !pick.split(',').includes(s.id)) continue;
  const sc = E.edgeScore(s.render(), s.id, s.ref);
  console.log(s.id.padEnd(12), (sc * 100).toFixed(0).padStart(3) + '%', sc < 0.75 ? '  <75' : '');
}
