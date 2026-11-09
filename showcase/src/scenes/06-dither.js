// 06 Dithering (v2) — the white-horse footage, 12fps, dithered three ways: live Bayer 8x8 in the shader, and true
// Floyd–Steinberg / Atkinson error diffusion pre-computed per frame (tools/build-assets.js). Three-band comparison,
// pixel-size sweep, duotone + freeze-frame at the climax, side panels with live labels.
(() => { const E = Engine, gl = E.gl;
const W = 1920, H = 1080, SQ = 1080, X0 = 420;
let gray, fs, atk, prog, target, labelCv, labelCtx, labelTex, meta;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// source time of the horse clip for scene-local s (frame 0 held during the bridge in; half-beat freeze at the climax)
function horseT(s) { if (s < 0) return 0; if (s < 3.75) return s; if (s < 4.125) return 3.75; return s - .375; }
window.HorseLayout = { X0, SQ };   // scene 05 puts its neon outline exactly here
E.register(6, E.customScene({
  hudDark: false,
  async init() {
    meta = await loadJSON('assets/build/horse/meta.json');
    gray = Footage('assets/build/horse/gray/%03d.png', meta.frames);
    fs = Footage('assets/build/horse/fs/%03d.png', meta.frames, { nearest: true });
    atk = Footage('assets/build/horse/atk/%03d.png', meta.frames, { nearest: true });
    target = E.makeTarget(W, H);
    labelCv = document.createElement('canvas'); labelCv.width = W; labelCv.height = H; labelCtx = labelCv.getContext('2d'); labelTex = E.makeTex(W, H);
    prog = E.program(E.PRELUDE + `
      uniform sampler2D uGray, uFS, uATK, uLab; uniform float uPx, uBands, uDuo, uReveal, uRevealBg, uBulge;
      float bayer8(vec2 p){ ivec2 q = ivec2(mod(p,8.)); int x = q.x, y = q.y, xy = x ^ y;
        int v = ((y&1)<<5)|((xy&1)<<4)|((y&2)<<2)|((xy&2)<<1)|((y&4)>>1)|((xy&4)>>2); return (float(v)+.5)/64.; }
      vec3 pal(float bit){ return mix(mix(vec3(.02), vec3(.95), bit), mix(vec3(.086,.125,.29), vec3(.957,.914,.816), bit), uDuo); }
      // returns bit (0/1) for design-space pixel d inside the square, algorithm a: 0 bayer, 1 FS, 2 atkinson
      float bitAt(vec2 d, int a){
        vec2 q = (d - vec2(${X0}.,0.))/${SQ}.; vec2 uv = vec2(q.x, 1.-q.y);
        if (a == 1) return step(.5, texture(uFS, uv).r);
        if (a == 2) return step(.5, texture(uATK, uv).r);
        float ps = uPx; vec2 cell = floor(d/ps); vec2 cq = ((cell+.5)*ps - vec2(${X0}.,0.))/${SQ}.;
        float L = texture(uGray, vec2(cq.x, 1.-cq.y)).r;
        return step(bayer8(cell), L*1.08-.02);
      }
      vec3 scene(vec2 fc){
        vec2 d = vec2(fc.x, uRes.y-fc.y)*(1920./uRes.x);          // design px, y down
        vec2 q = (d - vec2(${X0}.,0.))/${SQ}.;
        vec3 col;
        if (q.x >= 0. && q.x <= 1.) {
          // bands: top Bayer / middle FS / bottom Atkinson, each wiping in from the left with a stagger
          int a = 0;
          if (uBands > 0.) { float band = floor(q.y*3.); float w = clamp(uBands*1.6 - band*.3, 0., 1.);
            if (q.x < w && band > .5) a = int(band); }
          float bit = bitAt(d, a);
          // bridge-in reveal: ordered-dither fade restricted to the horse first, then the background
          float L = texture(uGray, vec2(q.x, 1.-q.y)).r; float horse = smoothstep(.45,.6,L);
          float th = bayer8(floor(d/2.));
          float shown = horse > .5 ? step(th, uReveal) : step(th, uRevealBg);
          bit *= shown;
          col = pal(bit);
          // band separators
          if (uBands > 0.) { float sep = min(abs(fract(q.y*3.+.5)-.5), 1.)*${SQ}./3.; col = mix(col, vec3(1.,.2,.5), smoothstep(2.,.0,sep)*step(.2,q.y)*step(q.y,.8)*clamp(uBands*3.,0.,1.)); }
          // bridge-out: every white dot swells into a ball (scene 07 turns them into clay pellets)
          if (uBulge > 0.) { float ps = mix(2.,24.,uBulge); vec2 cell = floor(d/ps), f = fract(d/ps)-.5; vec2 cq = ((cell+.5)*ps - vec2(${X0}.,0.))/${SQ}.;
            float Lc = texture(uGray, vec2(cq.x, 1.-cq.y)).r; float r = sqrt(clamp(Lc,0.,1.))*.5;
            float ball = smoothstep(r+.04, r-.04, length(f)); vec3 n = normalize(vec3(f/max(r,.05), .6));
            vec3 bc = pal(1.)*(.55+.45*dot(n, normalize(vec3(-.5,.6,.6)))) + pow(max(dot(n,normalize(vec3(-.4,.5,.8))),0.),20.)*.4;
            col = mix(col, mix(pal(0.), bc, ball), smoothstep(0.,.35,uBulge)); }
        } else {
          // side panels: the horse mirrored, dark, coarse Bayer — ambient fill for 16:9
          vec2 m = vec2(q.x < 0. ? -q.x : 2.-q.x, q.y); float L = texture(uGray, vec2(m.x, 1.-m.y)).r*.28;
          float bit = step(bayer8(floor(d/4.)), L);
          col = pal(bit)*.9 + pal(0.)*.1;
          col *= uRevealBg;
        }
        vec4 lab = texture(uLab, vUv); col = mix(col, lab.rgb, lab.a);
        return col;
      }
      void main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
  },
  async render(s, tg) {
    const i = Math.floor(horseT(s) * meta.fps + 1e-4);
    const [tg0, tf, ta] = await Promise.all([gray.tex(i), fs.tex(i), atk.tex(i)]);
    // ---- labels (canvas): algorithm names, frame counter, palette swatches ----
    const c = labelCtx; c.clearRect(0, 0, W, H);
    const bands = E.ease((s - 1.25) / .7) * (1 - E.ease((s - 2.85) / .35));
    const vis = clamp((s + .2) / .6);
    if (vis > 0) {
      c.globalAlpha = vis; c.fillStyle = '#f2f2f2'; c.textBaseline = 'top';
      c.font = '700 20px "JetBrains Mono"'; c.fillText('DITHER / 1-BIT', 56, 64);
      c.font = '400 16px "JetBrains Mono"'; c.globalAlpha = vis * .6; c.fillText('540 × 540 · 12 FPS · 2 PX', 56, 94);
      c.globalAlpha = vis;
      const names = [['BAYER 8×8', 'ordered'], ['FLOYD–STEINBERG', 'error diffusion'], ['ATKINSON', 'error diffusion · 6/8']];
      if (bands > .02) names.forEach(([n, k], b) => { const y = b * 360 + 160; c.globalAlpha = vis * clamp(bands * 1.6 - b * .3);
        c.font = '800 34px "Inter"'; c.fillText(n, 56, y); c.font = '400 16px "JetBrains Mono"'; c.fillText(k, 58, y + 44); });
      else { c.font = '800 34px "Inter"'; const algo = s > 3.0 && s < 4.5 ? `BAYER · ${Math.round(pxAt(s))} PX` : 'BAYER 8×8'; c.fillText(algo, 56, 520); }
      c.globalAlpha = vis; c.font = '700 20px "JetBrains Mono"'; c.textAlign = 'right';
      c.fillText(`FRAME ${String(i + 1).padStart(3, '0')}/${meta.frames}`, W - 56, 64);
      c.font = '400 16px "JetBrains Mono"'; c.globalAlpha = vis * .6; c.fillText(s >= 3.75 && s < 4.125 ? 'HOLD' : 'PLAY ▶', W - 56, 94);
      const duo = E.ease((s - 3.65) / .2);
      const sw = duo > .5 ? ['#16204a', '#f4e9d0'] : ['#050505', '#f2f2f2'];
      c.globalAlpha = vis; sw.forEach((col, k) => { c.fillStyle = col; c.fillRect(W - 56 - 48 * (2 - k), 130, 40, 40); c.strokeStyle = '#888'; c.strokeRect(W - 56 - 48 * (2 - k), 130, 40, 40); });
      c.textAlign = 'left';
    }
    E.uploadCanvas(labelTex, labelCv);
    E.bindTarget(target); E.setBase(prog, W, H, s, tg);
    E.bindTex(0, tg0, prog.u.uGray); E.bindTex(1, tf, prog.u.uFS); E.bindTex(2, ta, prog.u.uATK); E.bindTex(3, labelTex, prog.u.uLab);
    gl.uniform1f(prog.u.uPx, pxAt(s));
    gl.uniform1f(prog.u.uBands, bands);
    gl.uniform1f(prog.u.uDuo, E.ease((s - 3.65) / .2));
    gl.uniform1f(prog.u.uReveal, clamp((s + .75) / .7));
    gl.uniform1f(prog.u.uRevealBg, clamp((s + .1) / .7));
    gl.uniform1f(prog.u.uBulge, E.ease((s - 4.6) / .9));
    E.drawQuad();
    return target.tex;
  },
}));
function pxAt(s) { return s < 3.0 ? 2 : s < 3.5 ? 2 + 10 * E.ease((s - 3.0) / .5) : s < 4.125 ? 12 : 12 - 9 * E.ease((s - 4.125) / .35); }
})();
