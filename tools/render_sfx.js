// Node: render every sound to 16-bit mono WAV (for spectrogram / metric comparison against the reference audio).
const fs = require('fs'), path = require('path');
const E = require('../audio-lab/dist/engine.js');
const out = process.argv[2], which = process.argv[3] || 'sfx', opt = process.argv[4] === 'opt';
fs.mkdirSync(out, { recursive: true });
function wav(buf, sr) {
  const n = buf.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf[i] * 32767))), 44 + i * 2);
  return b;
}
const list = which === 'sfx' ? E.SFX : E.LOOPS;
for (const s of list) {
  const t0 = Date.now(), b = opt ? s.renderOpt() : s.render();
  fs.writeFileSync(path.join(out, s.id + '.wav'), wav(b, E.SR));
  console.log(s.id.padEnd(12), (b.length / E.SR).toFixed(2) + 's', 'peak', E.peakOf(b).toFixed(2), (Date.now() - t0) + 'ms');
}
