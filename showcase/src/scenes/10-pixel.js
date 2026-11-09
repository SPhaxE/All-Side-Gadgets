// 10 Pixel art (v2) — Hokusai's Great Wave off Kanagawa as 320x180 pixel art (6x nearest upscale), computed per pixel
// so every edge is crisp. Limited woodblock palette, ordered-dither sky, the great wave rising with striped body and claw
// foam, Fuji in the trough, three boats bobbing at 10fps; at the climax the lip crashes and the foam bursts into pixels,
// which then wheel up into a flock of birds (scene 11's starlings).
(() => { const E = Engine;
const PW = 320, PH = 180;
const C = {
  sky0: [240, 226, 196], sky1: [231, 208, 176], sky2: [222, 186, 160], cloud: [246, 238, 220],
  deep: [22, 33, 66], prus: [30, 64, 112], mid: [62, 104, 150], light: [118, 160, 190], pale: [190, 214, 222],
  foam: [250, 247, 236], fuji: [44, 58, 96], snow: [244, 242, 236], boat: [218, 196, 150], ink: [18, 24, 44],
};
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const hash = (x, y) => { let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
let img = null;
E.register(10, E.canvasScene({
  w: PW, h: PH, nearest: true, hudDark: false,
  setup(c) { img = c.createImageData(PW, PH); },
  draw(c, s) {
    const t = E.stepT(s, 10), d = img.data;
    const rise = E.ease((t + .7) / 2.6), crash = E.ease((t - 3.3) / .7);
    // great wave geometry (pixels): curl centre and radii grow with the rise, the lip drops during the crash
    const cx = 92 + 14 * rise, cy = 86 - 18 * rise + 20 * crash, Ro = 30 + 26 * rise, Ri = Ro * .58;
    const tipA = -0.25 + .62 * crash;                      // angle where the lip ends (radians, 0 = right, +down)
    const sea = (x) => 126 + 3 * Math.sin(x * .11 + t * 2.2) + 2 * Math.sin(x * .27 - t * 3.1);
    const boats = [[150, 0], [205, 1.7], [262, 3.1]];
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const b = B4[(y & 3) * 4 + (x & 3)];
      // ---- sky with dithered bands ----
      const sv = y / 120 + .02 * Math.sin(x * .05);
      let col = sv < .33 + b * .08 ? C.sky0 : sv < .62 + b * .08 ? C.sky1 : C.sky2;
      // clouds drifting
      for (let k = 0; k < 3; k++) { const ox = ((k * 120 + t * 6) % 420) - 60, oy = 22 + k * 13;
        const e = ((x - ox) / 26) ** 2 + ((y - oy) / 5) ** 2, e2 = ((x - ox - 18) / 18) ** 2 + ((y - oy + 3) / 4) ** 2;
        if (e < 1 || e2 < 1) col = C.cloud; }
      // ---- Fuji ----
      const fx = 210, fyTop = 92, slope = (Math.abs(x - fx) < 6 ? .25 : .62);
      const fyy = fyTop + Math.max(0, Math.abs(x - fx) - 4) * slope;
      if (y > fyy && y < 132) col = (y < fyTop + 9 + 2 * Math.sin(x * 1.3) && Math.abs(x - fx) < 18) ? C.snow : C.fuji;
      // ---- sea ----
      const sy = sea(x);
      if (y > sy) {
        const band = Math.floor((y - sy + 2 * Math.sin(x * .2 + t)) / 6);
        col = band % 3 === 0 ? C.mid : band % 3 === 1 ? C.prus : C.deep;
        if (((y - sy) | 0) % 6 === 0 && hash(x >> 2, band + Math.floor(t * 4)) > .55) col = C.light;   // glints on the swell
        // small foreground wave crests
        for (const [wx, wh] of [[250, 18], [300, 12]]) { const dx = x - wx - 14 * Math.sin(t * 1.3); const yy = 160 - wh * Math.exp(-dx * dx / 300);
          if (y > yy && y < yy + 3 && Math.abs(dx) < 26) col = C.foam; }
      }
      // ---- the great wave: body rising from the left + curling lip (annulus) ----
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const yTop = sy - (sy - (cy - Ro)) * Math.pow(clamp((x + 30) / (cx + 30)), 1.6);   // the wave's back, rising from the left
      let xEdge = cx;                                                               // concave face under the curl (hollow tube)
      if (y > cy - Ri && y <= cy) xEdge = cx - Math.sqrt(Math.max(0, Ri * Ri - (y - cy) ** 2));
      else if (y > cy) xEdge = cx - Ri + (y - cy) * .55;
      const inBody = x <= xEdge && y > yTop && y < sy + 30;
      const inLip = r > Ri && r < Ro && a < tipA;
      if (inLip || inBody) {
        const stripe = Math.floor((inLip ? Ro - r : (y - yTop) * .8 + (cx - x) * .25) / 4.5);
        col = stripe % 3 === 0 ? C.light : stripe % 3 === 1 ? C.mid : C.prus;
        if (!inLip && y - yTop > 22) col = (stripe & 1) ? C.prus : C.deep;
      }
      // claw foam on the outer edge of the lip and at the tip
      if (r >= Ro - 3 && r < Ro + 4 && a > -Math.PI * .62 && a < tipA) {
        const n = Math.floor((a + Math.PI) * 16), fr = (a + Math.PI) * 16 - n;
        const claw = 3.5 * Math.sin(fr * Math.PI) * (.6 + .6 * hash(n, 1));
        if (r < Ro + claw) col = C.foam;
      }
      { const tx = cx + Math.cos(tipA) * (Ro + Ri) / 2, ty = cy + Math.sin(tipA) * (Ro + Ri) / 2;
        for (let k = 0; k < 9; k++) { const ang = tipA + .6 + k * .45, rr = 5 + 4 * hash(k, 2);
          const fx2 = tx + Math.cos(ang) * rr * 1.3, fy2 = ty + Math.sin(ang) * rr;
          if ((x - fx2) ** 2 + (y - fy2) ** 2 < 3.5) col = C.foam; } }
      // ---- boats (long oshiokuri-bune) riding the swell ----
      for (const [bx, ph] of boats) {
        const by = sea(bx) - 2 + 3 * Math.sin(t * 2.4 + ph), tilt = .12 * Math.sin(t * 2.4 + ph + 1);
        const lx = x - bx, ly = y - by - lx * tilt;
        if (Math.abs(lx) < 24 - Math.max(0, ly) * 2 && ly > -2 && ly < 3) col = ly < 0 ? C.boat : C.ink;
        if (Math.abs(lx) < 19 && ly >= -5 && ly < -2 && ((lx + 40) % 4) < 2) col = C.snow;      // rowers
      }
      const i = (y * PW + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    // ---- spray: at the crash the foam bursts into pixels; later they wheel up into a flock ----
    if (t > 3.3) {
      const k = t - 3.3;
      for (let n = 0; n < 520; n++) {
        const ang = -Math.PI * (.15 + .7 * hash(n, 5)), sp = 30 + 70 * hash(n, 6);
        const ox = cx + Math.cos(tipA) * Ro, oy = cy + Math.sin(tipA) * Ro * .5;
        let px = ox + Math.cos(ang) * sp * k * .9, py = oy + Math.sin(ang) * sp * k * .9 + 30 * k * k * (1 - E.ease((t - 4.4) / .6));
        const flock = E.ease((t - 4.4) / 1.6);                                    // the spray turns into birds and climbs away
        const fx = 230 + 40 * Math.sin(n * .7 + t) * (1 - flock * .4), fy = 30 + 18 * Math.cos(n * 1.3 + t * 1.5) - 30 * flock;
        px += (fx - px) * flock; py += (fy - py) * flock;
        const X = Math.round(px), Y = Math.round(py);
        const cc = flock > .5 ? C.ink : C.foam, sz = hash(n, 9) > .7 && flock < .5 ? 2 : 1;
        for (let yy = 0; yy < sz; yy++) for (let xx = 0; xx < sz; xx++) { const X2 = X + xx, Y2 = Y + yy; if (X2 >= 0 && Y2 >= 0 && X2 < PW && Y2 < PH) { const i = (Y2 * PW + X2) * 4; d[i] = cc[0]; d[i + 1] = cc[1]; d[i + 2] = cc[2]; } }
      }
    }
    c.putImageData(img, 0, 0);
  },
}));
})();
