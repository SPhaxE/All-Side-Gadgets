// Shared Bauhaus geometry for scenes 04 (flat fills) and 05 (the same shapes as neon tubes) and their bridges.
// Every shape is a 48-point radial polygon around its own centre, so any two shapes morph vertex-to-vertex.
// geometry is a pure function of tau = seconds since scene 04 started (global time - 18s).
(() => {
  const N = 48;                                   // vertices per shape
  const TILE = 360, COLS = 6, ROWS = 3, OX = -120; // 6x3 full-bleed grid (outer columns are cropped 120px)
  const PAL = { coral: '#f07a63', lav: '#b493ff', purple: '#6a45c2', char: '#2c2c2e' };
  const COLORS = [PAL.coral, PAL.lav, PAL.purple, PAL.char];
  const NEON = { [PAL.coral]: [1.0, .42, .30], [PAL.lav]: [.78, .55, 1.0], [PAL.purple]: [.55, .35, 1.0], [PAL.char]: [.35, .95, 1.0] };
  const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eio = x => { x = clamp(x); return x < .5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2; };   // easeInOutQuint: snappy, ref-like

  // ---- shape library: polygons in tile-local units ([-1,1], y down) ----
  const circ = (cx, cy, r, a0 = 0, a1 = Math.PI * 2, n = 96) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const SHAPES = {
    disc: () => circ(0, 0, .78),
    dot: () => circ(0, 0, .30),
    square: () => [[-.72, -.72], [.72, -.72], [.72, .72], [-.72, .72]],
    full: () => [[-1, -1], [1, -1], [1, 1], [-1, 1]],
    diamond: () => [[0, -.95], [.95, 0], [0, .95], [-.95, 0]],
    tri: () => [[0, -.95], [.95, .95], [-.95, .95]],
    half: () => [[-1, 1], ...circ(0, 1, 1, Math.PI, Math.PI * 2, 64).slice(1, -1), [1, 1]],          // dome on the bottom edge
    quarter: () => [[1, 1], ...circ(1, 1, 2, Math.PI, Math.PI * 1.5, 64)],                           // quarter disc from bottom-right corner
    star4: () => Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? .30 : 1.0; return [Math.cos(a) * r, Math.sin(a) * r]; }),
    bar: () => [[-1, -.32], [1, -.32], [1, .32], [-1, .32]],
    pill: () => [...circ(-.45, 0, .42, Math.PI * .5, Math.PI * 1.5, 32), ...circ(.45, 0, .42, -Math.PI * .5, Math.PI * .5, 32)],
    hex: () => Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3 - Math.PI / 2; return [Math.cos(a) * .82, Math.sin(a) * .82]; }),
    kite: () => [[0, -1], [.62, .1], [0, 1], [-.62, .1]],
  };
  function centroid(P) { let x = 0, y = 0; P.forEach(p => { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length]; }
  function radialize(P) {              // ray-cast N directions from the centroid -> N perimeter points (consistent start at -90deg)
    const c = centroid(P), out = [];
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / N, dx = Math.cos(a), dy = Math.sin(a); let best = 1e9;
      for (let j = 0; j < P.length; j++) {
        const p = P[j], q = P[(j + 1) % P.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((p[0] - c[0]) * ey - (p[1] - c[1]) * ex) / den, u = ((p[0] - c[0]) * dy - (p[1] - c[1]) * dx) / den;
        if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
      }
      out.push([c[0] + dx * best, c[1] + dy * best]);
    }
    return out;
  }
  const CACHE = {}; const shapePts = k => CACHE[k] || (CACHE[k] = radialize(SHAPES[k]()));
  const KEYS = ['disc', 'square', 'diamond', 'tri', 'half', 'quarter', 'star4', 'bar', 'pill', 'hex', 'kite', 'dot'];

  // ---- per-tile states ----
  // state = { bg, layers:[{shape, color, rot(quarter turns, may be .5), scale}] }
  function randomState(tile, step) {
    const k = tile * 131 + step * 977;
    const bg = COLORS[Math.floor(hash(k) * 4)];
    const n = 1 + Math.floor(hash(k + 1) * 2.2);
    const layers = []; let under = bg;
    for (let i = 0; i < n; i++) {
      const kk = k + 10 + i * 7;
      let color = COLORS[Math.floor(hash(kk) * 4)]; if (color === under) color = COLORS[(COLORS.indexOf(color) + 1 + Math.floor(hash(kk + 5) * 3)) % 4];
      const shape = i === 0 ? KEYS[Math.floor(hash(kk + 1) * 11)] : ['dot', 'diamond', 'square', 'disc'][Math.floor(hash(kk + 1) * 4)];
      const rot = Math.floor(hash(kk + 2) * 4) + (hash(kk + 3) > .8 ? .5 : 0);
      layers.push({ shape, color, rot, scale: i === 0 ? 1 : .55 }); under = color;
    }
    if (hash(k + 50) > .6 && layers.length === 1) layers.push({ shape: 'dot', color: bg, rot: 0, scale: 1 });   // ring
    return { bg, layers };
  }
  // climax super-graphic (step 3): a big circle over the centre 2x2, a "sunset" bowl under it, arrows and stripes around
  function climaxState(c, r) {
    const { coral, lav, purple, char } = PAL;
    const Q = (rot, col, bg) => ({ bg, layers: [{ shape: 'quarter', color: col, rot, scale: 1 }] });
    if (c === 2 && r === 0) return Q(0, coral, lav);  if (c === 3 && r === 0) return Q(1, coral, lav);
    if (c === 2 && r === 1) return Q(3, coral, lav);  if (c === 3 && r === 1) return Q(2, coral, lav);
    if (r === 2 && (c === 2 || c === 3)) return { bg: char, layers: [{ shape: 'half', color: purple, rot: 2, scale: 1 }, { shape: 'dot', color: char, rot: 0, scale: .9 }] };
    if (c === 1) return { bg: r === 1 ? coral : purple, layers: [{ shape: 'tri', color: r === 1 ? char : lav, rot: 1, scale: 1 }] };
    if (c === 0) return { bg: char, layers: [{ shape: 'bar', color: r % 2 ? coral : lav, rot: 0, scale: 1 }] };
    if (c === 4) return { bg: purple, layers: [{ shape: r === 1 ? 'star4' : 'bar', color: r === 1 ? coral : lav, rot: 1, scale: 1 }] };
    return { bg: lav, layers: [{ shape: 'disc', color: char, rot: 0, scale: 1 }, { shape: 'dot', color: coral, rot: 0, scale: 1 }] };
  }
  // step k happens at STEP_T[k] (tau seconds); step 0 is the emergence from flat tiles
  const STEP_T = [0.0, 1.5, 3.0, 3.75, 4.5, 7.5, 9.0, 10.5];   // no step inside the 04->05 bridge (tau 5.25-6.75): geometry holds while it ignites
  const MORPH = .6;
  function stateFor(c, r, k) { const tile = r * COLS + c; return k === 3 ? climaxState(c, r) : randomState(tile, k); }
  function delayFor(c, r, k) {
    const pat = k % 3;
    if (k === 3) return 0;                                     // climax: everything together
    if (pat === 0) return (c + r) / (COLS + ROWS - 2) * .32;   // diagonal
    if (pat === 1) return Math.hypot(c - 2.5, r - 1) / 3 * .32; // radial
    return hash(c * 13 + r * 7 + k) * .32;                      // scatter
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  // geometry of one tile at time tau: { x, y, bg, layers:[{pts:[[x,y]..] (canvas px), color}] , emerge }
  function tileAt(c, r, tau) {
    const x = OX + c * TILE, y = r * TILE;
    // which step are we morphing into?
    let k = 0; while (k + 1 < STEP_T.length && tau >= STEP_T[k + 1] + delayFor(c, r, k + 1)) k++;
    const nk = Math.min(k + 1, STEP_T.length - 1);
    const t0 = STEP_T[nk] + delayFor(c, r, nk);
    const m = nk === k ? 0 : eio((tau - t0) / MORPH);
    const A = stateFor(c, r, k), B = stateFor(c, r, nk);
    const emerge = eio((tau - delayFor(c, r, 0) * 1.5 + .15) / .7);   // shapes grow out of flat tiles around tau 0
    const bg = m < .5 ? A.bg : B.bg;
    const L = Math.max(A.layers.length, B.layers.length), layers = [];
    for (let i = 0; i < L; i++) {
      const la = A.layers[i] || { ...A.layers[A.layers.length - 1], scale: 0 }, lb = B.layers[i] || { ...B.layers[B.layers.length - 1], scale: 0 };
      const pa = shapePts(la.shape), pb = shapePts(lb.shape);
      const rot = lerp(la.rot, lb.rot + (lb.rot < la.rot - 2 ? 4 : 0), m) * Math.PI / 2;
      const sc = lerp(la.scale, lb.scale, m) * emerge;
      const cs = Math.cos(rot), sn = Math.sin(rot), pts = [];
      for (let j = 0; j < N; j++) {
        const px = lerp(pa[j][0], pb[j][0], m) * sc, py = lerp(pa[j][1], pb[j][1], m) * sc;
        pts.push([x + TILE / 2 + (px * cs - py * sn) * TILE / 2, y + TILE / 2 + (px * sn + py * cs) * TILE / 2]);
      }
      layers.push({ pts, color: m < .5 ? la.color : lb.color, alpha: clamp(sc * 4) });
    }
    return { x, y, c, r, bg, layers, emerge };
  }
  function tilesAt(tau) { const out = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push(tileAt(c, r, tau)); return out; }
  function pathOf(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  // flat Bauhaus fills (scene 04)
  function drawFills(ctx, tau) {
    for (const t of tilesAt(tau)) {
      ctx.save(); ctx.beginPath(); ctx.rect(t.x, t.y, TILE, TILE); ctx.clip();
      ctx.fillStyle = t.bg; ctx.fillRect(t.x, t.y, TILE, TILE);
      for (const l of t.layers) { if (l.alpha <= 0) continue; ctx.globalAlpha = l.alpha; ctx.fillStyle = l.color; pathOf(ctx, l.pts); ctx.fill(); }
      ctx.restore();
    }
  }
  // neon tubes (scene 05): outlines of the same polygons; light(tile) in 0..1 drives ignition per tile
  function drawTubes(ctx, tau, light) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const t of tilesAt(tau)) {
      const L = light(t); if (L <= 0) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(t.x + 4, t.y + 4, TILE - 8, TILE - 8); ctx.clip();
      for (const l of t.layers) {
        if (l.alpha <= 0) continue;
        const n = NEON[l.color]; ctx.strokeStyle = `rgb(${n.map(v => Math.round(v * 255 * L)).join(',')})`; ctx.lineWidth = 7;
        pathOf(ctx, l.pts); ctx.stroke();
      }
      ctx.restore();
    }
  }
  window.BauhausGeo = { TILE, COLS, ROWS, OX, PAL, COLORS, NEON, STEP_T, tilesAt, drawFills, drawTubes, eio, hash };
})();
