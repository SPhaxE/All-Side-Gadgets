// 05 Neon glow (v2) — the SAME Bauhaus geometry (continuing its morph) as neon tubes on a dark brick wall:
// white-hot cores, two-stage halos, per-tile ignition, camera pull-back to a rainy street with wet-floor reflection,
// synchronized colour flash at the climax, then tubes die one by one. tau = 6 + s continues scene 04's clock.
(() => { const E = Engine, G = BauhausGeo, gl = E.gl;
const W = 1920, H = 1080;
let cv, ctx, tubeTex, prog, target, blurA, blurB;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function light(s) {
  return t => {
    const tile = t.r * G.COLS + t.c, d = G.hash(tile * 3.7) * .5;
    const on0 = -.62 + d, age = s - on0;
    if (age < 0) return 0;
    let L = age < .42 ? (G.hash(Math.floor(age * 22) + tile * 17) > .45 ? .9 : .12) : 1;          // ignition stutter
    const keep = t.c === 3 && t.r === 1;
    const off0 = 4.05 + G.hash(tile * 9.1) * .55;                                                 // die one by one
    if (!keep && s > off0) L *= s - off0 < .12 ? (G.hash(Math.floor(s * 40) + tile) > .5 ? .6 : 0) : 0;
    if (keep) L *= 1 - clamp((s - 4.78) / .12);
    return L;
  };
}
let edgeProg, edgeT, lightArr = new Float32Array(18), lineCv, lineCtx, lineTex, horse;
function resample(P, n) {                 // closed polyline -> n points evenly spaced by arc length
  const L = [0]; for (let i = 1; i <= P.length; i++) { const a = P[i - 1], b = P[i % P.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const out = []; let j = 0; for (let i = 0; i < n; i++) { const t = L[L.length - 1] * i / n; while (L[j + 1] < t) j++; const a = P[j], b = P[(j + 1) % P.length], f = (t - L[j]) / Math.max(1e-6, L[j + 1] - L[j]); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
  return out;
}

E.register(5, E.customScene({
  hudDark: false,
  async init() {
    horse = (await loadJSON('assets/build/horse/meta.json')).outline;
    lineCv = document.createElement('canvas'); lineCv.width = W; lineCv.height = H; lineCtx = lineCv.getContext('2d'); lineTex = E.makeTex(W, H);
    cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
    tubeTex = E.makeTex(W, H); target = E.makeTarget(W, H); edgeT = E.makeTarget(W, H);
    blurA = Post.makeBlur(W / 2, H / 2); blurB = Post.makeBlur(W / 8, H / 8);
    // tubes = colour edges of the Bauhaus fills (same pixels scene 04 shows), lit per tile
    edgeProg = E.program(E.PRELUDE + `
      uniform sampler2D uFill, uLine; uniform float uLight[18];
      vec3 neonOf(vec3 c){
        vec3 P[4] = vec3[4](vec3(.941,.478,.388), vec3(.706,.576,1.), vec3(.416,.271,.761), vec3(.173,.173,.180));
        vec3 Nn[4] = vec3[4](vec3(1.,.40,.26), vec3(.80,.52,1.), vec3(.58,.30,1.), vec3(.30,.92,1.));
        int bi = 0; float bd = 9.; for (int i=0;i<4;i++){ float d = distance(c,P[i]); if (d<bd){ bd = d; bi = i; } } return Nn[bi];
      }
      void main(){
        vec2 uv = vUv; vec2 px = 1./uRes; vec3 c0 = texture(uFill, uv).rgb;
        float core = 0., soft = 0.; vec3 col = vec3(0.);
        for (int k=0;k<8;k++){
          float a = float(k)*.7853982; vec2 d = vec2(cos(a),sin(a));
          vec3 c1 = texture(uFill, uv + d*2.5*px).rgb, c2 = texture(uFill, uv + d*5.5*px).rgb;
          if (distance(c1,c0) > .12){ core = 1.; col = max(col, max(neonOf(c0), neonOf(c1))); }
          if (distance(c2,c0) > .12){ soft = max(soft,.55); col = max(col, max(neonOf(c0), neonOf(c2))); }
        }
        vec2 cp = vec2(gl_FragCoord.x/uRes.x*1920. + 120., (1.-uv.y)*1080.);
        int ti = int(clamp(floor(cp.y/360.),0.,2.))*6 + int(clamp(floor(cp.x/360.),0.,5.));
        float L = uLight[ti];
        fragColor = vec4(col*max(core,soft)*L + texture(uLine, uv).rgb, 1.);
      }`);
    prog = E.program(E.PRELUDE + `
      uniform sampler2D uTube, uHalo, uGlow; uniform float uZoom, uWall, uFlash, uRain;
      vec3 brick(vec2 p){
        vec2 q = p*vec2(7.,17.); float row = floor(q.y); q.x += mod(row,2.)*.5; vec2 f = fract(q), id = vec2(floor(q.x), row);
        float mortar = 1. - smoothstep(.03,.07,f.x)*smoothstep(.06,.14,f.y)*smoothstep(.97,.93,f.x)*smoothstep(.94,.86,f.y);
        float v = .55+.45*hash21(id);
        return mix(vec3(.30,.13,.11)*v*(.7+.6*fbm(p*9.)), vec3(.035), mortar);
      }
      bool inWall(vec2 v){ return v.x>0.&&v.x<1.&&v.y>0.&&v.y<1.; }
      vec3 neonAt(vec2 v){
        if (!inWall(v)) return vec3(0.);
        vec3 core = texture(uTube, v).rgb, h1 = texture(uHalo, v).rgb, h2 = texture(uGlow, v).rgb;
        float l = max(core.r,max(core.g,core.b));
        vec3 hot = mix(core*1.3, vec3(1.,.97,.94), smoothstep(.3,.9,l)*.85);
        return hot + h1*3.2 + h2*2.6;
      }
      vec3 haloAt(vec2 v){ vec3 h = texture(uGlow, clamp(v,0.,1.)).rgb; return h*exp(-length(max(abs(v-.5)-.5,0.))*5.); }
      vec3 scene(vec2 fc){
        vec2 uv = fc/uRes; float s = uS;
        float z = uZoom; vec2 c = vec2(.5, mix(.5,.62,(1.-z)/.34));
        vec2 wv = (uv - c)/z + .5;
        float floorY = c.y - .5*z - .02*(1.-z)/.34;
        vec3 col;
        vec3 halo = haloAt(wv);
        if (uv.y > floorY) {
          col = brick(wv*vec2(1.78,1.)) * (.05 + 3.2*halo) * uWall + neonAt(wv);
          // a little sign frame around the grid when we are far enough to see it
          vec2 e = abs(wv-.5)-.5; float fr = smoothstep(.006,.0,abs(max(e.x,e.y)-.012));
          col += fr*vec3(.05)*(1.-z)/.34;
        } else {
          float k = floorY - uv.y;
          vec2 rv = vec2(wv.x + .008*sin(uv.y*260.+s*7.)*smoothstep(0.,.2,k), (floorY + k*1.1 - c.y)/z + .5);
          vec3 r = neonAt(rv)*.45 + haloAt(rv)*2.2;
          col = vec3(.010,.012,.022) + r*exp(-k*3.8)*(.65+.35*gnoise(vec2(uv.x*90., uv.y*12.)));
        }
        if (uFlash > 0.) { col = mix(col, vec3(lum(col))*vec3(.55,1.,1.45)*1.4, uFlash*.65); col += uFlash*.05; }
        vec2 rp = fc*vec2(1./3.,1./70.) + vec2(0., s*9.);
        float st = step(.985, hash21(floor(rp))) * smoothstep(0.,.3,fract(rp.y));
        col += st*uRain*(.05 + halo*2.);
        col *= 1. - .5*dot(uv-.5,uv-.5)*2.;
        return col/(1.+col*.12);
      }
      void main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
  },
  render(s, tg) {
    const tau = 6 + s;
    G.drawFills(ctx, tau);
    E.uploadCanvas(tubeTex, cv);
    const L = light(s);
    for (let r = 0; r < G.ROWS; r++) for (let c = 0; c < G.COLS; c++) lightArr[r * G.COLS + c] = L({ c, r });
    lineCtx.clearRect(0, 0, W, H);
    const m = E.ease((s - 4.8) / .85);
    if (s > 4.78) {
      const t = G.tilesAt(tau).find(t => t.c === 3 && t.r === 1);
      const A = resample(t.layers[0].pts, 320), HL = HorseLayout, B = horse.map(([u, v]) => [HL.X0 + u * HL.SQ, v * HL.SQ]);
      let k0 = 0, bd = 1e9; for (let k = 0; k < 320; k += 4) { const d = Math.hypot(A[k][0] - B[0][0], A[k][1] - B[0][1]); if (d < bd) { bd = d; k0 = k; } }   // align start points
      lineCtx.beginPath(); for (let k = 0; k < 320; k++) { const a = A[(k + k0) % 320], b = B[k]; const x = a[0] + (b[0] - a[0]) * m, y = a[1] + (b[1] - a[1]) * m; k ? lineCtx.lineTo(x, y) : lineCtx.moveTo(x, y); }
      lineCtx.closePath(); lineCtx.lineJoin = 'round'; lineCtx.lineWidth = 7; lineCtx.strokeStyle = 'rgb(255,90,190)'; lineCtx.stroke();
    }
    E.uploadCanvas(lineTex, lineCv);
    E.bindTarget(edgeT); E.setBase(edgeProg, W, H, s, tg); E.bindTex(0, tubeTex, edgeProg.u.uFill); E.bindTex(1, lineTex, edgeProg.u.uLine);
    gl.uniform1fv(edgeProg.u.uLight, lightArr); E.drawQuad();
    const halo = blurA(edgeT.tex, 22, 1.0), glow = blurB(halo, 110, 1.0, 2);
    E.bindTarget(target); E.setBase(prog, W, H, s, tg);
    E.bindTex(0, edgeT.tex, prog.u.uTube); E.bindTex(1, halo, prog.u.uHalo); E.bindTex(2, glow, prog.u.uGlow);
    const pull = E.ease((s - 2.0) / 1.6);
    gl.uniform1f(prog.u.uZoom, 1 - .34 * pull * (1 - E.ease((s - 4.25) / .6)));
    gl.uniform1f(prog.u.uWall, clamp((s + .3) / .9));
    gl.uniform1f(prog.u.uFlash, Math.max(0, 1 - Math.abs(s - 3.45) / .18) * (s > 3.2 ? 1 : 0));
    gl.uniform1f(prog.u.uRain, pull);
    E.drawQuad();
    return target.tex;
  },
}));
})();
