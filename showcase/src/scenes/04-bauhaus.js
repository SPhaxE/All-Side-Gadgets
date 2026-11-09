// 04 Bauhaus shapes (v2) — 6x3 full-bleed grid; shapes morph vertex-to-vertex (no flips), 4-colour ref palette,
// staggered diagonal/radial/scatter waves, a cross-tile super-graphic at the climax. Geometry: src/lib/bauhaus-geo.js
(() => { const E = Engine, G = BauhausGeo;
E.register(4, E.canvasScene({
  hudDark: false,
  draw(c, s, w, h) {
    c.fillStyle = G.PAL.char; c.fillRect(0, 0, w, h);
    G.drawFills(c, s);                       // tau = scene-local time
  },
}));
})();
