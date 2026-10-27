// 04 Bauhaus shapes (v2) — 6x3 full-bleed grid; shapes morph vertex-to-vertex (no flips), 4-colour ref palette,
// staggered diagonal/radial/scatter waves, a cross-tile super-graphic at the climax. Geometry: src/lib/bauhaus-geo.js
(() => { const E = Engine, G = BauhausGeo;
E.register(4, E.canvasScene({
  hudDark: false,
  draw(c, s, w, h) {
    c.fillStyle = G.PAL.char; c.fillRect(0, 0, w, h);
    G.drawFills(c, s);                       // tau = scene-local time
    // hairline grid (ref has none, but it keeps the composition taut at 16:9)
    c.strokeStyle = 'rgba(20,20,22,.55)'; c.lineWidth = 2;
    for (let i = 0; i <= G.COLS; i++) { const x = G.OX + i * G.TILE; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let j = 1; j < G.ROWS; j++) { c.beginPath(); c.moveTo(0, j * G.TILE); c.lineTo(w, j * G.TILE); c.stroke(); }
  },
}));
})();
