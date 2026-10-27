// 09 Kinetic typography (v2) — Swiss grid poster in motion. 12-column grid, black/white + signal red, every move on
// the beat (80 BPM). The halftone dot from 08 opens into the O of FORM; F R M slide out from behind it; FOLLOWS spins
// in on a 3D letter cylinder; MOTION lands letter by letter on split-flap tiles; weight breathes Thin<->Black across
// the words while a red block sweeps the grid and knocks the type out; annotations type themselves in.
(() => { const E = Engine;
const W = 1920, H = 1080, M = 96, GUT = 24, COLW = (W - 2 * M - 11 * GUT) / 12;
const RED = '#ff3b1f', INK = '#111111', PAPER = '#f4f1ea';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eo = x => 1 - Math.pow(1 - clamp(x), 4), eio = x => { x = clamp(x); return x < .5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2; };
const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
const colX = c => M + c * (COLW + GUT);
const font = (w, px) => `${w} ${px}px "Inter"`;
const W9 = [100, 200, 300, 400, 500, 600, 700, 800, 900];
// draw text at weight wf (100..900, fractional -> crossfade the two neighbouring cuts)
function wtext(c, str, x, y, px, wf, fill) {
  const k = clamp((wf - 100) / 100, 0, 8), i0 = Math.floor(k), i1 = Math.min(8, i0 + 1), f = k - i0;
  c.fillStyle = fill;
  c.globalAlpha = 1; c.font = font(W9[i0], px); c.fillText(str, x, y);
  if (f > .01) { c.globalAlpha = f; c.font = font(W9[i1], px); c.fillText(str, x, y); c.globalAlpha = 1; }
}
function typed(str, t, cps = 40) { return str.slice(0, Math.max(0, Math.floor(t * cps))); }
E.register(9, E.canvasScene({
  hudDark: true,
  draw(c, s, w, h) {
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    // ---- grid ----
    const gA = clamp((s - .1) / .6) * (1 - .6 * clamp((s - 4.4) / .6));
    if (gA > 0) {
      c.strokeStyle = `rgba(255,59,31,${.28 * gA})`; c.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const x = colX(i), hh = H * eo((s - .1 - i * .02) / .5); c.strokeRect(x + .5, 0, COLW, hh); }
      c.beginPath(); for (const y of [120, 560, 640, 930]) { c.moveTo(0, y + .5); c.lineTo(W * eo((s - .2) / .6), y + .5); } c.stroke();
    }
    // ---- breathing weight wave (climax) ----
    const breathe = clamp((s - 2.95) / .2) * (1 - clamp((s - 4.35) / .3));
    const wAt = (i, base) => base + ((100 + 800 * (.5 + .5 * Math.cos((s - 3.0) * 4.19 - i * .7))) - base) * breathe;
    // ---- FORM: the O is the dot from scene 08 ----
    const PX = 400, baseY = 500;
    c.font = font(900, PX);
    const letters = ['F', 'O', 'R', 'M'], wd = letters.map(l => c.measureText(l).width), total = wd.reduce((a, b) => a + b, 0) - 3 * 24;
    let x0 = (W - total) / 2; const xs = []; for (let i = 0; i < 4; i++) { xs.push(x0); x0 += wd[i] - 24; }
    const oCx = xs[1] + wd[1] / 2, oCy = baseY - PX * .365, oR = PX * .385;         // geometric O, sized to the Inter Black cap height
    const settle = eio((s - .75) / .6);                                             // beat 1: the dot shrinks into its slot
    const open = eio((s - .0) / .5);                                                // beat 0: the counter opens
    const cx = W / 2 + (oCx - W / 2) * settle, cy = H / 2 + (oCy - H / 2) * settle, R = 324 + (oR - 324) * settle;
    // F R M slide out from behind the O (masked), one after another
    letters.forEach((L, i) => {
      if (i === 1) return;
      const k = eo((s - .8 - (i === 0 ? 0 : i === 2 ? .08 : .16)) / .55);
      if (k <= 0) return;
      const dx = (1 - k) * (oCx - xs[i] - wd[i] / 2);
      c.save(); c.beginPath(); c.rect(0, 0, W, H); c.arc(cx, cy, R * 1.02, 0, Math.PI * 2, true); c.clip('evenodd');
      wtext(c, L, xs[i] + dx, baseY, PX, wAt(i, 900), INK); c.restore();
    });
    // the O itself (ring), weight follows the breathing too: ring thickness
    const thick = .37 + ((.12 + .5 * (wAt(1, 900) - 100) / 800) - .37) * breathe;
    c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    const inner = R * (1 - thick) * open; if (inner > 0) { c.fillStyle = PAPER; c.beginPath(); c.ellipse(cx, cy, inner * .78, inner, 0, 0, Math.PI * 2); c.fill(); }
    // ---- FOLLOWS on a letter cylinder (beat 2) ----
    const fa = clamp((s - 1.4) / .3);
    if (fa > 0) {
      const str = 'FOLLOWS', n = str.length, px2 = 150, Rc = 520, spin = (1 - eio((s - 1.45) / 1.0)) * 2.4;
      for (let i = 0; i < n; i++) {
        const th = (i - (n - 1) / 2) * .19 + spin, z = Math.cos(th); if (z < .05) continue;
        const x = W / 2 + Math.sin(th) * Rc, y = 700;
        c.save(); c.translate(x, y); c.scale(z, 1); c.globalAlpha = fa * clamp(z * 1.6);
        c.textAlign = 'center'; wtext(c, str[i], 0, 0, px2, wAt(i + 4, 300 + 600 * (1 - z)), INK); c.restore();
      }
      c.globalAlpha = 1; c.textAlign = 'left';
    }
    // ---- MOTION on split-flap tiles (beat 3) ----
    if (s > 2.2) {
      const str = 'MOTION', tw = COLW + GUT, th = 190, y0 = 780, x1 = colX(3);
      for (let i = 0; i < 6; i++) {
        const t0 = 2.25 + i * .09, land = t0 + .45; if (s < t0) continue;
        const x = x1 + i * tw, flips = Math.floor((Math.min(s, land) - t0) * 18);
        const ch = s >= land ? str[i] : String.fromCharCode(65 + Math.floor(hash(i * 31 + flips) * 26));
        const fp = s >= land ? 1 : ((s - t0) * 18) % 1;
        c.fillStyle = INK; c.fillRect(x, y0, tw - 10, th);
        c.save(); c.beginPath(); c.rect(x, y0, tw - 10, th); c.clip();
        c.textAlign = 'center'; wtext(c, ch, x + (tw - 10) / 2, y0 + th * .78, 170, wAt(i + 11, 800), PAPER);
        if (fp < 1) { const sy = Math.abs(Math.cos(fp * Math.PI)); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x, y0 + th / 2 - th / 2 * sy, tw - 10, th / 2 * sy); }
        c.restore();
        c.fillStyle = PAPER; c.fillRect(x, y0 + th / 2 - 1.5, tw - 10, 3);
      }
      c.textAlign = 'left';
    }
    // ---- red block sweeps the grid and knocks the type out (climax, beats 4-5) ----
    const sweep = eio((s - 3.0) / 1.2);
    if (sweep > 0 && sweep < 1) {
      const bx = -400 + (W + 400) * sweep, bw = 4 * (COLW + GUT);
      c.save(); c.globalCompositeOperation = 'difference'; c.fillStyle = '#00c4e0'; c.fillRect(bx, 0, bw, H); c.restore();
    }
    // ---- annotations ----
    c.fillStyle = INK; c.font = '500 18px "JetBrains Mono"';
    const ann = [[colX(0), 100, 'FORM FOLLOWS MOTION', .3], [colX(0), 128, 'GRID 12 × 1 · GUTTER 24 · MARGIN 96', .45], [colX(9), 100, 'INTER BLACK · 400 PX', .6],
      [colX(9), 128, `WGHT ${Math.round(wAt(0, 900))}`, .7], [colX(0), 1000, 'TRACKING −24 / BASELINE 500', 1.6], [colX(9), 1000, `${(s * 80 / 60).toFixed(2)} BEATS · 80 BPM`, 1.7]];
    ann.forEach(([x, y, str, t0]) => c.fillText(typed(str, s - t0, 45), x, y));
    // crop marks
    c.strokeStyle = INK; c.lineWidth = 2; const cm = clamp((s - .2) / .4) * 30;
    for (const [x, y, sx, sy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * cm, y); c.moveTo(x, y); c.lineTo(x, y + sy * cm); c.stroke(); }
  },
}));
})();
