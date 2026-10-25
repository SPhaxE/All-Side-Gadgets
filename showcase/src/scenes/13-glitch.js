// 13 Glitch effect — a bold graphic is torn apart in bursts: slice displacement, RGB split, block corruption, row smears, scanlines, vertical roll
(() => { const E = Engine;
E.register(13, E.postScene({
  hudDark: false,
  draw(c, s, w, h) {
    c.fillStyle = '#0a0a14'; c.fillRect(0, 0, w, h);
    // backdrop gradient circle
    const cx = 960 + 60 * Math.sin(s * .9), cy = 500 + 25 * Math.cos(s * 1.2), R = 330;
    const g = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, '#ff2d95'); g.addColorStop(1, '#2de2ff');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    // grid
    c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2;
    for (let x = ((s * 60) % 120); x < w; x += 120) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 120) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    // giant word
    c.font = '900 440px "Inter","Inter Display",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 10; c.strokeStyle = '#0a0a14'; c.strokeText('GLITCH', 960, 520);
    c.fillStyle = '#ffffff'; c.fillText('GLITCH', 960, 520);
    // caption + bars
    c.font = '700 34px "JetBrains Mono",monospace'; c.textAlign = 'left'; c.fillStyle = '#7dffb0';
    c.fillText('ERR_0x7F  SIGNAL LOST', 150, 160); c.fillText('FRAME ' + String(((Math.floor(s * 30) % 1000) + 1000) % 1000).padStart(3, '0'), 150, 205);
    const bars = ['#ffffff', '#ffe600', '#00e5ff', '#00ff66', '#ff2dff', '#ff2a2a', '#2a3cff'];
    bars.forEach((col, i) => { c.fillStyle = col; c.fillRect(0 + i * (1920 / 7), 880, 1920 / 7 + 1, 70); });
    c.fillStyle = '#fff'; c.fillRect(((s * 480) % 2100) - 90, 975, 180, 16);
  },
  frag: `
float bursts(float s, out float big){
  float e = 0.; big = 0.;
  float T[9] = float[9](-.2,.4,1.0,1.55,2.1,2.6,3.05,3.7,4.3);
  float Dd[9] = float[9](.3,.22,.26,.24,.3,.7,.3,.28,.3);
  for (int i=0;i<9;i++){ float d = s - T[i]; float w = step(0.,d)*step(d,Dd[i]); float amp = (i==5)?1.:.55+.4*hash11(float(i)*3.7); e = max(e, w*amp); if (i==5) big = w; }
  return e;
}
vec3 scene(vec2 fc){
  vec2 uv = fc/uRes; float s = uS;
  float big; float e = bursts(s, big); float e0 = .035;
  float en = max(e, e0);
  float tq = floor(s*30.);
  // vertical hold roll
  if (hash11(tq*1.7+3.) > .86 && e > .05) uv.y = fract(uv.y + e*.1*sin(tq));
  // slice displacement
  float nb = mix(14., 56., e);
  float band = floor(uv.y*nb);
  float hb = hash21(vec2(band, tq));
  float on = step(.62 - .25*e, hb);
  float dx = (hash21(vec2(band*1.3, tq+9.))-.5)*2.*en*.30*on;
  vec2 u = vec2(fract(uv.x + dx), uv.y);
  // row smear
  float hs = hash21(vec2(floor(uv.y*90.), tq+21.));
  if (hs > 1. - .12*e) u.x = fract(hash21(vec2(band, 5.))*.9 + uv.x*.02);
  // block corruption
  vec2 bl = floor(uv*vec2(22.,13.)); float hbk = hash21(bl + tq*1.31);
  if (hbk > 1.-.22*e) u = fract(u + (hash22(bl+tq)-.5)*.5);
  // rgb split
  float sp = (4. + 26.*en)/uRes.x;
  float ch = hash11(tq+7.)>.5 ? 1. : -1.;
  vec3 col;
  col.r = texture(uTex, u + vec2( sp,  .0)*ch).r;
  col.g = texture(uTex, u).g;
  col.b = texture(uTex, u - vec2( sp, -.0006*e*uRes.y/uRes.y)*ch).b;
  // posterize / invert in corrupted blocks
  if (hbk > 1.-.10*e) col = 1. - col;
  if (hbk < .06*e) col = floor(col*3.)/2.;
  // scanlines + noise
  float scan = .88 + .12*sin(fc.y*3.14159);
  col *= scan;
  col += (hash21(fc + tq*3.)-.5)*(.04+.12*e);
  col += vec3(.5,.0,.4)*step(.995, hash21(vec2(floor(fc.y/3.), tq)))*e;
  return col;
}`,
}));
})();
