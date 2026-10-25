// 09 Kinetic typography — four type states (lime / black / pink / cream) switched by expanding colour irises:
// bouncing letter drop -> sliced word shear -> counter-moving marquee rows -> elastic letter pops
(() => { const E = Engine;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eOutCubic = x => 1 - Math.pow(1 - clamp(x), 3);
const eInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eOutBack = x => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const eOutBounce = x => { x = clamp(x); const n1 = 7.5625, d1 = 2.75; if (x < 1 / d1) return n1 * x * x; if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + .75; if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + .9375; return n1 * (x -= 2.625 / d1) * x + .984375; };
const eElastic = x => { x = clamp(x); return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1; };
const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
const FONT = n => `900 ${n}px "Inter","Inter Display",sans-serif`;
const LIME = '#c8ff2e', INK = '#0b0b0b', PINK = '#ff2e88', CREAM = '#f3ecdc';
const T1 = 1.35, T2 = 2.55, T3 = 3.75, IRIS = .5;
const P = [null, [1500, 260], [380, 820], [1100, 540]];

function letters(c, text, size, cx, cy, fn) {           // draw each letter with per-letter transform fn(i, n) -> {dx,dy,rot,sx,sy,fill,alpha}
  c.font = FONT(size); c.textBaseline = 'middle'; c.textAlign = 'left';
  const ws = [...text].map(ch => c.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    const t = fn(i, text.length) || {};
    c.save(); c.translate(x + ws[i] / 2 + (t.dx || 0), cy + (t.dy || 0)); c.rotate(t.rot || 0); c.scale(t.sx ?? 1, t.sy ?? 1);
    c.globalAlpha = t.alpha ?? 1; c.fillStyle = t.fill || INK; c.textAlign = 'center'; c.fillText(ch, 0, 0); c.restore();
    x += ws[i];
  });
}
function asterisk(c, x, y, r, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = col;
  for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.fillRect(-r * .14, -r, r * .28, r * 2); }
  c.restore();
}
function stateLime(c, ls) {
  c.fillStyle = LIME; c.fillRect(0, 0, 1920, 1080);
  letters(c, 'KINETIC', 330, 960, 470, (i, n) => {
    const t0 = i * .075, b = eOutBounce((ls - t0) / .7), r = (hash(i + 3) - .5) * .9;
    const wob = ls > 1.2 ? Math.sin(ls * 6 + i) * 6 * clamp((ls - 1.2) / .5) : 0;
    return { dy: -(1 - b) * 1000 + wob, rot: r * (1 - b), alpha: clamp((ls - t0) * 6) };
  });
  // outlined sub-word slides in
  const sl = eOutCubic((ls - .85) / .55);
  c.save(); c.font = FONT(150); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = INK;
  c.strokeText('TYPOGRAPHY', 960 + (1 - sl) * 1300, 720); c.restore();
  asterisk(c, 1700, 180, 70, ls * 2.4, INK);
  c.fillStyle = INK; c.fillRect(120, 880, 1680 * eOutCubic((ls - .6) / .8), 10);
}
function stateInk(c, ls) {
  c.fillStyle = INK; c.fillRect(0, 0, 1920, 1080);
  const amp = 300 * Math.pow(Math.sin(Math.PI * clamp(ls / 1.15)), 1.2);
  const bandN = 5, y0 = 330, y1 = 610, bh = (y1 - y0) / bandN;
  // lime bar sweeping behind the word
  c.fillStyle = LIME; c.fillRect(0, 730, 1920 * eOutCubic((ls - .15) / .7), 26);
  for (let k = 0; k < bandN; k++) {
    c.save(); c.beginPath(); c.rect(0, y0 + k * bh - .5, 1920, bh + 1); c.clip();
    const dir = k % 2 ? 1 : -1, dx = dir * amp * (.55 + .45 * Math.sin(k * 1.7 + 1));
    const sc = 1 + .14 * eInOut(ls / 1.2);
    c.translate(960, 470); c.scale(sc, sc); c.translate(-960, -470);
    letters(c, 'KINETIC', 330, 960 + dx, 470, () => ({ fill: '#fff' }));
    c.restore();
  }
  c.fillStyle = '#fff'; c.font = '700 40px "JetBrains Mono",monospace'; c.textAlign = 'left';
  c.globalAlpha = eOutCubic((ls - .3) / .5); c.fillText('SHEAR · SLICE · SNAP', 270, 790); c.globalAlpha = 1;
  asterisk(c, 220, 190, 55, -ls * 2.4, LIME);
}
function stateMarquee(c, ls) {
  c.fillStyle = PINK; c.fillRect(0, 0, 1920, 1080);
  const rows = 5, rh = 216, word = 'MOTION  ';
  c.font = FONT(230); const wW = c.measureText(word).width;
  for (let r = 0; r < rows; r++) {
    const y = 540 + (r - 2) * rh, enter = eOutBack((ls - r * .07) / .55), yy = y - (1 - enter) * 1300;
    c.save(); c.beginPath(); c.rect(0, yy - rh / 2 + 6, 1920, rh - 12); c.clip();
    const dir = r % 2 ? 1 : -1, off = (dir * ls * (360 + r * 120)) % wW;
    c.font = FONT(230); c.textBaseline = 'middle'; c.textAlign = 'left';
    const filled = r % 2 === 0, accent = r === 2;
    for (let k = -2; k < Math.ceil(1920 / wW) + 3; k++) {
      const x = k * wW + off;
      if (accent) { c.fillStyle = '#fff'; c.fillText('TYPE  ', x, yy + 6); }
      else if (filled) { c.fillStyle = INK; c.fillText(word, x, yy + 6); }
      else { c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(word, x, yy + 6); }
    }
    c.restore();
  }
}
function statePop(c, ls) {
  c.fillStyle = CREAM; c.fillRect(0, 0, 1920, 1080);
  const cols = [INK, PINK, '#1f4bff', INK];
  letters(c, 'TYPE', 560, 960, 520, (i, n) => {
    const t0 = .04 + i * .11; const k = (ls - t0) / .75;
    const sc = eElastic(k), flip = Math.cos(Math.PI * (1 - clamp(k * 1.6)) * .5);
    const wob = Math.sin(ls * 3.2 + i * 1.3) * .05 * clamp((ls - .9) / .5);
    return { sx: Math.max(.001, sc * Math.abs(flip)), sy: sc, rot: wob, fill: cols[i], dy: Math.sin(ls * 4 + i) * 10 * clamp((ls - .8) / .5) };
  });
  asterisk(c, 1700, 880, 90, ls * 2.4, PINK);
  c.fillStyle = INK; c.fillRect(120, 930, 1680 * eOutCubic((ls - .5) / .7), 10);
}
const STATES = [(c, s) => stateLime(c, s + .45), (c, s) => stateInk(c, s - T1), (c, s) => stateMarquee(c, s - T2), (c, s) => statePop(c, s - T3)];
const TS = [-1e9, T1, T2, T3];
E.register(9, E.canvasScene({
  hudDark: false,
  draw(c, s) {
    let cur = 0; for (let i = 1; i < 4; i++) if (s >= TS[i]) cur = i;
    STATES[cur](c, s);
    // iris into the next state (if mid-iris), drawn on top of the current one
    if (cur < 3) { const nt = TS[cur + 1], q = (s - (nt - 0)) / IRIS; }
    for (let i = 1; i < 4; i++) {
      const q = (s - TS[i]) / IRIS;
      if (q > 0 && q < 1) {
        // state i is entering: draw state i-1 as base then state i inside the expanding circle
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        STATES[i - 1](c, s);
        const r = eInOut(q) * 2300; c.beginPath(); c.arc(P[i][0], P[i][1], r, 0, Math.PI * 2); c.clip();
        STATES[i](c, s); c.restore();
      }
    }
  },
}));
})();
