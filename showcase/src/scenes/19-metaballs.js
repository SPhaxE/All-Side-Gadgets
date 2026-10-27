// 19 Metaballs (v2) — inside a lava lamp: translucent wax blobs (ray-marched smooth-union metaballs with a subsurface
// approximation) rise through warm liquid, touch, neck and split; the glass bottle bends the light at the sides and a
// light shaft rises from the base. Climax: everything fuses into one big blob, then breaks into a chain of droplets.
// At the end the big blob sprouts little balls on little balls — scene 20's fractal grows out of it.
(() => { const E = Engine;
E.register(19, E.shaderScene({ scaled: true, hudDark: false, frag: `
float S, FUSE, SPROUT, BR;
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
vec3 blobC(int i){
  float fi = float(i), sp = .22 + .1*hash11(fi*3.7);
  float y = mod(S*sp + hash11(fi*1.3)*4., 4.) - 2.;                      // rise, wrap from bottom
  y = -1.05 + 2.1*smoothstep(-2., 2., y);
  vec3 c = vec3(sin(fi*2.3 + S*.3)*.75, y, cos(fi*1.7 + S*.25)*.35);
  vec3 fused = vec3(0., .1, 0.);
  vec3 chain = vec3((fi - 3.)*.62, .1 + .22*sin(fi*1.1 + S*4.), 0.);   // break into a chain of droplets after the fusion
  return mix(mix(c, fused, FUSE), chain, BR);
}
float blobR(int i){ float fi = float(i); return (.24 + .12*hash11(fi*5.1))*(1. + .3*FUSE*(1. - BR)); }
float map(vec3 p){
  float d = 1e9;
  for (int i=0;i<7;i++) d = smin(d, length(p - blobC(i)) - blobR(i), mix(.3, .7, FUSE*(1. - BR)) * (1. - .5*BR));
  // sprouting: small balls on the biggest blob, and smaller balls on those
  if (SPROUT > 0.) {
    vec3 c0 = vec3(0., .1, 0.); float r0 = .62;
    for (int k=0;k<10;k++){ float fk = float(k); float yy = 1. - 2.*(fk + .5)/10.; float rr = sqrt(1. - yy*yy); float a = fk*2.39996;
      vec3 dir = vec3(cos(a)*rr, yy, sin(a)*rr); vec3 c1 = c0 + dir*r0*1.12; float r1 = r0*.5*SPROUT;
      d = smin(d, length(p - c1) - r1, .05);
      for (int m=0;m<3;m++){ float fm = float(m); vec3 d2 = normalize(dir + vec3(cos(fm*2.1+fk), sin(fm*2.1+fk), cos(fm*1.3))*.8);
        d = smin(d, length(p - c1 - d2*r1) - r1*.42*clamp(SPROUT*1.6-.6,0.,1.), .02); }
    }
  }
  return d;
}
vec3 calcN(vec3 p){ vec2 e = vec2(.002,0.); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
vec3 scene(vec2 fc){
  S = uS; FUSE = ease((S - 3.0)/.6); BR = ease((S - 3.6)/.45)*(1. - ease((S - 4.35)/.55)); SPROUT = ease((S - 4.85)/1.0);
  vec2 q = (fc - .5*uRes)/uRes.y;
  // glass bottle: bend rays near the sides
  float side = smoothstep(.55, .86, abs(q.x));
  vec2 qr = q; qr.x += -sign(q.x)*side*side*.18; qr.y *= 1. + side*.08;
  vec3 ro = vec3(0., 0., -3.6), rd = normalize(vec3(qr, 1.6));
  // liquid
  vec3 liq = mix(vec3(.55,.18,.06), vec3(.98,.62,.18), smoothstep(.6,-.6,q.y));
  liq += vec3(1.,.75,.3)*exp(-abs(q.x)*6.)*smoothstep(.2,-.6,q.y)*.35;            // light shaft from the base
  liq += vec3(1.,.8,.4)*smoothstep(-.35,-.6,q.y)*.4;
  float t = 0., hit = 0.;
  for (int i=0;i<90;i++){ float d = map(ro + rd*t); if (d < .001){ hit = 1.; break; } t += d*.9; if (t > 8.) break; }
  vec3 col = liq;
  if (hit > 0.) {
    vec3 p = ro + rd*t, n = calcN(p);
    vec3 L = normalize(vec3(0., -1., -.3));                                     // lit from the lamp base below
    float thick = clamp(map(p - n*.18)*-4., 0., 1.);                           // thin parts glow more
    float back = pow(clamp(dot(-rd, -L)*.5 + .5, 0., 1.), 2.);
    float wrap = clamp((dot(n, L) + .4)/1.4, 0., 1.);
    vec3 wax = mix(vec3(1.,.18,.32), vec3(1.,.55,.15), clamp(p.y*.35 + .5, 0., 1.));
    vec3 c = wax*(.25 + .9*wrap) + wax*vec3(1.,.6,.4)*(1. - thick)*.9 + vec3(1.,.8,.5)*back*(1.-thick)*.5;
    float fres = pow(1. - max(dot(-rd, n), 0.), 3.);
    c += fres*vec3(1.,.85,.6)*.5;
    c += pow(max(dot(reflect(rd,n), normalize(vec3(-.5,.6,-.6))),0.), 40.)*.6;
    c = mix(c, liq, 1. - exp(-t*.03));
    col = c;
  }
  // bottle glass: refraction streaks + rim highlights
  col *= 1. - side*.25;
  col += smoothstep(.02, .0, abs(abs(q.x) - .8 - .02*q.y))*.35 + smoothstep(.05,.0,abs(abs(q.x) - .7))*.08;
  // floating micro-bubbles
  for (int i=0;i<14;i++){ float fi = float(i); vec2 bp = vec2((hash11(fi*7.7)-.5)*1.4, mod(hash11(fi*3.3)*2. + S*(.06 + .05*hash11(fi)), 1.2) - .6);
    col += vec3(1.,.9,.7)*smoothstep(.006, .0, abs(length(q - bp) - .007 - .006*hash11(fi*9.)))*.5; }
  col *= 1. - .35*dot(q,q);
  return col/(1.+col*.1);
}` }));
})();
