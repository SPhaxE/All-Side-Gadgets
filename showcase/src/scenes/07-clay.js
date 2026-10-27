// 07 Clay 3D (v2) — stop-motion (12fps) hand-sculpting on a turntable: dithered pellets from scene 06 bounce in and
// merge into one lump -> invisible thumbs press dents into it -> it is re-sculpted into a coil pot -> a flower bursts
// out of the pot. Ray-marched SDF, matte clay with fingerprint ridges, wrap lighting, soft shadow, AO, paper sweep set.
(() => { const E = Engine;
E.register(7, E.shaderScene({ scaled: true, hudDark: true,
  uniforms(p, s, tg, gl) { gl.uniform1f(p.u.uQ, E.stepT(s, 12)); gl.uniform1f(p.u.uFJ, Math.floor(s * 12 + 1e-4)); },
  frag: `
uniform float uQ, uFJ;
float T;
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0-1.)/k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
float h3(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.; }
// ---- sculpture stages (all centred on the turntable at origin, y up, table top y = 0) ----
float pellets(vec3 p, out float id){
  float d = 1e9; id = 0.;
  for (int i=0;i<7;i++){
    float fi = float(i), a = fi*2.39996 + .4;
    float arrive = ease((T + .7 - fi*.06)/1.25);
    vec3 start = vec3(cos(a)*2.6, 0., sin(a)*2.6);
    vec3 c = mix(start, vec3(cos(a)*.18, 0., sin(a)*.18), arrive);
    float bounce = abs(sin((T + .7)*7. + fi))*(1.-arrive)*.55;
    float r = .26 + .05*hash11(fi*7.1);
    c.y = r + bounce;
    float di = length(p - c) - r;
    if (di < d) id = fi;
    d = smin(d, di, .18 + .5*arrive);
  }
  return d;
}
float lump(vec3 p){
  float d = sdEll(p - vec3(0.,.48,0.), vec3(.72,.5,.66));
  // thumb dents, one per stop-motion beat from T 1.0 to 2.2
  for (int i=0;i<5;i++){
    float fi = float(i), t0 = 1.0 + fi*.24, k = clamp((T - t0)/.12, 0., 1.);
    if (k <= 0.) continue;
    float a = fi*2.2 + .6; vec3 c = vec3(cos(a)*.55, .62 + .12*sin(fi*1.7), sin(a)*.55);
    d = smax(d, -(sdEll(p - c*1.12, vec3(.17,.12,.17)) ), .06*k + .001);
  }
  float squash = ease((T - 1.9)/.3); d += squash*.0;
  return d;
}
float pot(vec3 p, float grow){
  // coil pot: helix tube whose radius follows a belly profile; built up from the bottom as grow goes 0 -> 1
  float H = 1.25*grow + .001, pitch = .13, tr = .075;
  float rho = length(p.xz), th = atan(p.z, p.x);
  float y = p.y - .02;
  float yy = y - pitch*th/TAU; float k = floor(yy/pitch + .5); float yc = k*pitch + pitch*th/TAU;
  yc = clamp(yc, tr, H);
  float prof = .42 + .32*sin(clamp(yc/1.25,0.,1.)*2.6) - .1*smoothstep(.9,1.25,yc);
  float d = length(vec2(rho - prof, y - yc)) - tr;
  float base = max(rho - .45, abs(y - .04) - .04);               // flat base disc
  return smin(d, base, .05);
}
float flower1(vec3 p, float g, vec3 dir, float hgt, float seed, out float part){
  part = 0.;
  if (g <= 0.) return 1e9;
  vec3 sway = vec3(.05*sin(T*2.+seed), 0., .04*cos(T*1.7+seed));
  vec3 top = vec3(0.,1.05,0.) + dir*hgt*ease(g*1.5) + sway;
  float d = sdCap(p, vec3(0.,.95,0.), top, .04);
  { float lg = clamp((g-.15)*1.8,0.,1.); vec3 q = p - mix(vec3(0.,1.05,0.), top, .45); q.xz *= rot(seed); q.xy *= rot(.8);
    float dl = sdEll(q - vec3(.14*lg,0.,0.), vec3(.24,.05,.11)*lg + .001); if (dl < d) part = 2.; d = min(d, dl); }
  float pg = clamp((g-.3)/.7, 0., 1.); float el = pg == 0. ? 0. : 1. + pow(2., -9.*pg)*sin((pg*9. - .75)*2.094);
  vec3 c = top;
  for (int i=0;i<7;i++){ float a = float(i)*.8976 + seed; vec3 q = p - c; q.xz *= rot(a); q -= vec3(.30*el, .04, 0.); q.xy *= rot(.42);
    float dp = sdEll(q, vec3(.31,.07,.15)*el + .001); if (dp < d) part = 1.; d = smin(d, dp, .02); }
  float dc = length((p - c - vec3(0.,.05,0.))*vec3(1.,1.6,1.)) - .13*clamp(pg*2.,0.,1.);
  if (dc < d) part = 3.; d = min(d, dc);
  return d;
}
float flower(vec3 p, float t, out float part, out float which){
  float d = 1e9; part = 0.; which = 0.;
  for (int i=0;i<3;i++){
    float fi = float(i), pt;
    vec3 dir = normalize(vec3(cos(fi*2.1+.5)*(i==0?0.:.42), 1., sin(fi*2.1+.5)*(i==0?0.:.42)));
    float df = flower1(p, ease((t - fi*.25)/1.0), dir, i==0 ? 1.15 : .8, fi*1.7, pt);
    if (df < d) { d = df; part = pt; which = fi; }
  }
  return d;
}
// returns (dist, material): 0 table, 1 clay body (colour from id), 2 petal, 3 leaf, 4 flower centre
vec2 map(vec3 p){
  vec2 res = vec2(p.y + .14, 0.);                                  // table top
  float rr = length(p.xz); float dTT = max(rr - 1.45, abs(p.y + .07) - .07) - .02;   // turntable platter
  if (dTT < res.x) res = vec2(dTT, .3);
  float turn = T*.35 + .3; vec3 q = p; q.xz *= rot(turn);
  float id;
  float dPel = pellets(q, id), dLump = lump(q), dPot = pot(q, ease((T - 2.3)/1.0));
  float m1 = ease((T - .55)/.5), m2 = ease((T - 2.2)/.35);
  float d = mix(dPel, dLump, m1);
  d = mix(d, dPot, m2);
  res = d < res.x ? vec2(d, 1. + .1*id*(1.-m1)) : res;
  float part, which; float df = flower(q, T - 3.3, part, which);
  if (df < res.x) res = vec2(df, part == 1. ? 2. + which*.1 : (part == 3. ? 4. : 3.));
  return res;
}
vec3 calcN(vec3 p){ vec2 e = vec2(.0015,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }
float shadow(vec3 ro, vec3 rd){ float r = 1., t = .03; for (int i=0;i<40;i++){ float h = map(ro+rd*t).x; r = min(r, 10.*h/t); t += clamp(h,.02,.25); if (r<.001||t>6.) break; } return clamp(r,0.,1.); }
float ao(vec3 p, vec3 n){ float o = 0., sc = 1.; for (int i=0;i<5;i++){ float h = .02+.1*float(i); o += (h - map(p+n*h).x)*sc; sc *= .75; } return clamp(1.-2.*o,0.,1.); }
vec3 scene(vec2 fc){
  T = uQ;
  vec2 uv = (fc - .5*uRes)/uRes.y;
  // camera: slow orbit is the turntable; push in at the bloom
  float push = ease((T - 3.2)/1.2);
  vec3 ro = vec3(0., mix(2.1, 2.2, push), mix(-5.6, -4.6, push));
  vec3 ta = vec3(0., mix(.7, 1.45, push), 0.);
  ro += vec3(hash11(uFJ)-.5, hash11(uFJ+3.)-.5, 0.)*.012;          // stop-motion camera jitter
  vec3 f = normalize(ta-ro), r = normalize(cross(f, vec3(0.,1.,0.))), u = cross(r, f);
  vec3 rd = normalize(f*1.7 + r*uv.x + u*uv.y);
  // paper sweep backdrop
  vec3 bgA = vec3(.98,.83,.74), bgB = vec3(.97,.70,.66);
  vec3 col = mix(bgB, bgA, smoothstep(-.35,.45,uv.y));
  col *= .96 + .04*n3(vec3(fc*.35, 1.));
  float t = 0.; vec2 h = vec2(1e9, -1.);
  for (int i=0;i<110;i++){ h = map(ro+rd*t); if (h.x < .001*t) break; t += h.x*.85; if (t > 14.) { h.y = -1.; break; } }
  if (h.y < -.5) return col;
  vec3 p = ro + rd*t; vec3 n = calcN(p);
  float mat = h.y;
  vec3 base;
  if (mat < .2) base = mix(bgB, bgA, .55)*.96;                     // paper table
  else if (mat < .5) {                                              // platter: pale felt with rotating index marks
    vec3 q = p; q.xz *= rot(T*.35 + .3); float a = atan(q.z, q.x), rr = length(p.xz);
    base = vec3(.93,.90,.86)*(rr > 1.3 ? .82 : 1.);
    base *= 1. - .25*step(.985, fract(a/TAU*24.))*smoothstep(1.25,1.4,rr);
  } else if (mat < 1.95) {                                          // clay body; pellets keep their own colours until they merge
    vec3 pc[4] = vec3[4](vec3(.96,.45,.38), vec3(.33,.70,.70), vec3(.98,.80,.33), vec3(.62,.50,.86));
    float id = (mat - 1.)*10.; vec3 cPel = pc[int(mod(id,4.))];
    float m1 = ease((T - .55)/.5);
    base = mix(cPel, vec3(.86,.50,.36), m1);                        // terracotta once merged
  } else if (mat < 2.5) { float w = (mat - 2.)*10.; base = w < .5 ? vec3(.98,.40,.52) : (w < 1.5 ? vec3(1.,.78,.25) : vec3(.66,.52,.95)); }   // petals
  else if (mat < 3.5) base = vec3(.42,.68,.36);                     // leaves / stem
  else base = vec3(1.,.82,.25);                                     // flower centre
  if (mat > .5 && mat < 4.5) {                                       // fingerprint ridges + lumpy hand-made surface
    vec3 q = p*7.;
    float ridge = sin(length(q.xy - vec2(n3(q*.4), 0.))*9. + n3(q*.9)*4.);
    n = normalize(n + (vec3(n3(q*2.), n3(q*2.+5.), n3(q*2.+9.))*.14 + n*ridge*.0) );
    vec3 gq = p*40.; n = normalize(n + vec3(n3(gq), n3(gq+3.), n3(gq+7.))*.05);
    base *= .93 + .07*ridge*.5 + .04*n3(p*25.);
  }
  vec3 L = normalize(vec3(-.55,.85,-.45));
  float sh = shadow(p + n*.01, L), occ = ao(p, n);
  float wrap = clamp((dot(n,L)+.35)/1.35, 0., 1.); wrap = wrap*wrap*(3.-2.*wrap);
  vec3 amb = mix(vec3(.66,.52,.58), vec3(1.,.88,.84), n.y*.5+.5);
  vec3 c = base*(amb*.5*occ + vec3(1.,.93,.85)*wrap*(.3+.7*sh)*1.15);
  c += base*vec3(.3,.06,.03)*(1.-wrap)*.3*occ;                      // warm bounce in the shadows (subsurface-ish)
  c += pow(max(dot(reflect(rd,n), L),0.), 18.)*.06*sh*step(.5,mat);
  float fog = 1. - exp(-t*.02);
  col = mix(c, col, fog);
  col *= 1. - .18*dot(uv,uv);
  return col;
}` }));
})();
