// 16 Paper cutout — scissor-cut paper layers with white cores and soft drop shadows, swaying hills, rising sun, birds; 15fps stop-motion jitter
(() => { const E = Engine;
const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
let tex;
function prng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function paper(c, pts, col, shadow = true, edge = '#fffaf0') {
  c.save(); c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
  if (shadow) { c.shadowColor = 'rgba(40,25,30,.42)'; c.shadowBlur = 22; c.shadowOffsetX = 5; c.shadowOffsetY = 12; }
  c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = edge; c.stroke(); c.shadowColor = 'transparent';
  c.fillStyle = col; c.fill(); c.restore();
}
function hills(layer, baseY, amp, segW, sway, q) {
  const pts = [[-200, 1300]]; const off = Math.sin(q * .8 + layer) * sway;
  for (let x = -200; x <= 2200; x += segW) { const k = Math.round((x + 4000) / segW); const y = baseY - amp * (.5 + .5 * Math.sin(x * .0029 + layer * 2.1)) - amp * .45 * hash(k + layer * 17) ; pts.push([x + off, y]); }
  pts.push([2200 + off, 1300]); return pts;
}
function cloud(c, x, y, sc, q) {
  const pts = []; const R = [[0, 0, 58], [60, -22, 72], [135, 0, 62], [190, 10, 44], [-55, 14, 42]];
  c.save(); c.translate(x, y); c.scale(sc, sc);
  c.shadowColor = 'rgba(40,25,30,.30)'; c.shadowBlur = 16; c.shadowOffsetY = 9;
  c.fillStyle = '#fffaf2'; c.beginPath(); R.forEach(r => { c.moveTo(r[0] + r[2], r[1]); c.arc(r[0], r[1], r[2], 0, Math.PI * 2); }); c.fill();
  c.restore();
}
function tree(c, x, y, h, col) {
  const w = h * .42;
  [[0, 1], [.28, .78], [.52, .55]].forEach(([o, sc], i) => { const yy = y - h * (.28 + o); paper(c, [[x, yy - h * .42 * sc], [x + w * sc, yy + h * .12], [x - w * sc, yy + h * .12]], col, i === 0); });
  c.fillStyle = '#5b3a2a'; c.fillRect(x - 5, y - h * .1, 10, h * .14);
}
function bird(c, x, y, sc, flap, col) {
  const w = 38 * sc, up = 22 * sc * flap; paper(c, [[x - w, y - up], [x, y + 4 * sc], [x + w, y - up], [x + w, y - up + 7 * sc], [x, y + 14 * sc], [x - w, y - up + 7 * sc]], col, false, col);
}
E.register(16, E.canvasScene({
  hudDark: true,
  setup(c, w, h) {            // paper fibre texture, generated once with a seeded PRNG
    const t = document.createElement('canvas'); t.width = 1920; t.height = 1080; const k = t.getContext('2d'); const r = prng(7);
    k.fillStyle = '#f4efe6'; k.fillRect(0, 0, 1920, 1080);
    for (let i = 0; i < 9000; i++) { const x = r() * 1920, y = r() * 1080, a = r() * Math.PI, l = 6 + r() * 22; k.strokeStyle = `rgba(${r() > .5 ? '120,100,80' : '255,255,255'},${.05 + r() * .09})`; k.lineWidth = .6 + r(); k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); k.stroke(); }
    for (let i = 0; i < 18000; i++) { const x = r() * 1920, y = r() * 1080; k.fillStyle = `rgba(90,70,50,${r() * .06})`; k.fillRect(x, y, 1 + r() * 2, 1 + r() * 2); }
    tex = t;
  },
  draw(c, s, w, h) {
    const q15 = Math.floor(s * 15 + 1e-6); const q = q15 / 15;
    const J = (L, a = 4) => [(hash(q15 * 3.1 + L * 7.3) - .5) * a, (hash(q15 * 5.7 + L * 2.9) - .5) * a];
    c.fillStyle = '#f6c7a6'; c.fillRect(0, 0, w, h);
    // sky band (second paper sheet)
    paper(c, [[-50, -50], [1970, -50], [1970, 470 + 12 * Math.sin(q)], [-50, 440]], '#f9d9c2', false, '#f9d9c2');
    // sun rising
    const rise = Math.min(1, (q + .6) / 3.3); const sy = 700 - 330 * (1 - Math.pow(1 - rise, 2.2)), sx = 1180; const [jx, jy] = J(1, 5);
    c.save(); c.translate(sx + jx, sy + jy);
    for (let i = 0; i < 18; i++) { c.save(); c.rotate(i / 18 * Math.PI * 2 + q * .12); paper(c, [[-22, -250], [22, -250], [0, -400 - (i % 2) * 40]], i % 2 ? '#ffb27d' : '#ff9f6a', false, '#ffd9bf'); c.restore(); }
    paper(c, Array.from({ length: 40 }, (_, i) => [Math.cos(i / 40 * 6.2832) * (205 + (hash(i + 5) - .5) * 8), Math.sin(i / 40 * 6.2832) * (205 + (hash(i + 9) - .5) * 8)]), '#ff6f4f', true);
    c.restore();
    // clouds
    [[300, 190, 1.0, 14], [1450, 120, .8, 9], [820, 300, .7, 20], [1750, 330, .6, 12]].forEach(([x, y, sc, v], i) => { const [a, b] = J(10 + i, 4); cloud(c, ((x + q * v * 3) % 2300) - 200 + a, y + b + Math.sin(q + i) * 6, sc, q); });
    // hills (back to front)
    const cols = ['#9bcfd9', '#5aa6c4', '#2f78a0', '#1c4f73', '#12344f'];
    const lay = [[560, 140, 150, 40], [660, 150, 130, 55], [770, 170, 120, 70], [880, 160, 110, 90], [980, 140, 100, 110]];
    lay.forEach(([by, amp, seg, sw], i) => { const [a, b] = J(20 + i, 5); c.save(); c.translate(a, b); paper(c, hills(i, by, amp, seg, sw * .5, q), cols[i]); c.restore();
      if (i === 2 || i === 3) { for (let t = 0; t < 7; t++) { const x = ((t * 340 + i * 90 + q * (6 + i * 3)) % 2300) - 150; const k = Math.round(x / 10); tree(c, x + a, by - amp * .42 - 6 + b, 110 + 60 * hash(t + i * 9), i === 2 ? '#1f6b5e' : '#124a45'); } } });
    // birds
    const flock = Math.max(0, Math.min(1, (q - 1.4) / 1.4));
    for (let i = 0; i < 9; i++) { const t0 = hash(i * 3.3); const bx = ((i * 230 + q * (120 + 40 * t0) + 200) % 2300) - 200, by = 240 + 40 * hash(i) + Math.sin(q * 2 + i) * 18 - flock * (i % 3) * 40; const [a, b] = J(40 + i, 3); bird(c, bx + a, by + b, .8 + .5 * t0, Math.sin(q15 * 1.3 + i * 2) , '#16425b'); }
    // boat on the front water sheet
    const [ba, bb] = J(60, 4);
    c.save(); c.translate(560 + Math.sin(q * .7) * 120 + ba, 936 + Math.sin(q * 2.4) * 8 + bb);
    paper(c, [[-90, -10], [90, -10], [60, 40], [-60, 40]], '#e63946'); paper(c, [[-4, -10], [-4, -150], [80, -30]], '#fffaf0'); paper(c, [[-12, -10], [-12, -120], [-70, -30]], '#ffe29a');
    c.restore();
    // front water sheet (wavy)
    const pts = [[-100, 1200]]; for (let x = -100; x <= 2100; x += 60) pts.push([x + Math.sin(q * 1.4) * 14, 985 + 16 * Math.sin(x * .02 + q * 3) + (hash(Math.round(x / 60) + 3) - .5) * 10]); pts.push([2100, 1200]);
    paper(c, pts, '#0d2a3f');
    // fibre texture on top (multiply)
    c.globalCompositeOperation = 'multiply'; c.globalAlpha = .55; c.drawImage(tex, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
}));
})();
