// 540p preview of one scene incl. its incoming and outgoing transitions.
// usage: node tools/preview.js 1 2 3      -> out/preview/NN-name.mp4
const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const NAMES = ['liquid', 'ascii', 'holo', 'bauhaus', 'neon', 'dither', 'clay', 'halftone', 'kinetic', 'pixel', 'particles', 'riso', 'glitch', 'topo', 'glass', 'paper', 'vapor', 'flow', 'metaballs', 'fractal'];
const FPS = 30, D = 4.5, HT = 0.6, PHASE = 0.5;
const root = path.resolve(__dirname, '..');
for (const k of process.argv.slice(2).map(Number)) {
  const from = Math.round(((k - 1) * D - PHASE - HT) * FPS), to = from + Math.round((D + 2 * HT) * FPS);
  const nn = String(k).padStart(2, '0'), dir = path.join(root, 'out', 'preview', nn), mp4 = path.join(root, 'out', 'preview', `${nn}-${NAMES[k - 1]}.mp4`);
  execFileSync('node', [path.join(__dirname, 'render.js'), '--from', from, '--to', to, '--out', dir, '--scale', 0.5, '--seq', '--workers', 4], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', FPS, '-i', path.join(dir, 'f%05d.jpg'),
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-bf', '0',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PREVIEW', mp4);
}
