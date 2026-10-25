// 15 Glassmorphism — saturated moving crisp shapes behind frosted-glass UI cards (analytic blur, bevel highlight, noise, soft shadow, parallax)
(() => { const E = Engine;
E.register(15, E.shaderScene({ hudDark: false, frag: `
float sdRBox(vec2 p, vec2 b, float r){ vec2 d = abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
float sdTri(vec2 p, float r){ const float k = sqrt(3.); p.x = abs(p.x)-r; p.y = p.y + r/k; if (p.x+k*p.y>0.) p = vec2(p.x-k*p.y, -k*p.x-p.y)/2.; p.x -= clamp(p.x,-2.*r,0.); return -length(p)*sign(p.y); }
float cov(float d, float w){ return smoothstep(w,-w,d); }
vec3 bgc(vec2 p, float w){
  float s = uS;
  vec3 col = mix(vec3(.16,.05,.42), vec3(.02,.30,.62), smoothstep(-.5,.5,p.y + .15*sin(p.x*2.+s*.4)));
  col += vec3(.55,.1,.5)*exp(-length(p-vec2(.5,.3))*2.2)*.5;
  // big orange ring
  vec2 c1 = vec2(-.38+.08*sin(s*.5), .02+.06*cos(s*.4));
  col = mix(col, vec3(1.,.55,.12), cov(abs(length(p-c1)-.26)-.05, w)*.95);
  // pink disc
  vec2 c2 = vec2(.45+.06*cos(s*.45), .22+.05*sin(s*.6));
  col = mix(col, vec3(1.,.2,.58), cov(length(p-c2)-.20, w));
  // cyan disc bottom
  vec2 c3 = vec2(.05+.1*sin(s*.35+1.), -.30+.04*cos(s*.5));
  col = mix(col, vec3(.1,.9,.95), cov(length(p-c3)-.17, w));
  // yellow orbs with highlight
  for (int i=0;i<4;i++){ float fi = float(i); vec2 c = vec2(cos(s*(.3+.1*fi)+fi*1.9)*.62, sin(s*(.4+.08*fi)+fi*2.3)*.30);
    float r = .045+.015*fi; float d = length(p-c)-r;
    vec3 oc = mix(vec3(1.,.9,.2), vec3(1.,.5,.1), fi/4.);
    float hl = smoothstep(r*.8,0.,length(p-c-vec2(-.4,.4)*r));
    col = mix(col, oc + hl*.5, cov(d, w)); }
  // lime triangle
  col = mix(col, vec3(.6,1.,.25), cov(sdTri((p-vec2(.18+.05*sin(s*.6),.34))*rot(s*.4), .09), w));
  // violet thin ring
  col = mix(col, vec3(.8,.5,1.), cov(abs(length(p-vec2(-.1,-.1))-.12)-.012, w)*.9);
  return col;
}
// card style: behind colour is already blurred
vec3 glass(vec3 behind, float d, vec2 q, float seed){
  vec3 c = behind*.82 + vec3(.20,.22,.30)*.55;
  c += (hash21(q*900.+seed)-.5)*.045;
  float bevel = smoothstep(.010,.0,abs(d+.003));
  float lit = dot(normalize(q+1e-4), vec2(-.65,.75))*.5+.5;
  c += bevel*(.15+.7*lit);
  c += smoothstep(.05,.0,-d)*.06;
  return c;
}
float bar(vec2 p, vec2 c, vec2 hs){ return cov(sdRBox(p-c, hs, hs.y), .0015); }
vec3 layer12(vec2 p){
  float s = uS;
  vec3 col = bgc(p, .004);
  // card 1 (far): profile
  vec2 c1 = vec2(.44+.03*sin(s*.5), .22+.015*cos(s*.7)); vec2 h1 = vec2(.21,.13);
  float d1 = sdRBox(p-c1, h1, .05);
  col *= 1. - .3*smoothstep(.07,.0,sdRBox(p-c1-vec2(.01,-.025), h1, .05));
  if (d1 < 0.){
    vec3 bh = bgc(p+vec2(.012*sin(p.y*30.),0.), .06);
    vec3 g = glass(bh, d1, p-c1, 1.);
    vec2 q = p-c1;
    g = mix(g, vec3(1.), cov(length(q-vec2(-.12,.0))-.05, .002)*.9);
    g = mix(g, vec3(1.), bar(q, vec2(.045,.025), vec2(.10,.008))*.85);
    g = mix(g, vec3(1.), bar(q, vec2(.03,-.01), vec2(.075,.007))*.5);
    g = mix(g, vec3(1.,.9,.4), bar(q, vec2(.035,-.06), vec2(.08,.014))*.85);
    col = g;
  }
  // card 2 (mid): circular progress
  vec2 c2 = vec2(.32+.025*cos(s*.45), -.22+.02*sin(s*.6)); vec2 h2 = vec2(.17,.17);
  float d2 = sdRBox(p-c2, h2, .07);
  col *= 1. - .3*smoothstep(.07,.0,sdRBox(p-c2-vec2(.01,-.025), h2, .07));
  if (d2 < 0.){
    vec3 bh = bgc(p+vec2(.0,.012*sin(p.x*30.)), .06);
    vec3 g = glass(bh, d2, p-c2, 2.);
    vec2 q = p-c2; float ring = abs(length(q)-.095)-.012;
    float a = fract(atan(q.x,q.y)/TAU); float prog = .25 + .5*(.5+.5*sin(s*.9));
    g = mix(g, vec3(1.), cov(ring,.002)*(a<prog?1.:.22));
    g = mix(g, vec3(1.), bar(q, vec2(0.,.0), vec2(.03,.01))*.9);
    col = g;
  }
  return col;
}
vec3 scene(vec2 fc){
  vec2 p = (fc - .5*uRes)/uRes.y; float s = uS;
  vec3 col = layer12(p);
  // card 0 (front): dashboard
  float pulse = smoothstep(2.2,2.8,s)*(1.-smoothstep(2.9,3.6,s));
  vec2 c0 = vec2(-.14+.035*sin(s*.4), .01+.02*cos(s*.5)); vec2 h0 = vec2(.36+.01*pulse,.215+.01*pulse);
  float d0 = sdRBox(p-c0, h0, .055);
  col *= 1. - .34*smoothstep(.08,.0,sdRBox(p-c0-vec2(.012,-.03), h0, .055));
  if (d0 < 0.){
    float k = .022;
    vec3 bh = (layer12(p+vec2(k,0.))+layer12(p-vec2(k,0.))+layer12(p+vec2(0.,k))+layer12(p-vec2(0.,k)))*.25;
    bh = mix(bh, bgc(p+vec2(.015*sin(p.y*25.+s),0.), .08), .45);
    vec3 g = glass(bh, d0, p-c0, 3.);
    vec2 q = p-c0;
    g = mix(g, vec3(1.), bar(q, vec2(-.19,.15), vec2(.10,.014))*.92);
    g = mix(g, vec3(1.), bar(q, vec2(-.16,.10), vec2(.17,.008))*.55);
    g = mix(g, vec3(1.), bar(q, vec2(-.19,.07), vec2(.13,.008))*.4);
    float on = .5+.5*sin(s*1.4);
    g = mix(g, mix(vec3(.55,.58,.7), vec3(.55,1.,.4), on), bar(q, vec2(.27,.15), vec2(.05,.026)));
    g = mix(g, vec3(1.), cov(length(q-vec2(.27+(on-.5)*.05,.15))-.021, .0015));
    for (int i=0;i<7;i++){ float fi = float(i); float hh = .035 + .10*(.5+.5*sin(s*1.7+fi*.9));
      vec3 bc = mix(vec3(.4,1.,1.), vec3(1.,.5,.95), fi/6.);
      g = mix(g, bc, cov(sdRBox(q-vec2(-.25+fi*.065,-.18+hh*.5), vec2(.019,hh*.5), .012), .0015)*.95); }
    // sparkline
    float sx = (q.x-.02)/.3; if (sx>0. && sx<1.){ float yy = -.02 + .07*sin(sx*9.+s*2.) + .03*sin(sx*17.-s*3.); g = mix(g, vec3(1.), smoothstep(.004,.0,abs(q.y-yy+.0)-.002)*.95); }
    col = g;
  }
  col *= 1. - .3*dot(p,p);
  return col;
}` }));
})();
