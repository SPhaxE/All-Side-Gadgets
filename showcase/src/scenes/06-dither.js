// 06 Dithering — lit sphere + plasma, quantised with Bayer / random-boil thresholds; palette sweeps: 1-bit navy/peach -> CGA 4-colour -> Game Boy green
(() => { const E = Engine;
E.register(6, E.shaderScene({ hudDark: false, frag: `
const float PX = 4.;
float bayer8(vec2 p){
  ivec2 q = ivec2(mod(p,8.)); int x = q.x, y = q.y; int xy = x ^ y;
  int v = ((y&1)<<5)|((xy&1)<<4)|((y&2)<<2)|((xy&2)<<1)|((y&4)>>1)|((xy&4)>>2);
  return (float(v)+.5)/64.;
}
float srcL(vec2 uv, float s){
  vec2 p = uv;
  float pulse = smoothstep(2.2,2.7,s)*(1.-smoothstep(2.8,3.5,s));
  // plasma background
  float pl = .5 + .25*sin(p.x*5.+s*1.1) + .2*sin(p.y*7.-s*.9) + .15*sin(length(p-vec2(.3,-.1))*9.-s*2.);
  float L = pl*.62;
  // ripple
  float rr = length(p-vec2(0.,0.)); float rip = exp(-pow((rr-(s-2.5)*.55)*9.,2.))*step(2.5,s);
  L += rip*.35;
  // sphere
  vec2 c = vec2(.02*sin(s*.8), .02*cos(s*.7)); float R = .30 + .03*sin(s*3.)*pulse + .02*pulse;
  vec2 d = p - c; float r = length(d);
  // ring (behind/front)
  vec2 e = d*rot(-.35); float ring = abs(length(e*vec2(1.,3.2)) - .52);
  float ringMask = smoothstep(.02,.0,ring) * (e.y > 0. ? (r>R ? 1. : 0.) : 1.);
  if (r < R){
    vec3 n = vec3(d/R, sqrt(max(1.-dot(d,d)/(R*R),0.)));
    vec3 l = normalize(vec3(cos(s*.9)*.8, .55, -sin(s*.9)*.3+.6));
    float dif = max(dot(n,l),0.);
    float stripe = .06*sin((n.y+n.x*.3)*28.);
    L = .06 + .92*pow(dif,.85) + stripe*.0;
  }
  // shadow / halo
  L *= 1. - .35*smoothstep(.55,.0,length((p-vec2(.0,-.36))*vec2(1.,2.8)))*step(R,r);
  L = mix(L, .96, ringMask*.9*step(R*.98, r));
  // moons
  for (int i=0;i<3;i++){ float fi = float(i); float a = s*(.9+.35*fi)+fi*2.1; vec2 mp = vec2(cos(a)*.62, sin(a)*.20-.02)*(1.+.2*fi);
    float mr = .045 + .015*fi; float dm = length(p-mp); if (dm<mr){ vec2 q = (p-mp)/mr; L = .25 + .7*clamp(.5+.5*dot(q,normalize(vec2(-.6,.6))),0.,1.); } }
  return clamp(L,0.,1.);
}
vec3 pal1(float t){ return t > .5 ? vec3(1.,.85,.69) : vec3(.04,.07,.19); }
vec3 pal2(float i){ // CGA: black, magenta, cyan, white
  if (i < .5) return vec3(.03,.0,.08); if (i < 1.5) return vec3(1.,.33,.82); if (i < 2.5) return vec3(.33,1.,1.); return vec3(1.);
}
vec3 pal3(float i){ // Game Boy
  if (i < .5) return vec3(.06,.22,.06); if (i < 1.5) return vec3(.19,.38,.19); if (i < 2.5) return vec3(.55,.67,.06); return vec3(.61,.74,.06);
}
vec3 scene(vec2 fc){
  float s = uS;
  vec2 cell = floor(fc/PX);
  vec2 cc = (cell+.5)*PX;
  vec2 uv = (cc - .5*uRes)/uRes.y;
  float L = srcL(uv, s);
  // palette mode sweep (diagonal, 0.6s wide)
  float front1 = (s-1.2)/.6*1.6 - .6, front2 = (s-3.3)/.6*1.6 - .6;
  float pos = uv.x*.85 + uv.y*.35;
  int mode = pos < front1 ? (pos < front2 ? 2 : 1) : 0;
  vec3 col;
  float edge = min(abs(pos-front1), abs(pos-front2));
  if (mode == 0){
    float th = bayer8(cell);
    col = pal1(L + (th-.5)*.9 + .0);
  } else if (mode == 1){
    float th = bayer8(cell);
    col = pal2(floor(clamp(L*3. + th - .5 + .5, 0., 3.)));
  } else {
    float th = hash21(cell + floor(s*12.)*17.31);
    float th2 = mix(th, bayer8(cell), .55);
    col = pal3(floor(clamp(L*3. + th2 - .5 + .5, 0., 3.)));
  }
  col = mix(col, vec3(1.), smoothstep(PX*.9/uRes.y*1.2, 0., edge)*0.0);
  return col;
}` }));
})();
