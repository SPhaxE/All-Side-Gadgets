// 01 Liquid morph (v2) — ref-style soft matte 3D form on near-black with a flowing multi-colour gradient inside:
// the glossy sphere left by scene 20 breathes -> swells into a pierced cloud-cross -> stretches into an open spiral
// ring -> snaps into three blobs with stretching necks that recoil -> gathers into a standing figure for scene 02.
// Shapes are SDFs blended with eased weights; the first frames match scene 20's last ones exactly (loop seam).
(() => { const E = Engine;
E.register(1, E.shaderScene({ scaled: true, hudDark: false, frag: `
float S;
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }
float sdTorus(vec3 p, float R, float r){ return length(vec2(length(p.xz)-R, p.y)) - r; }
float sdCap(vec3 p, float h, float r){ p.y -= clamp(p.y, -h, h); return length(p) - r; }
float shapeCross(vec3 p){
  float d = length(p) - .55;
  for (int i=0;i<4;i++){ float a = float(i)*1.5708 + .785; d = smin(d, length(p - vec3(cos(a)*.62, sin(a)*.62, 0.)) - .42, .3); }
  for (int i=0;i<4;i++){ float a = float(i)*1.5708; d = smin(d, length(p - vec3(cos(a)*.95, sin(a)*.95, 0.)*.9) - .3, .25); }
  d = smax(d, -(length(p.xy) - .16), .12);                                // the pierced centre
  return d + .03*sin(p.x*7. + S*2.)*sin(p.y*6.);
}
float shapeRing(vec3 p){
  vec3 q = p; q.yz = vec2(q.z, -q.y);                                    // ring in the screen plane
  float a = atan(q.z, q.x);
  float taper = smoothstep(-3.05, -2.2, a)*smoothstep(3.05, 1.6, a);    // an open crescent-spiral: both ends taper to a point
  float R = .78 - .14*(a/PI), r = .30*taper;
  return length(vec2(length(q.xz) - R, q.y)) - r;
}
float shapeTrio(vec3 p, float apart){
  float k = mix(.55, .12, apart), d = 1e9;
  for (int i=0;i<3;i++){ float a = float(i)*2.0944 + 1.57; vec3 c = vec3(cos(a), sin(a), 0.)*mix(.25, .95, apart); d = smin(d, length(p - c) - mix(.62, .42, apart), k); }
  return d;
}
float shapeFigure(vec3 p){
  float d = sdCap(p - vec3(0.,-.05,0.), .62, .36);
  d = smin(d, length(p - vec3(0.,.98,0.)) - .26, .18);                    // head
  d = smin(d, sdCap((p - vec3(0.,.35,-.22))*vec3(1.,1.,1.), .18, .14), .2);   // praying hands
  return d - .03*cos(p.y*3.);
}
float map(vec3 p){
  // slow turntable rotation that dies away at both ends (matches scene 20's still sphere)
  float rot1 = .5*sin(PI*clamp(S/5.6, 0., 1.));
  p.xz *= rot(rot1); p.xy *= rot(.15*sin(S*.7)*clamp(S,0.,1.));
  float breathe = .04*sin(S*3.)*clamp(S*2.,0.,1.);
  float dS = length(p) - 1. - breathe;
  float k1 = ease((S - .55)/.7), k2 = ease((S - 1.75)/.75), k3 = ease((S - 2.85)/.4), k4 = ease((S - 4.3)/.8);
  float apart = sin(PI*clamp((S - 3.05)/.75, 0., 1.));
  float d = mix(dS, shapeCross(p), k1);
  d = mix(d, shapeRing(p), k2);
  d = mix(d, shapeTrio(p, apart), k3);
  d = mix(d, shapeFigure(p), k4);
  return d;
}
vec3 calcN(vec3 p){ vec2 e = vec2(.0015,0.); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
vec3 gradient(vec3 p){
  // flowing internal colour: three palettes cross-fading with the shapes (green/teal -> magenta/orange -> blue/cyan -> warm)
  float f = fbm(p.xy*1.3 + vec2(S*.25, -S*.18)) + .3*p.y;
  vec3 g0 = mix(mix(vec3(.55,.95,.45), vec3(.25,.75,.95), smoothstep(-.8,.8,p.x + p.y*.5)), vec3(.95,.97,1.), smoothstep(.4,1.,p.y)*.4);
  vec3 g1 = mix(vec3(.55,.95,.4), vec3(.1,.6,.6), smoothstep(-.4,.6,f));
  vec3 g2 = mix(mix(vec3(1.,.25,.6), vec3(1.,.55,.15), smoothstep(-.5,.5,f)), vec3(.55,.3,1.), smoothstep(.3,.9,f));
  vec3 g3 = mix(vec3(.55,.95,.35), vec3(.2,.5,1.), smoothstep(-.6,.6,p.y + f*.6));
  vec3 g4 = mix(vec3(1.,.6,.25), vec3(.95,.3,.5), smoothstep(-.6,.8,p.y + f*.5));
  float k1 = ease((S - .55)/.7), k2 = ease((S - 1.75)/.75), k3 = ease((S - 2.85)/.4), k4 = ease((S - 4.3)/.8);
  return mix(mix(mix(mix(g0, g1, k1), g2, k2), g3, k3), g4, k4);
}
vec3 scene(vec2 fc){
  S = uS;
  vec2 uv = (fc - .5*uRes)/uRes.y;
  vec3 ro = vec3(0., 0., -3.4), rd = normalize(vec3(uv, 1.4));
  vec3 bg = vec3(.045);
  float t = 0.; bool hit = false;
  for (int i=0;i<110;i++){ float d = map(ro + rd*t); if (d < .0008){ hit = true; break; } t += d*.8; if (t > 7.) break; }
  vec3 col = bg;
  if (hit) {
    vec3 p = ro + rd*t, n = calcN(p);
    vec3 base = gradient(p);
    vec3 L = normalize(vec3(.6,.8,-.3));
    float spec = pow(max(dot(reflect(rd,n),L),0.), 40.), rim = pow(1.-max(dot(n,-rd),0.), 3.);
    col = base*(.35 + .75*(dot(n,L)*.5+.5)) + spec*.25 + rim*.25;      // identical to scene 20's smoothed sphere
    // ref-style matte velvet: soft sheen at grazing angles + gentle subsurface glow in thin parts
    float sheen = pow(1.-max(dot(n,-rd),0.), 1.6);
    col += base*sheen*.18*clamp(S*2.,0.,1.);
  }
  col = pow(col, vec3(.9)); col = col/(1.+col*.25);
  col *= 1. - .35*dot(uv,uv);
  return col;
}` }));
})();
