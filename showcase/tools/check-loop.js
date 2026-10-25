// Loop + determinism checks (run after scene work is done; needs idle CPU).
//  1. seam: mean abs diff between consecutive frames across the loop seam (N-3..N-1 -> 0..2) vs a baseline of ordinary neighbours elsewhere
//  2. determinism: same frame rendered (a) first in a cold browser, (b) after other frames in another browser must be byte-identical
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const { execFileSync } = require('child_process');
const N = 2700, scale = +(process.argv[2] || 0.5), out = path.resolve(__dirname, '..', 'out', 'check'); fs.mkdirSync(out, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-device-scale-factor=1'];
async function session(frames, tag) {
  const b = await chromium.launch({ args: ARGS }); const p = await b.newPage({ viewport: { width: Math.round(1920 * scale), height: Math.round(1080 * scale) } });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + `?scale=${scale}`); await p.waitForFunction('window.__ready===true', null, { timeout: 120000 });
  const files = {};
  for (const f of frames) { await p.evaluate(i => window.renderFrame(i), f); const file = path.join(out, `${tag}_${f}.png`); await p.screenshot({ path: file, type: 'png' }); files[f] = file; }
  await b.close(); return files;
}
const py = `
import sys, numpy as np
from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB'),dtype=np.float32); b=np.asarray(Image.open(sys.argv[2]).convert('RGB'),dtype=np.float32)
print(float(np.abs(a-b).mean()))`;
const diff = (a, b) => parseFloat(execFileSync('python3', ['-I', '-c', py, a, b]).toString());
(async () => {
  const seam = [N - 3, N - 2, N - 1, 0, 1, 2], base = [900, 901, 902, 903, 904, 905], base2 = [1800, 1801, 1802, 1803];
  const A = await session([...seam, ...base, ...base2, 700, 2000, 700], 'seq');
  const d = (F, l) => l.slice(1).map((f, i) => diff(F[l[i]], F[f]));
  const ds = d(A, seam), db = d(A, base), db2 = d(A, base2);
  console.log('seam diffs  (N-3..2):', ds.map(x => x.toFixed(3)).join(' '));
  console.log('baseline    (900..)  :', db.map(x => x.toFixed(3)).join(' '));
  console.log('baseline    (1800..) :', db2.map(x => x.toFixed(3)).join(' '));
  const typ = Math.max(...db, ...db2) || .001, seamAcross = ds[2];   // pair (N-1 -> 0)
  console.log(`seam pair N-1->0 = ${seamAcross.toFixed(3)}  vs worst ordinary neighbour = ${typ.toFixed(3)}  => ${seamAcross <= typ * 1.5 ? 'OK' : 'CHECK'}`);
  const C = await session([700], 'cold');
  const same = fs.readFileSync(C[700]).equals(fs.readFileSync(A[700]));
  console.log('cold-start vs sequential frame 700 byte-identical:', same);
})().catch(e => { console.error(e); process.exit(1); });
