// 18 Flow fields (v2) — a Starry-Night-style painting made of ~26k impasto brush strokes that follow a vortex flow
// field: swirling sky, concentric strokes around the stars and moon, the flame-like cypress, rolling hills and a village.
// Strokes slide along the field and fade in and out (stateless: position = seed + flow * phase). At the climax the whole
// field collapses into one giant vortex; at the end its glowing core is what scene 19 drips into the lava lamp.
(() => { const E = Engine, gl = E.gl;
const W = 1920, H = 1080, GX = 230, GY = 115, NS = GX * GY;
const FIELD = `
uniform float uS, uVortex;
const vec2 STARS[6] = vec2[6](vec2(300.,170.), vec2(620.,120.), vec2(1050.,230.), vec2(1330.,140.), vec2(1560.,330.), vec2(820.,360.));
vec2 MOON = vec2(1700., 150.);
float h11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
vec2 rotv(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
vec2 swirl(vec2 p, vec2 c, float r, float k){ vec2 d = p - c; float l = length(d); return vec2(-d.y, d.x)/max(l,1.)*k*exp(-pow(l/r, 2.)); }
// region: 0 sky, 1 cypress, 2 hills/village
int region(vec2 p){
  float cyp = abs(p.x - 260. - (1080.-p.y)*.05*sin(p.y*.01)) - 70.*smoothstep(80., 1080., p.y)*(1. + .25*sin(p.y*.04));
  if (cyp < 0. && p.y > 120.) return 1;
  float hill = 720. + 40.*sin(p.x*.004 + 1.) + 25.*sin(p.x*.011);
  return p.y > hill ? 2 : 0;
}
vec2 field(vec2 p){
  int rg = region(p);
  vec2 v;
  if (rg == 1) v = vec2(.15*sin(p.y*.03 + uS), -1.);                                   // flames up the cypress
  else if (rg == 2) v = vec2(1., .25*sin(p.x*.012 + p.y*.02));                         // rolling hills
  else {
    v = vec2(1., .35*sin(p.x*.004 + p.y*.012 + uS*.3));                                // the long sky current
    v += swirl(p, vec2(760. + 60.*sin(uS*.4), 330.), 260., 3.2);                       // the two great swirls
    v += swirl(p, vec2(1180. - 40.*sin(uS*.3), 360.), 190., -2.4);
    for (int i=0;i<6;i++) v += swirl(p, STARS[i], 70., 2.5);                          // stars: concentric strokes
    v += swirl(p, MOON, 120., 2.8);
  }
  vec2 vc = swirl(p, vec2(960., 400.), 1200., 1.) + (vec2(960.,400.) - p)*.0006;       // climax: one giant vortex
  v = normalize(mix(normalize(v + 1e-4), normalize(vc + 1e-4), uVortex) + 1e-4);
  return v;
}
vec3 paint(vec2 p, float j){
  int rg = region(p);
  vec3 c;
  if (rg == 1) c = mix(vec3(.05,.10,.08), vec3(.12,.25,.18), j);
  else if (rg == 2) { c = mix(vec3(.10,.16,.38), vec3(.20,.30,.55), j); if (p.y > 840. && p.y < 1000. && h11(floor(p.x/34.) + floor(p.y/26.)*7.) > .955) c = vec3(1.,.82,.25); }
  else {
    c = mix(vec3(.08,.18,.52), vec3(.20,.42,.78), j);
    c = mix(c, vec3(.55,.80,.92), smoothstep(.55,1.,j)*.65);
    for (int i=0;i<6;i++){ float d = length(p - STARS[i]); c = mix(c, mix(vec3(1.,.9,.45), vec3(.95,.97,.85), j), smoothstep(62., 18., d)); }
    float dm = length(p - MOON); c = mix(c, vec3(1.,.78,.20), smoothstep(110., 60., dm));
  }
  return c;
}`;
let prog, base, target, vao;
E.register(18, E.customScene({
  hudDark: false,
  init() {
    target = E.makeTarget(W, H); vao = gl.createVertexArray();
    base = E.program(E.PRELUDE + FIELD.replace('uniform float uS, uVortex;', 'uniform float uVortex;') + `
      void main(){ vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y)*(1920./uRes.x); fragColor = vec4(paint(p, .3)*.75, 1.); }`);
    prog = E.program(`#version 300 es
      precision highp float; precision highp int;
      in vec2 vL; in vec3 vC; in float vA, vSeed; out vec4 fragColor;
      float hh(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        // bristle streaks along the stroke, soft round ends, impasto highlight on one side
        float across = vL.y, along = vL.x;
        float bristle = .75 + .25*sin(across*22. + vSeed*30.) * sin(across*9. + vSeed*7.);
        float ends = smoothstep(1., .7, abs(along)) * smoothstep(1., .8, abs(across));
        float hi = smoothstep(.2, .9, -across)*.25;
        vec3 c = vC*bristle + hi;
        fragColor = vec4(c, ends*vA);
      }`, `#version 300 es
      precision highp float; precision highp int;
      uniform vec2 uRes;
      ${FIELD}
      out vec2 vL; out vec3 vC; out float vA, vSeed;
      void main(){
        int id = gl_VertexID / 6, k = gl_VertexID - id*6;
        float fid = float(id);
        vec2 g = vec2(float(id % ${GX}), float(id / ${GX}));
        vec2 seed = (g + vec2(h11(fid*1.7), h11(fid*3.1))) * vec2(1920./${GX}., 1080./${GY}.);
        float ph = fract(uS*(.25 + .2*h11(fid*5.3)) + h11(fid*9.7));
        float L = 30. + 24.*h11(fid*2.3), Wd = 9. + 5.*h11(fid*4.1);
        // slide along the field: integrate a few steps
        vec2 p = seed; float travel = (ph - .5)*60.*(1. + 2.*uVortex);
        for (int i=0;i<4;i++) p += field(p)*travel*.25;
        vec2 dir = field(p);
        vec2 corner = k == 0 ? vec2(-1.,-1.) : k == 1 ? vec2(1.,-1.) : k == 2 ? vec2(-1.,1.) : k == 3 ? vec2(-1.,1.) : k == 4 ? vec2(1.,-1.) : vec2(1.,1.);
        vec2 nrm = vec2(-dir.y, dir.x);
        vec2 P = p + dir*corner.x*L*.5 + nrm*corner.y*Wd*.5 + nrm*corner.x*corner.x*3.*sin(fid);   // slight curve
        vec2 ndc = vec2(P.x/1920.*2. - 1., 1. - P.y/1080.*2.);
        gl_Position = vec4(ndc, 0., 1.);
        vL = corner; vSeed = h11(fid*7.7);
        vC = paint(seed, h11(fid*6.1));
        vA = sin(3.14159*ph)*.95;
      }`);
  },
  render(s, tg) {
    const vortex = E.ease((s - 3.2) / .8) * (1 - E.ease((s - 5.4) / .8) * 0);
    E.bindTarget(target); E.setBase(base, W, H, s, tg); gl.uniform1f(base.u.uVortex, vortex); E.drawQuad();
    gl.useProgram(prog.pr); gl.uniform1f(prog.u.uS, s); gl.uniform1f(prog.u.uVortex, vortex); gl.uniform2f(prog.u.uRes, W, H);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, NS * 6); gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    return target.tex;
  },
}));
})();
