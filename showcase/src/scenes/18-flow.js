// 18 Flow fields — ~3.6k stateless streamlines seeded on a jittered grid and integrated through a time-varying noise field; heads slide along, tails fade, hue follows direction
(() => { const E = Engine;
const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const perm = new Uint8Array(512); { const r = mulberry(1234), p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + t * (b - a);
function grad(h, x, y, z) { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
function noise3(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255; x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z), A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z, B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u), lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u), lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}
const COLS = 76, ROWS = 44, STEPS = 46, TAIL = 18, HUES = 14;
E.register(18, E.canvasScene({
  hudDark: false,
  draw(c, s, w, h) {
    c.fillStyle = '#04050f'; c.fillRect(0, 0, w, h);
    const vg = c.createRadialGradient(960, 540, 100, 960, 540, 1100); vg.addColorStop(0, 'rgba(60,30,120,.35)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
    const sw = Math.max(0, Math.min(1, (s - 2.0) / .8)) * (1 - Math.max(0, Math.min(1, (s - 3.2) / .9)));   // vortex around the climax
    const t = s * .16;
    const buckets = Array.from({ length: HUES }, () => []);
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const id = j * COLS + i;
      let x = (i + .15 + .7 * hash(id * 1.3)) * (w / COLS), y = (j + .15 + .7 * hash(id * 2.9 + 5)) * (h / ROWS);
      const u = ((s * .34 + hash(id * 7.7)) % 1 + 1) % 1;
      const head = Math.floor(u * (STEPS + TAIL)), tail = head - TAIL;
      const pts = []; let ang = 0;
      for (let k = 0; k <= Math.min(head, STEPS); k++) {
        let a = noise3(x * .0021, y * .0021, t) * 6.2832 * 1.35;
        if (sw > 0) { const dx = x - 960, dy = y - 540, d = Math.hypot(dx, dy) + 1; a = a * (1 - sw * .8) + (Math.atan2(dy, dx) + Math.PI / 2 + .35) * sw * .8 + 0; }
        ang = a; if (k >= tail) pts.push(x, y);
        x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      }
      if (pts.length >= 4) { const hb = Math.floor(((ang % 6.2832 + 6.2832) % 6.2832) / 6.2832 * HUES); buckets[hb].push(pts, u); }
    }
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (let b = 0; b < HUES; b++) {
      const hue = 190 + (b / HUES) * 170; const arr = buckets[b];
      const draw = (lw, alpha) => { c.lineWidth = lw; c.strokeStyle = `hsla(${hue},95%,${60 + 8 * Math.sin(b)}%,${alpha})`; c.beginPath();
        for (let q = 0; q < arr.length; q += 2) { const p = arr[q]; c.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]); } c.stroke(); };
      draw(5, .10); draw(1.7, .95);
    }
    c.globalCompositeOperation = 'source-over';
  },
}));
})();
