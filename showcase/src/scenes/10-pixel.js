// 10 Pixel art — 320x180 procedural synthwave city at integer 6x nearest upscale: parallax, striped sun, twinkling stars, 10fps runner, comet
(() => { const E = Engine;
const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
const SKY = ['#150d33', '#21144a', '#33185e', '#4c1d70', '#6e2377', '#962b79', '#c13a76', '#e85070', '#ff7a66', '#ffa665'];
const SPR = {
  head: ['..hhhh..', '.hhhhhh.', '.hffefh.', '..ffff..', '.bbbbbb.', 'bbbbbbbb', '.bbbbbb.', '.bbbbbb.'],
  legs: [['..l..l..', '.l....l.', 'l......l', 's......s'], ['...ll...', '...ll...', '...ll...', '..ssss..'], ['..l..l..', '..l...l.', '..l....l', '..s....s'], ['...ll...', '...ll...', '...ll...', '..ssss..']],
};
const SC = { h: '#2a1740', f: '#ffd7b0', e: '#2a1740', b: '#27d3d3', l: '#2b2a6b', s: '#ff5f7a' };
function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.floor(x), Math.floor(y), w, h); }
function sprite(c, rows, x, y) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') px(c, x + i, y + j, 1, 1, SC[ch]); })); }
E.register(10, E.canvasScene({
  w: 320, h: 180, nearest: true, hudDark: false,
  draw(c, s, w, h) {
    c.imageSmoothingEnabled = false;
    const q = Math.floor(s * 10 + 1e-6), HOR = 118;
    // sky bands (with 2-row ordered dithering at the seams)
    for (let i = 0; i < SKY.length; i++) px(c, 0, i * (HOR / SKY.length), w, Math.ceil(HOR / SKY.length) + 1, SKY[i]);
    for (let i = 1; i < SKY.length; i++) { const y = Math.floor(i * HOR / SKY.length); for (let x = 0; x < w; x++) if ((x + y) % 2 === 0) px(c, x, y - 1, 1, 1, SKY[i]); else px(c, x, y, 1, 1, SKY[i - 1]); }
    // stars
    for (let i = 0; i < 70; i++) { const x = Math.floor(hash(i * 3.1) * w), y = Math.floor(hash(i * 7.7) * 70); const tw = hash(i + q * .31); if (tw > .25) px(c, x, y, 1, 1, tw > .9 ? '#ffffff' : '#c9b8ff'); }
    // sun with slits
    const pulse = 1 + .03 * Math.sin(s * 3);
    const sx = 208, sy = HOR - 6, R = 40 * pulse;
    for (let y = -R; y <= 6; y++) { const half = Math.floor(Math.sqrt(Math.max(R * R - y * y, 0))); const yy = sy + y; const slit = (y > -R * .55) && (((yy + Math.floor(s * 6)) % 8) < Math.max(0, Math.floor((y + R * .55) / 7)));
      if (slit) continue; const t = (y + R) / (R + 6); px(c, sx - half, yy, half * 2, 1, t < .35 ? '#ffe28a' : t < .6 ? '#ffb86b' : t < .8 ? '#ff7f6b' : '#ff4f7a'); }
    // comet at the climax
    const cp = (s - 2.3) / .9; if (cp > 0 && cp < 1) { const cx = 330 - cp * 380, cy = 12 + cp * 52; for (let k = 0; k < 26; k++) px(c, cx + k * 2.2, cy - k * 0.9, 2, 1, k < 2 ? '#ffffff' : (k < 8 ? '#bdb3ff' : '#6a5bd6')); }
    // far mountains
    const mOff = s * 5;
    for (let x = 0; x < w; x++) { const wx = x + mOff; const hgt = 16 + Math.floor(10 * Math.sin(wx * .035) + 8 * Math.sin(wx * .09 + 1.7) + 4 * Math.sin(wx * .21)); px(c, x, HOR - hgt, 1, hgt + 1, '#3d2169'); }
    // mid skyline
    const mid = s * 16;
    for (let x = 0; x < w; x++) { const wx = Math.floor(x + mid), b = Math.floor(wx / 13), hgt = 14 + Math.floor(hash(b * 1.7) * 30); px(c, x, HOR - hgt + 6, 1, hgt, '#2a1654');
      if ((wx % 13) > 1 && (wx % 13) < 11 && (wx % 4) === 1) for (let y = HOR - hgt + 10; y < HOR + 4; y += 5) if (hash(b * 31 + y + (hash(b + y) > .8 ? q : 0)) > .62) px(c, x, y, 2, 2, '#ff9e6b'); }
    // near buildings
    const near = s * 34;
    for (let x = 0; x < w; x++) { const wx = Math.floor(x + near), b = Math.floor(wx / 21), hgt = 26 + Math.floor(hash(b * 5.3 + 9) * 52); px(c, x, 146 - hgt, 1, hgt + 2, '#160b33');
      if ((wx % 21) > 2 && (wx % 21) < 19 && (wx % 5) < 2) for (let y = 146 - hgt + 4; y < 142; y += 6) if (hash(b * 17 + y * .7 + (hash(b * 3 + y) > .85 ? q : 0)) > .55) px(c, x, y, 1, 3, hash(b + y) > .5 ? '#ffd36b' : '#ff6f91'); }
    // road
    px(c, 0, 146, w, 34, '#0e0820'); px(c, 0, 146, w, 2, '#52246e'); px(c, 0, 148, w, 1, '#2b1650');
    const dash = (s * 120) % 40; for (let x = -40; x < w + 40; x += 40) px(c, x - dash, 164, 22, 2, '#ffd36b');
    px(c, 0, 176, w, 4, '#1a0e36');
    // runner (10fps cycle)
    const f = ((q % 4) + 4) % 4, bob = (f === 1 || f === 3) ? -1 : 0, rx = 112, ry = 134 + bob;
    px(c, rx + 1, 146, 6, 1, '#00000055');
    sprite(c, SPR.head, rx, ry); sprite(c, SPR.legs[f], rx, ry + 8);
    // scarf
    for (let k = 0; k < 7; k++) px(c, rx - 1 - k, ry + 4 + Math.round(Math.sin(s * 14 + k * .8) * 1.4), 1, 1, k % 2 ? '#ff5f7a' : '#ffb1c1');
    // foreground posts
    const post = (s * 150) % 120; for (let x = -120; x < w + 120; x += 120) { px(c, x - post + 60, 120, 2, 30, '#0a0618'); px(c, x - post + 56, 118, 10, 3, '#0a0618'); px(c, x - post + 58, 121, 6, 1, '#ffd36b'); }
  },
}));
})();
