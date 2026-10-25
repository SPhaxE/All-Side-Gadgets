// 05 Neon glow — NEON sign (white-hot core + two-stage colour halo), ignition flicker, bricks lit by glow, wet-floor reflection
(() => { const E = Engine;
E.register(5, E.shaderScene({ hudDark: false, frag: `
vec3 gCore, gIn, gHalo;
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
float sdRBox(vec2 p, vec2 b, float r){ return sdBox(p, b-r) - r; }
float sdTriLine(vec2 p, float r){ float d = 1e9; for(int i=0;i<3;i++){ float a0 = float(i)/3.*TAU+PI*.5, a1 = float(i+1)/3.*TAU+PI*.5;
  d = min(d, sdSeg(p, vec2(cos(a0),sin(a0))*r, vec2(cos(a1),sin(a1))*r)); } return d; }
void tube(float d, vec3 col, float on, float blur){
  float w = .0042;
  float core = smoothstep(w*1.4, w*.4, d);
  float inner = exp(-d*70./blur);
  float halo = exp(-d*11./blur);
  gCore += vec3(1.,.97,.95)*core*on;
  gIn  += col*inner*on*(.55+.45*core);
  gHalo += col*halo*on;
}
float flick(float t, float seed){          // ignition: stutter on, then steady with rare dropouts
  if (t < 0.) return .04;
  float k = floor(t*22.+seed*9.);
  float st = step(.45, hash11(k+seed*31.));
  float ramp = smoothstep(.0,.9,t);
  float steady = 1. - step(.992, hash11(floor(t*6.)+seed*17.))*.8;
  return mix(st*.9+.1, steady, ramp);
}
// letters: unit box 0..1 in x, 0..1 in y
float letN(vec2 p){ return min(min(sdSeg(p,vec2(0,0),vec2(0,1)), sdSeg(p,vec2(0,1),vec2(1,0))), sdSeg(p,vec2(1,0),vec2(1,1))); }
float letE(vec2 p){ return min(min(sdSeg(p,vec2(1,1),vec2(0,1)), sdSeg(p,vec2(0,1),vec2(0,0))), min(sdSeg(p,vec2(0,0),vec2(1,0)), sdSeg(p,vec2(0,.5),vec2(.72,.5)))); }
float letO(vec2 p){ return abs(sdRBox(p-.5, vec2(.5,.5), .28)); }
void neonSign(vec2 p, float blur, float s){
  float pulse = smoothstep(2.1,2.7,s)*(1.-smoothstep(3.0,3.8,s));
  vec3 pink = mix(vec3(1.,.12,.55), vec3(.2,.9,1.), pulse*.8);
  // letters
  vec2 o = vec2(-.40,.16); vec2 sz = vec2(.17,.27); float gap = .075;
  for (int i=0;i<4;i++){
    float fi = float(i);
    vec2 q = (p - o - vec2(fi*(sz.x+gap),0.))/sz;
    float d = (i==0||i==3) ? letN(q) : (i==1 ? letE(q) : letO(q));
    d *= sz.y;
    tube(d, pink, flick(s-.05-fi*.22, fi+1.)*(i==1 ? 1.-.7*step(.97,hash11(floor(s*13.))) : 1.), blur);
  }
  // ring around the sign
  vec2 rc = vec2(0.,.30);
  float dr = abs(length((p-rc)*vec2(.78,1.))-.50);
  float ang = atan(p.y-rc.y, p.x-rc.x);
  float dash = step(.12, fract(ang/TAU*14. + s*.15)) ;
  tube(mix(1.,dr,dash), vec3(.1,.85,1.), flick(s-.35, 7.), blur);
  // underline + bolt + triangle + small ring
  tube(sdSeg(p, vec2(-.46,.0), vec2(.46,.0)), vec3(.3,.45,1.), flick(s-.7, 8.), blur);
  vec2 b = (p - vec2(-.62,-.12))*3.2;
  float db = min(min(sdSeg(b,vec2(.2,.6),vec2(-.15,.0)), sdSeg(b,vec2(-.15,.0),vec2(.15,.0))), sdSeg(b,vec2(.15,.0),vec2(-.2,-.7)))/3.2;
  tube(db, vec3(1.,.85,.1), flick(s-1., 9.), blur);
  tube(sdTriLine((p-vec2(.62,-.1))*rot(s*.0+.3), .12), vec3(.7,.3,1.), flick(s-1.2, 10.), blur);
  tube(abs(length(p-vec2(.0,-.14))-.045), vec3(1.,.5,.1), flick(s-1.4, 11.), blur);
  tube(abs(length(p-vec2(.2,-.14))-.045), vec3(.1,.9,.5), flick(s-1.5, 12.), blur);
  tube(abs(length(p-vec2(-.2,-.14))-.045), vec3(1.,.2,.3), flick(s-1.6, 13.), blur);
}
vec3 brick(vec2 p){
  vec2 q = p*vec2(9.,22.); float row = floor(q.y); q.x += row*.5; vec2 f = fract(q), id = vec2(floor(q.x), row);
  float mortar = step(f.x,.05)+step(f.y,.12);
  float v = .5+.5*hash21(id);
  return mix(vec3(.30,.13,.12)*(.5+.6*v), vec3(.05,.04,.05), clamp(mortar,0.,1.)) * (.6+.4*fbm(p*14.));
}
vec3 scene(vec2 fc){
  vec2 p = (fc - .5*uRes)/uRes.y; float s = uS;
  float yf = -.26;
  vec3 col;
  if (p.y > yf){
    gCore = gIn = gHalo = vec3(0.); neonSign(p, 1., s);
    vec3 wall = brick(p) * (.015 + 1.7*gHalo*.45 + .7*gIn*.4);
    col = wall + gCore*1.15 + gIn*1.05 + gHalo*.2;
    // distant haze
    col += gHalo*.1;
  } else {
    float k = (yf - p.y);
    vec2 q = vec2(p.x + .012*sin(p.y*70.+s*3.)*k*6., yf + k*1.0);
    gCore = gIn = gHalo = vec3(0.); neonSign(q, 1.9 + k*3., s);
    float fall = exp(-k*3.2);
    vec3 refl = (gCore*.55 + gIn*.8 + gHalo*.35)*fall;
    float streak = .75 + .25*gnoise(vec2(p.x*60., p.y*6.+s));
    vec3 floorBase = vec3(.012,.012,.03) + .02*vec3(.4,.2,.6)*(1.-smoothstep(.0,.5,k));
    col = floorBase + refl*streak*1.3;
    col += vec3(.2,.1,.25)*exp(-k*40.)*.35;                // horizon edge sheen
  }
  col *= 1. - .6*dot(p,p)*.9;
  col = col/(1.+col*.18);
  return col;
}` }));
})();
