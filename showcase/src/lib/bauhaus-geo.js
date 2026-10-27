// Shared Bauhaus tiles for scenes 04 (flat fills) and 05 (the same fills read as neon tubes) and their bridges.
// Like the reference, every tile is a small self-running mechanism (pinwheel, conveyor, iris, ...) that moves
// continuously in eased steps on the beat; each mechanism is seamless by construction (state after a step == state
// before it with colours rotated), so it can run for any length of time. Pure function of tau (s since scene 04 start).
(() => {
  const TILE = 360, COLS = 6, ROWS = 3, OX = -120;   // 6x3 full-bleed grid (outer columns cropped by 120px)
  const PAL = { coral: '#f07a63', lav: '#b493ff', purple: '#6a45c2', char: '#2c2c2e' };
  const P = [PAL.coral, PAL.lav, PAL.purple, PAL.char];
  const BEAT = .75, MOVE = .55;
  const hash = a => { a = Math.sin(a * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eio = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
  const col = (k) => P[((k % 4) + 4) % 4];

  // continuous step counter: every tile moves every 2 beats (checkerboard parity), everyone moves on the climax beat (tau 3.0)
  function phase(tau, parity, extra) {
    let ph = 0;
    for (let k = -2; k < 20; k++) ph += eio((tau - (parity * BEAT + k * 2 * BEAT)) / MOVE);
    if (parity === 1) ph += eio((tau - 3.0) / MOVE);            // climax: the odd tiles join in
    for (const t of extra) ph += eio((tau - t) / MOVE);
    return ph;
  }
  const poly = (c, pts, fill) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = fill; c.lineWidth = 1; c.stroke(); };
  const disc = (c, x, y, r, fill) => { if (r <= 0) return; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
  const S = TILE, H2 = TILE / 2;

  // ---- mechanisms: draw(c, ph, b) in tile-local px (0..S), b = colour offset of this tile ----
  const MECH = {
    // four wedges meeting at a centre point that orbits in 90-degree eased steps (ref tile 1)
    pinwheel(c, ph, b) {
      const a = ph * Math.PI / 2 + Math.PI / 4, cx = H2 + Math.cos(a) * S * .3, cy = H2 + Math.sin(a) * S * .3;
      const C = [[0, 0], [S, 0], [S, S], [0, S]];
      for (let i = 0; i < 4; i++) poly(c, [C[i], C[(i + 1) % 4], [cx, cy]], col(b + i));
    },
    // stacked chevrons scrolling up one band per step (ref tile 3)
    chevron(c, ph, b) {
      const per = S / 3, f = ph - Math.floor(ph), n = Math.floor(ph);
      for (let j = -3; j <= 6; j++) {          // top to bottom: each lower band overlaps the one above
        const y = (j - f) * per;
        poly(c, [[-1, y + H2], [H2, y], [S + 1, y + H2], [S + 1, y + H2 + per * 3], [-1, y + H2 + per * 3]], col(b + j + n));
      }
    },
    // concentric rings expanding outward one ring per step (infinite zoom)
    iris(c, ph, b) {
      const f = ph - Math.floor(ph), n = Math.floor(ph), step = S * .17;
      c.fillStyle = col(b + n - 1); c.fillRect(0, 0, S, S);
      for (let j = 0; j < 7; j++) disc(c, H2, H2, (6 - j + f) * step, col(b + n + j - 6));
    },
    // four quarter discs grow from the corners until they flood the tile, then the next colour starts (ref 4-point star)
    quarters(c, ph, b) {
      const f = ph - Math.floor(ph), n = Math.floor(ph);
      c.fillStyle = col(b + n); c.fillRect(0, 0, S, S);
      const r = f * S * .72, fill = col(b + n + 1);
      for (const [x, y] of [[0, 0], [S, 0], [S, S], [0, S]]) disc(c, x, y, r, fill);
      disc(c, H2, H2, S * .11 * Math.sin(Math.PI * f), col(b + n + 2));
    },
    // domes hanging from the top and rising from the bottom, sliding sideways in opposite directions (ref "D C")
    domes(c, ph, b) {
      const f = ph - Math.floor(ph), n = Math.floor(ph);
      c.fillStyle = col(b + 3); c.fillRect(0, 0, S, S);
      for (let j = -1; j <= 2; j++) {
        const x1 = (j + f) * S, x2 = (j - f + .5) * S;
        c.beginPath(); c.arc(x1, 0, H2 * .98, 0, Math.PI); c.fillStyle = col(b + n - j); c.fill();
        c.beginPath(); c.arc(x2, S, H2 * .98, Math.PI, Math.PI * 2); c.fillStyle = col(b + n + j + 1); c.fill();
      }
    },
    // dashed bars, alternate columns travelling up / down (ref meander)
    stripes(c, ph, b) {
      const n = Math.floor(ph), f = ph - n, w = S / 3;
      c.fillStyle = col(b + 2); c.fillRect(0, 0, S, S);
      for (let i = 0; i < 3; i++) {
        const dir = i % 2 ? 1 : -1;
        for (let j = -2; j <= 2; j++) {
          const y = (j + dir * f) * S * .5 + (i % 2) * S * .25;
          c.fillStyle = col(b + (i % 2 ? 0 : 1) + ((j + n * dir) & 1) * 3); c.fillRect(i * w, y, w + .5, S * .5 * .7);
        }
      }
    },
    // a diamond that turns 45 degrees per step (diamond <-> square), counter-rotating square and a pulsing dot inside (ref)
    turn(c, ph, b) {
      c.fillStyle = col(b); c.fillRect(0, 0, S, S);
      const sq = (r, a, fill) => poly(c, [0, 1, 2, 3].map(k => [H2 + Math.cos(a + k * Math.PI / 2) * r, H2 + Math.sin(a + k * Math.PI / 2) * r]), fill);
      sq(S * .48, ph * Math.PI / 4, col(b + 3));
      sq(S * .30, -ph * Math.PI / 4 + Math.PI / 4, col(b + 1));
      const pulse = Math.sin((ph - Math.floor(ph)) * Math.PI);
      disc(c, H2, H2, S * (.08 + .06 * pulse), col(b + 0));
    },
    // 2x2 blocks sliding one quadrant clockwise per step
    checker(c, ph, b) {
      const n = Math.floor(ph), f = ph - n;
      const Q = [[0, 0], [H2, 0], [H2, H2], [0, H2]];
      for (let i = 0; i < 4; i++) {
        const a = Q[(((i + n) % 4) + 4) % 4], z = Q[(((i + n + 1) % 4) + 4) % 4];
        c.fillStyle = col(b + i); c.fillRect(a[0] + (z[0] - a[0]) * f - .5, a[1] + (z[1] - a[1]) * f - .5, H2 + 1, H2 + 1);
      }
      disc(c, H2, H2, S * .14, col(b + 2));
    },
    // big triangle whose apex slides along the top edge, ping-pong (ref "A" tent), inner triangle lags
    tent(c, ph, b) {
      const n = Math.floor(ph), f = ph - n, u = n % 2 ? 1 - f : f;
      c.fillStyle = col(b + 1); c.fillRect(0, 0, S, S);
      poly(c, [[0, S], [S, S], [u * S, 0]], col(b + 3));
      const v = .25 + .5 * (1 - u);
      poly(c, [[S * .2, S], [S * .8, S], [S * (.2 + .6 * v), S * .38]], col(b + 0));
    },
    // circle of alternating quadrants rotating 90 degrees per step
    pie(c, ph, b) {
      c.fillStyle = col(b + 2); c.fillRect(0, 0, S, S);
      const a0 = ph * Math.PI / 2, r = S * .44;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(H2, H2); c.arc(H2, H2, r, a0 + i * Math.PI / 2, a0 + (i + 1) * Math.PI / 2); c.closePath(); c.fillStyle = col(b + (i % 2 ? 1 : 3)); c.fill(); }
      disc(c, H2, H2, S * .12, col(b));
    },
    // quarter-circle bands from a corner, expanding outward
    arcs(c, ph, b) {
      const n = Math.floor(ph), f = ph - n, step = S * .28;
      c.fillStyle = col(b + n - 1); c.fillRect(0, 0, S, S);
      for (let j = 0; j < 7; j++) disc(c, 0, S, (6 - j + f) * step, col(b + n + j));
    },
    // inscribed square: vertices slide along the edges (full -> diamond -> full), a second one nested and lagging
    inscribe(c, ph, b) {
      c.fillStyle = col(b + 1); c.fillRect(0, 0, S, S);
      const ins = (u, x0, y0, s, fill) => { const P4 = [[x0 + u * s, y0], [x0 + s, y0 + u * s], [x0 + s - u * s, y0 + s], [x0, y0 + s - u * s]]; poly(c, P4, fill); return P4; };
      const u1 = (ph % 1 + 1) % 1 * .5 + (((Math.floor(ph) % 2) + 2) % 2) * .5;
      ins(u1, 0, 0, S, col(b + 3));
      const u2 = ((ph - .35) % 1 + 1) % 1;
      ins(u2, S * .22, S * .22, S * .56, col(b + 0));
    },
  };
  const LAYOUT = [
    ['chevron', 'iris', 'pinwheel', 'quarters', 'domes', 'chevron'],
    ['stripes', 'turn', 'checker', 'tent', 'pie', 'iris'],
    ['pinwheel', 'arcs', 'inscribe', 'stripes', 'quarters', 'turn'],
  ];
  const ROT = [[0, 0, 1, 0, 0, 2], [0, 0, 0, 0, 1, 3], [3, 0, 0, 2, 2, 1]];   // quarter turns per tile, for variety
  const MIRROR = [[1, 1, 1, 1, 1, -1], [1, 1, -1, 1, 1, -1], [-1, 1, 1, 1, -1, 1]];

  function drawTile(ctx, cx, cy, tau) {
    const x = OX + cx * TILE, y = cy * TILE, parity = (cx + cy) & 1, b = Math.floor(hash(cx * 7 + cy * 13) * 4);
    let ph = phase(tau, parity, []) * MIRROR[cy][cx];
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, TILE, TILE); ctx.clip();
    ctx.translate(x + H2, y + H2); ctx.rotate(ROT[cy][cx] * Math.PI / 2); ctx.translate(-H2, -H2);
    MECH[LAYOUT[cy][cx]](ctx, ph, b);
    ctx.restore();
  }
  function drawFills(ctx, tau) { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) drawTile(ctx, c, r, tau); }
  // outer triangle of the 'tent' tile (col 3, row 1) in canvas px — scene 05 peels this tube off into the horse outline
  function keyOutline(tau) {
    const cx = 3, cy = 1, x = OX + cx * TILE, y = cy * TILE, n0 = phase(tau, (cx + cy) & 1, []), n = Math.floor(n0), f = n0 - n, u = n % 2 ? 1 - f : f;
    return [[x, y + S], [x + S, y + S], [x + u * S, y]];
  }
  window.BauhausGeo = { TILE, COLS, ROWS, OX, PAL, COLORS: P, drawFills, keyOutline, eio, hash };
})();
