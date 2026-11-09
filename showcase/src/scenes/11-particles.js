// 11 Particle swarm (v2) — a murmuration of 70k starlings at dusk: the flock breathes, folds, stretches into a ribbon
// and rolls into a ball while density waves ripple through it; it spirals up as the sky turns to night, every bird
// lights up as a star and the swarm settles into a rotating spiral galaxy with nebula gas. Positions are closed-form
// f(id, s) (no simulation), so any frame renders on its own.
(() => { const E = Engine, gl = E.gl;
const N = 70000, W = 1920, H = 1080;
const VS = `#version 300 es
precision highp float; precision highp int;
uniform float uS; uniform vec2 uRes; uniform int uPass;
out vec3 vCol; out float vA;
const float TAU = 6.28318530718;
vec3 h31(float n){ vec3 p3 = fract(vec3(n)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
float ease(float x){ x = clamp(x,0.,1.); return x*x*x*(x*(x*6.-15.)+10.); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
vec3 flock(vec3 u, float t, float seed){
  // base: points in a unit ball, shaped by a slowly changing anisotropic scale (blob -> ribbon -> ball)
  float rib = ease((t-1.2)/.6)*(1.-ease((t-2.1)/.6));
  vec3 sc = vec3(1.2 + 2.2*rib, .55 - .3*rib, .7);
  vec3 p = u*sc;
  // folding: a smooth domain warp that changes over time (the flock "pours" through itself)
  p.y += .45*sin(p.x*1.3 + t*1.7) * (1. - .5*rib);
  p.x += .35*sin(p.y*2.1 - t*1.3 + p.z);
  p.z += .3*sin(p.x*1.7 + t*.9);
  p.y += .25*sin(p.z*2.6 + p.x*.8 - t*2.1);                      // second fold: wisps and sheets
  p.xy *= rot(.35*sin(t*.6) + rib*.4);
  // density wave travelling along the flock: birds bunch up in bands
  p.x += .16*sin(p.x*4. - t*6.);
  // the flock drifts across the sky and climbs away at the end
  float climb = ease((t-2.4)/1.3);
  p += vec3(-1.1 + .55*t, .35 + .15*sin(t*.8) + 2.6*climb*0., 0.);
  p.xz *= rot(climb*1.2);
  return p;
}
vec3 galaxy(float id, float t, out vec3 col){
  vec3 r = h31(id*1.37+5.), r2 = h31(id*.71+19.);
  float rad = pow(r.x, .85)*2.7, arm = floor(r.y*4.)*1.5708;
  float jit = (r.z + r2.x - 1.)*.42;                                             // arms with soft width
  float th = arm + log(rad + .12)*1.9 + jit - t*.5/(.4+rad*.6);
  if (r2.y < .14) th = r2.z*6.2832 - t*.5/(.4+rad*.6);                            // diffuse disk between the arms
  vec3 p = vec3(cos(th)*rad, (r2.x-.5)*.16*exp(-rad*.4), sin(th)*rad);
  if (r.y > .95) { float b = pow(r2.z,2.)*.55; vec3 d = normalize(r2 - .5 + 1e-3); p = d*b*vec3(1.,.55,1.); }   // bulge
  p.yz *= rot(1.2); p.xy *= rot(.3);
  col = mix(vec3(1.,.82,.55), vec3(.55,.72,1.), smoothstep(.2,1.4,rad));
  if (fract(id*.6180339) < .05) col = vec3(1.,.38,.72);
  return p + vec3(0., .15, 0.);
}
void main(){
  float id = float(gl_VertexID);
  vec3 r = h31(id);
  vec3 u = vec3(r.x*2.-1., r.y*2.-1., r.z*2.-1.); u *= pow(h31(id+11.).x, .55)*1.15/max(length(u), 1e-3);   // dense core, soft edges
  float t = uS;
  vec3 pf = flock(u, t, r.x);
  vec3 gc; vec3 pg = galaxy(id, t, gc);
  float m = ease((t - 2.75 - r.x*.6)/1.1);
  vec3 p = mix(pf, pg, m);
  // camera
  vec3 cam = vec3(0., 0., -6.5);
  vec3 q = p - cam;
  vec2 sc = q.xy/q.z*3.2;
  gl_Position = vec4(sc.x*(uRes.y/uRes.x), sc.y, 0., 1.);
  float px = uRes.y/1080.;
  gl_PointSize = mix(2.0 + 1.4*r.y, 1.5 + 3.0*pow(r.z,3.), m)*px*(6.5/q.z);
  float glow = m;
  if (uPass == 0) { vCol = vec3(.05,.03,.07); vA = .5*(1.-glow); }
  else { vCol = gc*(.55 + .9*pow(r.y,4.)); vA = glow; }
}`;
const FS = `#version 300 es
precision highp float; precision highp int;
uniform int uPass;
in vec3 vCol; in float vA; out vec4 fragColor;
void main(){ float d = length(gl_PointCoord-.5)*2.; if (d > 1.) discard;
  if (uPass == 0) fragColor = vec4(vCol, vA*smoothstep(1.,.5,d));
  else { float a = exp(-d*d*3.); fragColor = vec4(vCol*a*vA*.9, 1.); } }`;
let prog, sky, target, vao;
E.register(11, E.customScene({
  hudDark: false,
  init() {
    prog = E.program(FS, VS); target = E.makeTarget(W, H); vao = gl.createVertexArray();
    sky = E.program(E.PRELUDE + `
      vec3 scene(vec2 fc){
        vec2 q = (fc - .5*uRes)/uRes.y; float s = uS;
        float night = ease((s - 2.85)/1.0), tilt = ease((s - 2.3)/1.4);
        float hy = -.36 - 1.3*tilt;                                  // horizon slides down as the camera follows the climb
        float h = q.y - hy;
        vec3 dusk = mix(vec3(1.,.58,.32), vec3(.42,.22,.48), smoothstep(0.,.75,h));
        dusk = mix(dusk, vec3(.12,.10,.28), smoothstep(.6,1.6,h));
        dusk += vec3(1.,.7,.4)*exp(-length((q - vec2(.55, hy+.06))*vec2(1.,1.6))*5.)*.6;   // low sun
        if (h < 0.) dusk = mix(vec3(.16,.1,.18), vec3(.05,.04,.08), clamp(-h*3.,0.,1.)); // dark land
        vec3 nt = vec3(.008,.01,.03) + vec3(.02,.01,.05)*fbm(q*2.);
        vec2 sg = floor(fc/2.); float st = step(.9975, hash21(sg)); nt += st*(.5+.5*hash21(sg+3.));
        float neb = smoothstep(.0,.8,fbm(q*1.6 + vec2(s*.03,0.))*.5+.5 - length(q - vec2(0.,.1))*.6);
        nt += neb*mix(vec3(.55,.12,.45), vec3(.1,.4,.6), fbm(q*3.+5.)*.5+.5)*.55;
        float gal = ease((s - 3.4)/1.0);
        nt += gal*(vec3(1.,.8,.55)*exp(-length(q*vec2(1.,2.2) - vec2(0.,.06))*7.)*.45 + vec3(.4,.5,1.)*exp(-length(q*vec2(1.,2.4))*2.2)*.25);
        return mix(dusk, nt, night);
      }
      void main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
  },
  render(s, tg) {
    E.bindTarget(target); E.setBase(sky, W, H, s, tg); E.drawQuad();
    gl.useProgram(prog.pr); gl.uniform1f(prog.u.uS, s); gl.uniform2f(prog.u.uRes, W, H);
    gl.bindVertexArray(vao); gl.enable(gl.BLEND);
    gl.uniform1i(prog.u.uPass, 0); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.POINTS, 0, N);
    if (s > 2.7) { gl.uniform1i(prog.u.uPass, 1); gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, N); }
    gl.disable(gl.BLEND); gl.bindVertexArray(null);
    return target.tex;
  },
}));
})();
