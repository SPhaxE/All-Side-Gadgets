// 11 Particle swarm — 60k particles x 4 time-lagged copies (stateless trails): chaos -> torus knot -> burst -> sphere shell. Positions are closed-form f(id, s).
(() => { const E = Engine; const gl = E.gl;
const N = 60000, W = 1920, H = 1080;
const VS = `#version 300 es
precision highp float;
uniform float uS; uniform vec2 uRes;
out vec3 vCol; out float vA;
const float TAU = 6.28318530718;
float h11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
vec3 h31(float n){ vec3 p3 = fract(vec3(n)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.), clamp(p-1.,0.,1.), c.y); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
void main(){
  int id = gl_VertexID/4; int k = gl_VertexID - id*4;
  float fid = float(id);
  float t = uS - float(k)*.024;
  vec3 r = h31(fid);
  float gather = smoothstep(.05,1.5,t);
  float boom = smoothstep(2.45,2.85,t)*(1.-smoothstep(2.85,3.7,t));
  float toSphere = smoothstep(3.0,3.9,t);
  // chaos cloud with swirl
  vec3 c = (r-.5)*vec3(3.4,2.1,2.6);
  float ang = t*(.25+.5*r.y);
  c.xz = rot(ang)*c.xz;
  c += .32*vec3(sin(t*1.3+r.x*20.), sin(t*1.1+r.y*17.), sin(t*1.7+r.z*13.));
  // torus knot (2,3)
  float u = fract(r.x*7.31+.17)*TAU;
  float rad = 2.+cos(3.*u);
  vec3 knot = vec3(rad*cos(2.*u), rad*sin(2.*u), sin(3.*u))*.60;
  vec3 tube = normalize(r*2.-1.+1e-3)*.07*(.4+h11(fid*1.7));
  knot += tube;
  knot.xy = rot(t*.4)*knot.xy;
  // fibonacci sphere shell
  float yy = 1.-2.*(fract(r.x*131.7)+.0);
  float rr = sqrt(max(1.-yy*yy,0.)); float phi = fid*2.399963;
  vec3 sph = vec3(rr*cos(phi), yy, rr*sin(phi))*(1.12+.05*sin(t*3.+r.y*30.)+.04*boom);
  vec3 target = mix(knot, sph, toSphere);
  float g = gather*(1.-.55*boom);
  vec3 p = mix(c, target, g);
  p += (1.-g)*0.0 + .012*vec3(sin(t*5.+fid), cos(t*4.3+fid*1.3), sin(t*3.7+fid*.7));
  p += normalize(p+1e-3)*boom*(1.2+2.2*r.z);
  // camera
  float a = t*.33+.5; p.xz = rot(a)*p.xz; p.yz = rot(.35+.1*sin(t*.5))*p.yz;
  float camz = 3.5; float dz = camz - p.z;
  vec2 sc = p.xy/dz*2.0;
  gl_Position = vec4(sc.x*(1080./1920.), sc.y, 0., 1.);
  float dof = clamp(abs(dz-3.5)*.5, 0., 1.);
  gl_PointSize = (3.4 + 4.2*r.z + 3.0*dof) * (uRes.y/1080.) * (3.5/dz);
  float hue = fract(.52 + r.x*.40 + t*.04 + g*.07);
  vCol = hsv2rgb(vec3(hue, .9 - .3*boom, 1.)) * (.7 + .8*r.y);
  vCol = mix(vCol, vec3(1.,.9,.7), boom*.12);
  vA = (1. - float(k)*.27) * (.55+.45*(1.-dof)) * (.8 + .3*boom) * mix(1., .42, toSphere*(1.-boom));
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; out vec4 fragColor;
void main(){ float d = length(gl_PointCoord-.5)*2.; float a = exp(-d*d*3.2); fragColor = vec4(vCol*a*vA*1.15, 1.); }`;
let prog, target, vao;
E.register(11, E.customScene({
  hudDark: false,
  init() { prog = E.program(FS, VS); target = E.makeTarget(W, H); vao = gl.createVertexArray(); },
  render(s, tg) {
    E.bindTarget(target);
    gl.clearColor(.012, .012, .045, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog.pr); gl.uniform1f(prog.u.uS, s); gl.uniform2f(prog.u.uRes, W, H);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, N * 4); gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    return target.tex;
  },
}));
})();
