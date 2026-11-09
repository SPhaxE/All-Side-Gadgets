#!/usr/bin/env node
// Builds derived frames from the base footage in assets/footage/ (horse.mp4, dancer.mp4, car.mp4 — not in git).
// Output goes to assets/build/ (also not in git). Needs only node + ffmpeg.   usage: node tools/build-assets.js [horse|dancer|car]...
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'), SRC = path.join(ROOT, 'assets', 'footage'), OUT = path.join(ROOT, 'assets', 'build');
const want = process.argv.slice(2); const doIt = k => !want.length || want.includes(k);

function readFrames(file, vf, w, h, ss, t) {          // decode to raw gray frames
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(ss), '-t', String(t), '-i', file, '-vf', vf + ',format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  const n = Math.floor(r.stdout.length / (w * h)); const frames = [];
  for (let i = 0; i < n; i++) frames.push(new Float32Array(r.stdout.subarray(i * w * h, (i + 1) * w * h)));
  return frames;
}
function writePngs(dir, frames, w, h, fmt = 'gray') {  // frames: Uint8Array each
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', fmt, '-s', `${w}x${h}`, '-i', '-', path.join(dir, '%03d.png')],
    { input: Buffer.concat(frames.map(f => Buffer.from(f.buffer, f.byteOffset, f.byteLength))), maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
}
// error diffusion to 1 bit (true serial algorithms — impossible to do statelessly in a shader, so done here)
function diffuse(src, w, h, kernel, div) {
  const a = Float32Array.from(src), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = a[i], q = v < 128 ? 0 : 255, e = (v - q) / div; out[i] = q;
    for (const [dx, dy, k] of kernel) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < w && yy < h) a[yy * w + xx] += e * k; }
  }
  return out;
}
const FS = [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]];
const ATK = [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]];   // Atkinson: only 6/8 of the error -> div 8
// outline of the largest bright blob -> ordered, smoothed, resampled polyline (normalised 0..1)
function outline(gray, w, h, thr, nOut) {
  const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = gray[i] > thr ? 1 : 0;
  const lab = new Int32Array(w * h).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    const st = [s]; lab[s] = id; let n = 0;
    while (st.length) { const p = st.pop(); n++; const x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, q = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[q] && lab[q] < 0) { lab[q] = id; st.push(q); } } }
    if (n > bestN) { bestN = n; best = id; } id++;
  }
  const inB = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x] === best;
  let sx = -1, sy = -1; for (let i = 0; i < w * h && sx < 0; i++) if (lab[i] === best) { sx = i % w; sy = (i / w) | 0; }
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];      // Moore neighbour tracing
  const pts = [[sx, sy]]; let cx = sx, cy = sy, dir = 7;
  for (let guard = 0; guard < w * h * 4; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) { const d = (dir + 6 + k) % 8, nx = cx + D[d][0], ny = cy + D[d][1]; if (inB(nx, ny)) { cx = nx; cy = ny; dir = d; found = true; break; } }
    if (!found || (cx === sx && cy === sy)) break; pts.push([cx, cy]);
  }
  const sm = pts.map((_, i) => { let x = 0, y = 0; for (let k = -3; k <= 3; k++) { const p = pts[(i + k + pts.length) % pts.length]; x += p[0]; y += p[1]; } return [x / 7, y / 7]; });
  const L = [0]; for (let i = 1; i <= sm.length; i++) { const a = sm[i - 1], b = sm[i % sm.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const out = []; let j = 0;
  for (let i = 0; i < nOut; i++) { const t = L[L.length - 1] * i / nOut; while (L[j + 1] < t) j++; const a = sm[j], b = sm[(j + 1) % sm.length], f = (t - L[j]) / Math.max(1e-6, L[j + 1] - L[j]);
    out.push([+((a[0] + (b[0] - a[0]) * f) / w).toFixed(4), +((a[1] + (b[1] - a[1]) * f) / h).toFixed(4)]); }
  return out;
}

if (doIt('horse')) {
  const S = 540, file = path.join(SRC, 'horse.mp4'), dir = path.join(OUT, 'horse');
  console.log('horse: decoding 0-7s at 12fps ...');
  const frames = readFrames(file, `fps=12,scale=${S}:${S}:flags=lanczos`, S, S, 0, 7.0);
  writePngs(path.join(dir, 'gray'), frames.map(f => Uint8Array.from(f)), S, S);
  console.log(`horse: ${frames.length} frames, diffusing (Floyd-Steinberg, Atkinson) ...`);
  writePngs(path.join(dir, 'fs'), frames.map(f => diffuse(f, S, S, FS, 16)), S, S);
  writePngs(path.join(dir, 'atk'), frames.map(f => diffuse(f, S, S, ATK, 8)), S, S);
  const small = readFrames(file, 'scale=270:270:flags=area,gblur=sigma=1.2', 270, 270, 0, 0.05)[0];
  const ol = outline(small, 270, 270, +(process.env.HORSE_THR || 140), 320);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ fps: 12, frames: frames.length, size: S, outline: ol }));
  console.log('horse: done ->', path.relative(ROOT, dir));
}
if (doIt('dancer')) {   // ASCII source: 30fps, 1.0-8.5s (praying-hands pose at both ends), 480 tall
  const dir = path.join(OUT, 'dancer', 'rgb'); fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.0', '-t', '7.5', '-i', path.join(SRC, 'dancer.mp4'), '-vf', 'scale=-2:480:flags=lanczos', '-q:v', '3', path.join(dir, '%03d.jpg')]);
  if (r.status !== 0) throw new Error(r.stderr.toString()); console.log('dancer: done');
}
if (doIt('car')) {      // glitch source: full-res frames of the whole clip at 30fps
  const dir = path.join(OUT, 'car', 'rgb'); fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(SRC, 'car.mp4'), '-vf', 'fps=30', '-q:v', '2', path.join(dir, '%03d.jpg')]);
  if (r.status !== 0) throw new Error(r.stderr.toString()); console.log('car: done');
}
