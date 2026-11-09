// 13 Glitch effect (v2) — designed glitch on the hypercar footage. Clean product shots in a vertical triptych
// (headlight / wheel / wing), cut on the beat with designed insert frames: scan-lines pushed up by the car's profile,
// a binary pixel silhouette, a glowing outline, a typed data HUD, RGB tear; a rapid 4-insert burst at the climax.
// The intra-scene hard cuts are the effect's own language; the boundaries to 12 and 14 stay continuous.
(() => { const E = Engine, gl = E.gl;
const W = 1920, H = 1080;
// side profile of a wedge hypercar (normalised: x 0..1 nose->tail, y 0..1 ground->roof)
const PROFILE = [[0, .16], [.03, .30], [.18, .36], [.36, .47], [.47, .70], [.60, .74], [.72, .66], [.86, .58], [.94, .62], [1, .60], [1, .28], [.97, .16],
  [.88, .14], [.86, .30], [.83, .34], [.75, .34], [.72, .26], [.70, .14], [.30, .14], [.28, .28], [.25, .33], [.16, .33], [.13, .26], [.12, .14]];
let prog, target, hud, hudCtx, hudTex, sil, silCtx, silTex, panels;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// insert schedule: [start, end, mode]; 0 = clean triptych, 1 scan-lines, 2 binary silhouette, 3 glow outline, 4 inverted, 5 mosaic, 6 RGB tear
const CUTS = [[-9, .8, 1], [.8, 1.6, 0], [1.6, 1.97, 2], [1.97, 3.37, 0], [3.37, 3.56, 3], [3.56, 3.75, 4], [3.75, 3.94, 5], [3.94, 4.12, 6], [4.12, 4.85, 0], [4.85, 9, 1]];
const modeAt = s => CUTS.find(c => s >= c[0] && s < c[1])[2];
E.register(13, E.customScene({
  hudDark: false,
  init() {
    target = E.makeTarget(W, H);
    panels = [Footage('assets/build/car/rgb/%03d.jpg', 482), Footage('assets/build/car/rgb/%03d.jpg', 482), Footage('assets/build/car/rgb/%03d.jpg', 482)];
    hud = document.createElement('canvas'); hud.width = W; hud.height = H; hudCtx = hud.getContext('2d'); hudTex = E.makeTex(W, H);
    sil = document.createElement('canvas'); sil.width = W; sil.height = H; silCtx = sil.getContext('2d'); silTex = E.makeTex(W, H);
    // silhouette mask, drawn once: car profile centred, 1500px long
    const c = silCtx; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.beginPath();
    PROFILE.forEach(([x, y], i) => { const X = 210 + x * 1500, Y = 760 - y * 560; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.fill();
    c.fillStyle = '#000'; for (const wx of [.205, .79]) { c.beginPath(); c.arc(210 + wx * 1500, 760 - .14 * 560, 92, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fff'; for (const wx of [.205, .79]) { c.beginPath(); c.arc(210 + wx * 1500, 760 - .14 * 560, 80, 0, Math.PI * 2); c.fill(); }
    E.uploadCanvas(silTex, sil);
    prog = E.program(E.PRELUDE + `
      uniform sampler2D uP0, uP1, uP2, uSil, uHud; uniform float uMode, uRise, uTear, uScan;
      vec3 panel(vec2 d){                       // triptych: three 640px columns, each a cropped portrait shot
        float k = floor(d.x/640.); vec2 l = vec2(mod(d.x,640.)/640., d.y/1080.);
        vec2 uv = vec2(l.x, 1. - (l.y*(1080./1138.) + (1.-1080./1138.)*.5));
        vec3 c = k < .5 ? texture(uP0, uv).rgb : (k < 1.5 ? texture(uP1, uv).rgb : texture(uP2, uv).rgb);
        c = pow(c, vec3(.9))*1.15;
        float sep = smoothstep(3., 0., abs(mod(d.x+2.,640.)-2.));
        return mix(c, vec3(0.), sep*step(1.,d.x)*step(d.x,1918.));
      }
      float silAt(vec2 d){ return texture(uSil, vec2(d.x/1920., 1.-d.y/1080.)).r; }
      vec3 scene(vec2 fc){
        vec2 d = vec2(fc.x, uRes.y-fc.y)*(1920./uRes.x);
        float s = uS; int m = int(uMode + .5);
        vec3 col;
        if (m == 1) {                           // scan-lines pushed up by the profile; at the end they start to roll like terrain
          col = vec3(0.);
          for (int k=-2;k<=8;k++){
            float y0 = floor(d.y/22.)*22. + float(k)*22.;
            float push = 130.*silAt(vec2(d.x, y0)) + uRise*(70.*sin(d.x*.006 + y0*.02 + s*2.) + 45.*sin(d.x*.013 - s*3.1 + y0*.05))*smoothstep(1080.,300.,y0);
            float y = y0 - push;
            col = max(col, vec3(1.)*smoothstep(3.2, 1.6, abs(d.y - y)));
          }
        } else if (m == 2 || m == 4) {           // binary pixel silhouette (and its inverse)
          vec2 cell = floor(d/24.)*24. + 12.;
          float v = step(.5, silAt(cell));
          col = vec3(m == 2 ? 1. - v : v);
        } else if (m == 3) {                     // glowing outline on deep teal
          float e = 0.; for (int i=0;i<8;i++){ float a = float(i)*.785; e += abs(silAt(d + vec2(cos(a),sin(a))*4.) - silAt(d)); }
          float g = 0.; for (int i=0;i<12;i++){ float a = float(i)*.5236; g += silAt(d + vec2(cos(a),sin(a))*28.); } g = g/12.*(1.-silAt(d));
          col = vec3(.02,.12,.10) + vec3(.2,1.,.75)*(min(e,1.)*1.2 + g*.55);
          col *= .85 + .15*sin(d.y*1.6);
        } else if (m == 5) {                     // coarse mosaic of the triptych
          vec2 cell = floor(d/48.)*48. + 24.; col = panel(cell); col = floor(col*5.)/5.;
        } else {
          col = panel(d);
          if (m == 6) { float band = floor(d.y/36.); float off = (hash11(band + floor(s*30.)) - .5)*220.*step(.4, hash11(band*3.1));
            col = vec3(panel(d + vec2(off + 14., 0.)).r, panel(d + vec2(off, 0.)).g, panel(d + vec2(off - 14., 0.)).b); }
          col += (hash21(d + floor(s*30.)) - .5)*.035;
        }
        // light tracking tear on every cut (first 2 frames)
        if (uTear > 0.) { float band = step(.7, hash11(floor(d.y/14.) + floor(s*60.))); col = mix(col, col.gbr, band*uTear); }
        vec4 h = texture(uHud, vec2(d.x/1920., 1.-d.y/1080.)); col = mix(col, h.rgb, h.a);
        return col;
      }
      void main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
  },
  async render(s, tg) {
    // each panel plays a slow, ping-ponged window of its shot (headlight / wheel / wing)
    const pp = (a, b, rate) => { const L = b - a, x = Math.max(0, s + .75) * rate * 30; const k = x % (2 * L); return a + (k < L ? k : 2 * L - k); };
    const fr = [pp(92, 146, .5), pp(196, 246, .45), pp(399, 413, .25)].map(v => Math.floor(v));
    const [t0, t1, t2] = await Promise.all(panels.map((p, i) => p.tex(fr[i])));
    // HUD
    const c = hudCtx; c.clearRect(0, 0, W, H); const m = modeAt(s);
    if (m === 0 && s > 1.97 && s < 3.37) {
      const typ = (str, t0) => str.slice(0, Math.max(0, Math.floor((s - t0) * 42)));
      c.fillStyle = '#e8fff6'; c.font = '600 20px "JetBrains Mono"';
      [['PROTOTYPE · HYPERCAR', 2.05], ['GPS 45.0703N  7.6869E', 2.2], ['ELEV 239 M · FREQ 5.5 MHZ', 2.35], ['SPEED 000 KM/H', 2.5]].forEach(([str, t0], i) => c.fillText(typ(str, t0), 676, 120 + i * 30));
      c.font = '800 64px "Inter"'; const tt = typ('TYPE', 2.6); c.fillText(tt, 676, 330);
      if (s > 2.75) { c.fillRect(840, 270, 88, 76); c.fillStyle = '#000'; c.font = '700 60px "JetBrains Mono"'; c.fillText('01', 846, 330); }
    }
    E.uploadCanvas(hudTex, hud);
    E.bindTarget(target); E.setBase(prog, W, H, s, tg);
    E.bindTex(0, t0, prog.u.uP0); E.bindTex(1, t1, prog.u.uP1); E.bindTex(2, t2, prog.u.uP2); E.bindTex(3, silTex, prog.u.uSil); E.bindTex(4, hudTex, prog.u.uHud);
    gl.uniform1f(prog.u.uMode, m);
    gl.uniform1f(prog.u.uRise, E.ease((s - 4.85) / 1.4));
    const cutT = CUTS.filter(cc => cc[0] > -1 && cc[0] <= s).map(cc => cc[0]).pop() ?? -9;
    gl.uniform1f(prog.u.uTear, s - cutT < 2 / 60 && m !== 1 ? 1 : 0);
    E.drawQuad();
    return target.tex;
  },
}));
})();
