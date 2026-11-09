// 20 Ray-marched fractals (v2) — a Mandelbulb grown out of scene 19's sprouting wax blob: the power climbs from 2 to 8
// while the camera orbits and dives into the folds (orbit-trap colour, AO, fog, rim glow); at the climax the power
// falls back, the detail recedes like a tide, and the form is smoothed into the glossy gradient sphere that opens
// scene 01 — the loop seam.
(() => { const E = Engine;
E.register(20, E.shaderScene({ scaled: true, hudDark: false, frag: `
float POW, SMOOTH;
float bulb(vec3 p, out vec4 trap){
  vec3 w = p; float m = dot(w,w), dz = 1.; trap = vec4(abs(w), m);
  for (int i=0;i<7;i++){
    dz = POW*pow(m,(POW-1.)*.5)*dz + 1.;
    float r = length(w), b = POW*acos(clamp(w.y/r,-1.,1.)), a = POW*atan(w.x,w.z);
    w = p + pow(r,POW)*vec3(sin(b)*sin(a), cos(b), sin(b)*cos(a));
    trap = min(trap, vec4(abs(w), m)); m = dot(w,w); if (m > 256.) break;
  }
  return .25*log(m)*sqrt(m)/dz;
}
float map(vec3 p, out vec4 trap){ float df = bulb(p, trap); float ds = length(p) - 1.0; return mix(df, ds, SMOOTH); }
float de(vec3 p){ vec4 t; return map(p, t); }
vec3 calcN(vec3 p, float e){ vec2 k = vec2(1.,-1.); return normalize(k.xyy*de(p+k.xyy*e)+k.yyx*de(p+k.yyx*e)+k.yxy*de(p+k.yxy*e)+k.xxx*de(p+k.xxx*e)); }
vec3 scene(vec2 fc){
  vec2 uv = (fc - .5*uRes)/uRes.y; float s = uS;
  float grow = ease((s + .75)/3.), fall = ease((s - 3.3)/1.3);
  POW = 2. + 6.*grow - 6.*fall + .3*sin(s*1.2)*(1.-fall);
  SMOOTH = ease((s - 4.4)/1.4);
  float dive = ease((s - 1.2)/2.0)*(1. - ease((s - 3.6)/1.6));
  float R = mix(3.3, 1.75, dive);
  float a = .6 + s*.45, el = .35 + .25*sin(s*.5);
  vec3 ro = R*vec3(cos(a)*cos(el), sin(el), sin(a)*cos(el));
  ro = mix(ro, vec3(0., 0., -3.4), SMOOTH);                         // settle on the framing scene 01 opens with
  vec3 f = normalize(-ro), rt = normalize(cross(vec3(0.,1.,0.), f)), up = cross(f, rt);
  vec3 rd = normalize(f*1.4 + rt*uv.x + up*uv.y);
  vec3 bg = mix(vec3(.01,.0,.04), vec3(.07,.02,.14), smoothstep(-.6,.6,uv.y)) + .05*vec3(.6,.2,1.)*exp(-dot(uv,uv)*2.);
  bg = mix(bg, vec3(.045), SMOOTH);
  float t = 0., minD = 1e9; int steps = 0; bool hit = false; vec4 tr;
  for (int i=0;i<140;i++){ vec3 p = ro + rd*t; float d = map(p, tr); minD = min(minD, d/max(t,.1));
    if (d < .0005*t) { hit = true; steps = i; break; } t += d*.85; steps = i; if (t > 8.) break; }
  vec3 col = bg; float glow = exp(-minD*14.)*(1. - SMOOTH);
  if (hit){
    vec3 p = ro + rd*t, n = calcN(p, .0012*t); vec4 q; map(p, q);
    vec3 base = pal(q.x*1.3 + q.w*.18 + .08*s, vec3(.45,.4,.5), vec3(.55,.5,.5), vec3(1.,1.,.8), vec3(.0,.33,.6));
    base = mix(base, vec3(1.,.5,.1), smoothstep(.0,.25,q.y)*.55); base *= base*1.4;
    // scene 01's gradient material, faded in as the surface smooths
    vec3 grad = mix(mix(vec3(.55,.95,.45), vec3(.25,.75,.95), smoothstep(-.8,.8,p.x + p.y*.5)), vec3(.95,.97,1.), smoothstep(.4,1.,p.y)*.4);
    base = mix(base, grad, SMOOTH);
    float ao = pow(1. - float(steps)/140., mix(2.4, .6, SMOOTH));
    vec3 L = normalize(vec3(.6,.8,-.3)), L2 = normalize(vec3(-.7,.2,.6));
    float dif = max(dot(n,L),0.), dif2 = max(dot(n,L2),0.), spec = pow(max(dot(reflect(rd,n),L),0.), 40.), rim = pow(1.-max(dot(n,-rd),0.), 3.);
    col = base*(.06 + 1.15*dif + .5*dif2*vec3(.2,.5,1.))*ao*1.4 + spec*.7*ao + rim*vec3(.2,.6,1.)*1.1*ao*(1.-SMOOTH*.6);
    col = mix(col, base*(.35 + .75*(dot(n,L)*.5+.5)) + spec*.25 + rim*.25, SMOOTH);
    col = mix(col, bg, (1.-exp(-t*t*.02))*(1.-SMOOTH));
  }
  col += glow*vec3(.55,.25,1.)*.55*(hit?.5:1.);
  col = pow(col, vec3(.9)); col = col/(1.+col*.25);
  col *= 1. - .35*dot(uv,uv);
  return col;
}` }));
})();
