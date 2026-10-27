// Core engine: single WebGL2 context, stateless scenes, cyclic timeline.
(() => {
  const Q = new URLSearchParams(location.search);
  const FPS = +(Q.get('fps') || 60);       // output frame rate; all animation is in seconds, so any fps works
  const MB = Math.max(1, +(Q.get('mb') || 1));          // motion-blur sub-frames per output frame (1 = off)
  const SHUTTER = +(Q.get('shutter') || 0.5);           // fraction of a frame interval the shutter is open
  const NS = 20;               // scenes
  const D = 6.0;               // seconds per scene (8 beats at 80 BPM)
  const HT = 0.75;             // half transition length (s) -> 1.5s transitions centred on each boundary
  const T = NS * D;            // loop length
  const N = Math.round(T * FPS);
  const PHASE = 0.0;           // video t=0 sits exactly on the 20|1 boundary (= middle of the 20->1 bridge), so bar lines align with the loop point
  const W = 1920, H = 1080;

  const SCALE = +(Q.get('scale') || 1);
  const OW = Math.round(W * SCALE), OH = Math.round(H * SCALE);

  const canvas = document.getElementById('main');
  canvas.width = OW; canvas.height = OH;
  canvas.style.width = OW + 'px'; canvas.style.height = OH + 'px';
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) throw new Error('no webgl2');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');

  // ---------- GL helpers ----------
  const VS = `#version 300 es
  in vec2 p; out vec2 vUv; void main(){ vUv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;

  const PRELUDE = `#version 300 es
  precision highp float; precision highp int;
  uniform vec2 uRes; uniform float uS; uniform float uT; uniform float uTau;
  in vec2 vUv; out vec4 fragColor;
  #define PI 3.14159265359
  #define TAU 6.28318530718
  float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
  float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
  vec3 hash31(float p){ vec3 p3 = fract(vec3(p)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x), mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y); }
  vec2 grad2(vec2 i){ float a = hash21(i)*TAU; return vec2(cos(a),sin(a)); }
  float gnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.-15.)+10.);
    return mix(mix(dot(grad2(i),f), dot(grad2(i+vec2(1,0)),f-vec2(1,0)),u.x),
               mix(dot(grad2(i+vec2(0,1)),f-vec2(0,1)), dot(grad2(i+vec2(1,1)),f-vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; mat2 m = mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ s += a*gnoise(p); p = m*p; a *= .5; } return s; }
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(TAU*(c*t+d)); }
  float sat(float x){ return clamp(x,0.,1.); }
  float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
  vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.), clamp(p-1.,0.,1.), c.y); }
  float ease(float x){ x = clamp(x,0.,1.); return x*x*(3.-2.*x); }
  float easeO(float x){ x = clamp(x,0.,1.); return 1.-pow(1.-x,3.); }
  `;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      throw new Error('Shader compile error: ' + log + '\n' + lines.slice(0, 6000));
    }
    return s;
  }
  function program(fs, vs = VS) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(pr, 0, 'p');
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(pr));
    const u = {};
    const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(pr, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(pr, info.name); }
    return { pr, u };
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const vao = gl.createVertexArray(); // for point/instanced scenes
  function drawQuad() { gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  function makeTex(w, h, opts = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, opts.internal || gl.RGBA8, w, h, 0, gl.RGBA, opts.type || gl.UNSIGNED_BYTE, null);
    const f = opts.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    return t;
  }
  function makeTarget(w, h, opts) {
    const tex = makeTex(w, h, opts);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }
  function bindTarget(t) {
    if (t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, OW, OH); }
  }
  function uploadCanvas(tex, cv) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  function setBase(p, w, h, s, tg) {
    gl.useProgram(p.pr);
    if (p.u.uRes) gl.uniform2f(p.u.uRes, w, h);
    if (p.u.uS) gl.uniform1f(p.u.uS, s);
    if (p.u.uT) gl.uniform1f(p.u.uT, tg);
    if (p.u.uTau) gl.uniform1f(p.u.uTau, (tg / T) * Math.PI * 2);
  }
  function bindTex(unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit);
  }

  // ---------- scene factories ----------
  // shader scene: frag defines `vec3 scene(vec2 fc)` (fc = pixel coords in the scene's own resolution)
  function shaderScene(def) {
    const w = def.w || W, h = def.h || H;
    let prog, target;
    return {
      ...def,
      init() {
        prog = program(PRELUDE + def.frag + `\nvoid main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
        target = makeTarget(w, h, { nearest: !!def.nearest });
      },
      render(s, tg) {
        bindTarget(target); setBase(prog, w, h, s, tg);
        if (def.uniforms) def.uniforms(prog, s, tg, gl);
        drawQuad();
        return target.tex;
      },
    };
  }
  // canvas scene: draw(ctx, s, w, h) paints with Canvas2D
  function canvasScene(def) {
    const w = def.w || W, h = def.h || H;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: false });
    let tex;
    return {
      ...def,
      init() { tex = makeTex(w, h, { nearest: !!def.nearest }); if (def.setup) def.setup(ctx, w, h); },
      render(s, tg) {
        ctx.save(); def.draw(ctx, s, w, h, tg); ctx.restore();
        uploadCanvas(tex, cv);
        return tex;
      },
    };
  }
  // post scene: Canvas2D layer is uploaded as `uTex`, then a fragment shader composes/post-processes it
  function postScene(def) {
    const w = def.w || W, h = def.h || H;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    let prog, target, tex;
    return {
      ...def,
      init() {
        prog = program(PRELUDE + 'uniform sampler2D uTex;\n' + def.frag + `\nvoid main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
        target = makeTarget(w, h); tex = makeTex(w, h);
        if (def.setup) def.setup(ctx, w, h);
      },
      render(s, tg) {
        ctx.save(); ctx.clearRect(0, 0, w, h); def.draw(ctx, s, w, h, tg); ctx.restore();
        uploadCanvas(tex, cv);
        bindTarget(target); setBase(prog, w, h, s, tg); bindTex(0, tex, prog.u.uTex);
        if (def.uniforms) def.uniforms(prog, s, tg, gl);
        drawQuad();
        return target.tex;
      },
    };
  }
  // custom scene: provide init() and render(s,tg)->texture
  const customScene = def => def;

  // ---------- registry ----------
  const SCENES = [];
  function register(i, scene) { SCENES[i - 1] = scene; }

  // ---------- transitions ----------
  let transProg, hudProg, hudTex;
  const hudCv = document.createElement('canvas'); hudCv.width = OW; hudCv.height = OH;
  const hudCtx = hudCv.getContext('2d');

  // ---------- bridges (per-boundary transitions) ----------
  // Engine.bridge(type, def), type = index of the outgoing scene (0-based; 19 = the 20->1 loop seam).
  //   def.glsl   : texture re-interpretation. GLSL defining `vec3 transition(vec2 uv, float p)`; helpers A(uv), B(uv),
  //                uniforms uSA/uSB (scene-local times), uT, uAtlas. Compiled into its own program.
  //   def.render : full takeover. async render(ctx) -> texture, ctx = { p, praw, sA, sB, tg, renderA(), renderB(), target }.
  //                Use it when one object must carry straight through the boundary (same shader, same geometry).
  const BRIDGES = [];
  function bridge(type, def) { BRIDGES[type] = def; }
  const BRIDGE_HEAD = `
      uniform sampler2D uA; uniform sampler2D uB; uniform float uP; uniform float uSA; uniform float uSB; uniform sampler2D uAtlas;
      vec3 A(vec2 uv){ return texture(uA, uv).rgb; }
      vec3 B(vec2 uv){ return texture(uB, uv).rgb; }
  `;
  let finalProg, legacyProg, transT;
  async function initCore() {
    finalProg = program(PRELUDE + `
      uniform sampler2D uBase; uniform sampler2D uHud; uniform float uHudOn; uniform float uFrame;
      void main(){
        vec3 c = texture(uBase, vUv).rgb;
        vec4 h = texture(uHud, vUv);
        c = mix(c, h.rgb, h.a * uHudOn);
        c += (hash21(gl_FragCoord.xy + uFrame*1.37) - .5) / 255.;
        fragColor = vec4(c, 1.);
      }`);
    if (window.TRANSITION_GLSL) legacyProg = program(PRELUDE + BRIDGE_HEAD + `uniform int uType;
` + window.TRANSITION_GLSL + `
      void main(){ fragColor = vec4(uP <= 0. ? A(vUv) : (uP >= 1. ? B(vUv) : transition(uType, vUv, uP)), 1.); }`);
    BRIDGES.forEach((b, i) => {
      if (!b) return;
      if (b.glsl) b.prog = program(PRELUDE + BRIDGE_HEAD + b.glsl + `
      void main(){ fragColor = vec4(clamp(uP <= 0. ? A(vUv) : (uP >= 1. ? B(vUv) : transition(vUv, uP)), 0., 1.), 1.); }`);
      if (b.init) b.init();
    });
    transT = makeTarget(OW, OH);
    hudTex = makeTex(OW, OH);
    for (const sc of SCENES) await sc.init();
  }
  async function runBridge(c, tg, texA, texB) {
    const b = BRIDGES[c.type], p = ease(c.p);
    if (b && b.render) return b.render({ p, praw: c.p, sA: c.A.s, sB: c.B.s, tg, target: transT,
      renderA: () => SCENES[c.A.k].render(c.A.s, tg), renderB: () => SCENES[c.B.k].render(c.B.s, tg) });
    texA = texA || await SCENES[c.A.k].render(c.A.s, tg);
    texB = texB || await SCENES[c.B.k].render(c.B.s, tg);
    const pr = (b && b.prog) || legacyProg;
    bindTarget(transT); setBase(pr, OW, OH, 0, tg);
    bindTex(0, texA, pr.u.uA); bindTex(1, texB, pr.u.uB); bindTex(3, E_.atlas || texA, pr.u.uAtlas);
    gl.uniform1f(pr.u.uP, p);
    if (pr.u.uSA) gl.uniform1f(pr.u.uSA, c.A.s);
    if (pr.u.uSB) gl.uniform1f(pr.u.uSB, c.B.s);
    if (pr.u.uType) gl.uniform1i(pr.u.uType, c.type);
    drawQuad();
    return transT.tex;
  }

  // wrap seconds into [-T/2, T/2)
  const wrap = x => ((x + T / 2) % T + T) % T - T / 2;

  // ---------- HUD ----------
  const NAMES = [
    ['Liquid morph', '液态变形'], ['ASCII art', '字符画'], ['Holographic foil', '全息箔'], ['Bauhaus shapes', '包豪斯几何'],
    ['Neon glow', '霓虹辉光'], ['Dithering', '抖动'], ['Clay 3D', '黏土 3D'], ['Halftone dots', '半调网点'],
    ['Kinetic typography', '动态字体'], ['Pixel art', '像素画'], ['Particle swarm', '粒子群'], ['Risograph print', '孔版印刷'],
    ['Glitch effect', '故障效果'], ['Topographic lines', '等高线'], ['Glassmorphism', '玻璃拟态'], ['Paper cutout', '剪纸'],
    ['Vaporwave grid', '蒸汽波网格'], ['Flow fields', '流场'], ['Metaballs', '融球'], ['Ray-marched fractals', '光线步进分形'],
  ];
  const clamp01 = x => Math.min(1, Math.max(0, x));
  const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const ease = x => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };   // smootherstep

  // theme: 0 = light text (dark scene), 1 = dark text (light scene)
  function drawHud(tg, idxFloat, themeMix) {
    const c = hudCtx; const k = OW / W;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.clearRect(0, 0, W, H);
    const v = Math.round(255 * (1 - themeMix) + 18 * themeMix);
    const col = `rgb(${v},${v},${v})`;
    const shadow = themeMix > .5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.45)';
    // current index along a circular timeline (continuous, eased per transition)
    const base = Math.floor(idxFloat), fr = idxFloat - base;
    const cur = ((base % NS) + NS) % NS, nxt = (cur + 1) % NS;
    c.fillStyle = col; c.strokeStyle = col; c.shadowColor = shadow; c.shadowBlur = 12;

    // --- label (bottom-left): sliding vertical strip, wraps seamlessly ---
    const lx = 72, ly = H - 96;
    c.save();
    c.beginPath(); c.rect(lx - 6, ly - 120, 900, 200); c.clip();
    const slide = fr; // 0..1 between cur and nxt
    for (const [i, off] of [[cur, -slide], [nxt, 1 - slide]]) {
      const y = ly + off * 110;
      const a = 1 - Math.abs(off);
      c.globalAlpha = Math.max(0, a);
      c.font = '800 96px "Inter Display","Inter",sans-serif';
      c.textBaseline = 'alphabetic';
      c.fillText(String(i + 1).padStart(2, '0'), lx, y);
      c.font = '700 40px "Inter",sans-serif';
      c.fillText(NAMES[i][0], lx + 150, y - 40);
      c.font = '500 26px "WenQuanYi Zen Hei","Inter",sans-serif';
      c.globalAlpha = Math.max(0, a) * .8;
      c.fillText(NAMES[i][1], lx + 152, y - 2);
    }
    c.restore();

    // --- dial (bottom-right): 20 ticks on a ring, pointer glides ---
    const cx = W - 150, cy = H - 150, R = 78;
    c.globalAlpha = 1;
    for (let i = 0; i < NS; i++) {
      const a = (i / NS) * Math.PI * 2 - Math.PI / 2;
      const d = Math.min(Math.abs(i - idxFloat), NS - Math.abs(i - idxFloat)); // circular distance
      const on = Math.max(0, 1 - d);
      c.globalAlpha = .35 + .65 * on;
      c.lineWidth = 3 + 3 * on; c.lineCap = 'round';
      const r0 = R - 8 - 8 * on, r1 = R + 6 + 6 * on;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
    }
    c.globalAlpha = 1;
    c.font = '800 44px "JetBrains Mono",monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const near = fr < .5 ? cur : nxt;
    c.fillText(String(near + 1).padStart(2, '0'), cx, cy + 2);
    c.textAlign = 'left';

    // --- top-left tag ---
    c.shadowBlur = 8;
    c.font = '600 22px "JetBrains Mono",monospace'; c.globalAlpha = .85;
    c.fillText('VISUAL FX REEL  ·  20 EFFECTS', 72, 70);
    c.globalAlpha = 1;
    // top-right: rotating loop mark (periodic in T)
    const rx = W - 72, ry = 62;
    c.save(); c.translate(rx - 10, ry); c.rotate((tg / T) * Math.PI * 2 * 4);
    c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 1.5); c.stroke(); c.restore();
    c.shadowBlur = 0;
    uploadCanvas(hudTex, hudCv);
  }

  // ---------- frame render ----------
  const TRANSITION_COUNT = NS;
  let hudOn = Q.get('hud') !== '0';
  function composite(tg) {
    // find scene indices
    let p = 0;
    // Determine current "primary" scene and whether a transition is active
    let k0 = Math.floor((((tg % T) + T) % T) / D);
    const s0 = wrap(tg - k0 * D);
    let prim, sec = null;
    if (s0 < HT) {            // head of k0 overlapped with tail of k0-1
      const kp = (k0 + NS - 1) % NS;
      sec = { k: kp, s: wrap(tg - kp * D) }; prim = { k: k0, s: s0 };
      p = 0.5 + s0 / (2 * HT);   // progress prev->cur
      return { A: sec, B: prim, p, type: kp };
    } else if (s0 > D - HT) { // tail of k0 overlapped with head of k0+1
      const kn = (k0 + 1) % NS;
      return { A: { k: k0, s: s0 }, B: { k: kn, s: wrap(tg - kn * D) }, p: 0.5 + (s0 - D) / (2 * HT), type: k0 };
    }
    return { A: { k: k0, s: s0 }, B: null, p: 0, type: k0 };
  }

  // draw the full composite for global time tg into `target` (null = canvas)
  async function drawComposite(tg, fNoise, target) {
    const c = composite(tg);
    const A = SCENES[c.A.k];
    const base = c.B ? await runBridge(c, tg) : await A.render(c.A.s, tg);
    // hud index: stays on scene k until the bridge moves it
    const idxFloat = c.B ? c.A.k + smooth((c.p - .25) / .5) : c.A.k;
    const themeA = A.hudDark ? 1 : 0, themeB = c.B ? (SCENES[c.B.k].hudDark ? 1 : 0) : themeA;
    const themeMix = themeA + (themeB - themeA) * smooth((c.p - .25) / .5);
    drawHud(tg, idxFloat, themeMix);
    bindTarget(target);
    setBase(finalProg, OW, OH, 0, tg);
    bindTex(0, base, finalProg.u.uBase); bindTex(2, hudTex, finalProg.u.uHud);
    gl.uniform1f(finalProg.u.uHudOn, hudOn ? 1 : 0);
    gl.uniform1f(finalProg.u.uFrame, fNoise);
    drawQuad();
    return c;
  }

  // motion blur: average MB sub-frames spread over the shutter interval in a float buffer
  let accT, subT, blitProg;
  function initAccum() {
    accT = makeTarget(OW, OH, { internal: gl.RGBA16F, type: gl.HALF_FLOAT });
    subT = makeTarget(OW, OH);
    blitProg = program(PRELUDE + `uniform sampler2D uTex; uniform float uW; void main(){ fragColor = vec4(texture(uTex, vUv).rgb*uW, 1.); }`);
  }
  function blit(tex, target, w, additive) {
    bindTarget(target); gl.useProgram(blitProg.pr); bindTex(0, tex, blitProg.u.uTex); gl.uniform1f(blitProg.u.uW, w);
    if (additive) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
    drawQuad(); gl.disable(gl.BLEND);
  }

  async function renderFrame(f) {
    f = ((f % N) + N) % N;
    let c;
    if (MB <= 1) c = await drawComposite(f / FPS + PHASE, f, null);
    else {
      if (!accT) initAccum();
      bindTarget(accT); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      for (let i = 0; i < MB; i++) {
        const tg = (f + SHUTTER * ((i + .5) / MB - .5)) / FPS + PHASE;
        c = await drawComposite(tg, f, subT);
        blit(subT.tex, accT, 1 / MB, true);
      }
      blit(accT.tex, null, 1, false);
    }
    gl.finish();
    document.title = `f${f} s${c.A.k + 1}${c.B ? '->' + (c.B.k + 1) : ''}`;
  }

  // raw RGBA of the canvas (bottom-up rows) for the GPU render pipeline
  let readBuf;
  function readFrame() {
    if (!readBuf) readBuf = new Uint8Array(OW * OH * 4);
    bindTarget(null); gl.readPixels(0, 0, OW, OH, gl.RGBA, gl.UNSIGNED_BYTE, readBuf);
    return readBuf;
  }

  // debug: show one scene alone at local time s (hud off)
  async function renderScene(k, s) {
    const tg = (k - 1) * D + s;
    const tex = await SCENES[k - 1].render(s, tg);
    drawHud(tg, k - 1, SCENES[k - 1].hudDark ? 1 : 0);
    bindTarget(null); setBase(finalProg, OW, OH, 0, tg);
    bindTex(0, tex, finalProg.u.uBase); bindTex(2, hudTex, finalProg.u.uHud);
    gl.uniform1f(finalProg.u.uHudOn, hudOn ? 1 : 0); gl.uniform1f(finalProg.u.uFrame, 0);
    drawQuad(); gl.finish();
  }

  // quantise time to a stop-motion / footage rate (integer-safe at 60fps: 12fps = 5 frames, 10fps = 6 frames)
  const stepT = (t, rate) => Math.floor(t * rate + 1e-4) / rate;

  const E_ = window.Engine = {
    FPS, MB, NS, D, HT, T, N, PHASE, W, H, OW, OH, gl, canvas, PRELUDE, NAMES,
    program, makeTex, makeTarget, bindTarget, uploadCanvas, setBase, bindTex, drawQuad,
    shaderScene, canvasScene, postScene, customScene, register, SCENES, wrap, bridge, BRIDGES, stepT, ease, smooth,
  };
  window.renderFrame = renderFrame;
  window.renderScene = renderScene;
  window.readFrame = readFrame;
  window.initEngine = async () => {
    await Promise.all([
      document.fonts.load('800 96px "Inter Display"'), document.fonts.load('700 40px "Inter"'),
      document.fonts.load('600 22px "JetBrains Mono"'), document.fonts.load('500 26px "WenQuanYi Zen Hei"'),
      document.fonts.load('900 200px "Inter"'),
    ]).catch(() => { });
    await Promise.all([...document.fonts].map(f => f.load().catch(() => { })));   // bundled faces (assets/fonts): load every weight up front
    await document.fonts.ready;
    await initCore();
    window.__ready = true;
    if (Q.get('play') !== null) startPlayer();
  };

  // ---------- realtime player (open index.html?play in a GPU browser) ----------
  // space: pause  ←/→: previous/next effect  ,/.: step one frame  F: fullscreen
  function startPlayer() {
    const info = document.createElement('div');
    info.style.cssText = 'position:fixed;left:8px;bottom:6px;font:12px JetBrains Mono,monospace;color:#fff;background:#0008;padding:2px 6px;z-index:9';
    document.body.appendChild(info);
    let playing = true, f0 = 0, t0 = performance.now(), cur = 0, busy = false, last = performance.now(), fpsAvg = 0;
    const seek = f => { f0 = ((Math.round(f) % N) + N) % N; t0 = performance.now(); cur = f0; };
    addEventListener('keydown', e => {
      if (e.key === ' ') { playing = !playing; seek(cur); }
      else if (e.key === 'ArrowRight') seek((Math.floor((cur / FPS + PHASE) / D) + 1) * D * FPS - PHASE * FPS);
      else if (e.key === 'ArrowLeft') seek((Math.floor((cur / FPS + PHASE) / D) - 1) * D * FPS - PHASE * FPS);
      else if (e.key === '.') { playing = false; seek(cur + 1); }
      else if (e.key === ',') { playing = false; seek(cur - 1); }
      else if (e.key === 'f' || e.key === 'F') document.documentElement.requestFullscreen?.();
    });
    const loop = async () => {
      if (!busy) {
        busy = true;
        if (playing) cur = (f0 + Math.floor((performance.now() - t0) / 1000 * FPS)) % N;
        await renderFrame(cur);
        const now = performance.now(); fpsAvg = fpsAvg * .9 + (1000 / Math.max(1, now - last)) * .1; last = now;
        const t = cur / FPS; info.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}  f${cur}/${N}  ${document.title.split(' ')[1]}  ${fpsAvg.toFixed(0)} fps${playing ? '' : '  [paused]'}`;
        busy = false;
      }
      requestAnimationFrame(loop);
    };
    canvas.style.width = '100vw'; canvas.style.height = '56.25vw'; canvas.style.maxHeight = '100vh';
    requestAnimationFrame(loop);
  }
})();
