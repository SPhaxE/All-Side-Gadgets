// 04 Bauhaus shapes — 7x4 grid of primary-colour geometric tiles; mechanical flip waves (diagonal / radial / scatter)
(() => { const E = Engine;
const PAL = ['#e4382c', '#f2b705', '#1f4e9c', '#141414', '#efe6d2'];
const COLS = 7, ROWS = 4, CS = 270, OX = (1920 - COLS * CS) / 2;
const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
const TYPES = 9;
function state(n, cx, cy) {
  const k = n * 977 + cx * 31 + cy * 57;
  const type = Math.floor(hash(k) * TYPES);
  const c1 = Math.floor(hash(k + 1) * PAL.length);
  let c2 = Math.floor(hash(k + 2) * PAL.length); if (c2 === c1) c2 = (c2 + 1 + Math.floor(hash(k + 4) * 3)) % PAL.length;
  return { type, c1, c2, rot: Math.floor(hash(k + 3) * 4) };
}
function draw(c, st, h) {                       // h = half cell size; origin at centre
  const S = h * 2, a = PAL[st.c1], b = PAL[st.c2];
  c.fillStyle = a; c.fillRect(-h, -h, S, S);
  c.save(); c.rotate(st.rot * Math.PI / 2); c.fillStyle = b;
  switch (st.type) {
    case 0: c.beginPath(); c.arc(0, 0, h * .78, 0, 7); c.fill(); break;
    case 1: c.beginPath(); c.arc(0, h, h, Math.PI, 2 * Math.PI); c.fill(); break;                     // half disc
    case 2: c.beginPath(); c.moveTo(-h, h); c.arc(-h, h, S, -Math.PI / 2, 0); c.closePath(); c.fill(); break; // quarter disc
    case 3: c.beginPath(); c.moveTo(-h, -h); c.lineTo(h, h); c.lineTo(-h, h); c.closePath(); c.fill(); break;
    case 4: c.beginPath(); c.moveTo(h * .8, 0); c.arc(0, 0, h * .8, 0, Math.PI * 2); c.moveTo(h * .38, 0); c.arc(0, 0, h * .38, 0, Math.PI * 2); c.fill('evenodd'); break;
    case 5: for (let i = 0; i < 4; i++) c.fillRect(-h + i * S / 4, -h, S / 8, S); break;
    case 6: for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { c.beginPath(); c.arc(i * S * .3, j * S * .3, S * .085, 0, 7); c.fill(); } break;
    case 7: c.fillRect(-h * .3, -h * .3, h * .6, h * .6); break;
    default: for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? a : b; c.beginPath(); c.arc(0, 0, h * (.9 - i * .22), 0, 7); c.fill(); }
  }
  c.restore();
}
const P = 1.15, DUR = .42;
E.register(4, E.canvasScene({
  hudDark: true,
  draw(c, s, w, h) {
    c.fillStyle = PAL[4]; c.fillRect(0, 0, w, h);
    const u = (s + .5) / P, n = Math.floor(u), f = (u - n) * P;
    for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
      let pat = n % 3, d;
      if (pat === 0) d = (cx + cy) / (COLS + ROWS - 2);
      else if (pat === 1) d = Math.hypot(cx - 3, cy - 1.5) / 3.8;
      else d = hash(cx * 13 + cy * 7 + n);
      const delay = d * .6, local = (f - delay) / DUR;
      let st, sx = 1;
      if (local <= 0) st = state(n - 1, cx, cy);
      else if (local >= 1) st = state(n, cx, cy);
      else { st = local < .5 ? state(n - 1, cx, cy) : state(n, cx, cy); sx = Math.max(.001, Math.abs(Math.cos(Math.PI * local))); }
      c.save();
      c.translate(OX + cx * CS + CS / 2, cy * CS + CS / 2); c.scale(sx, 1);
      c.beginPath(); c.rect(-CS / 2, -CS / 2, CS, CS); c.clip();
      draw(c, st, CS / 2);
      c.restore();
    }
    c.strokeStyle = '#141414'; c.lineWidth = 6;
    for (let i = 0; i <= COLS; i++) { c.beginPath(); c.moveTo(OX + i * CS, 0); c.lineTo(OX + i * CS, h); c.stroke(); }
    for (let j = 0; j <= ROWS; j++) { c.beginPath(); c.moveTo(OX, j * CS); c.lineTo(OX + COLS * CS, j * CS); c.stroke(); }
    c.fillStyle = PAL[4]; c.fillRect(0, 0, OX, h); c.fillRect(w - OX, 0, OX, h);
  },
}));
})();
