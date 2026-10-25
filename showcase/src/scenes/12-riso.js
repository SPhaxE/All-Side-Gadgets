// 12 Risograph print — fluorescent pink / blue / yellow spot inks multiplied on paper, grainy stochastic coverage, drifting mis-registration, roller reveal
(() => { const E = Engine;
E.register(12, E.shaderScene({ hudDark: true, frag: `
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float sdTri(vec2 p, float r){ const float k = sqrt(3.); p.x = abs(p.x)-r; p.y = p.y + r/k; if (p.x+k*p.y>0.) p = vec2(p.x-k*p.y, -k*p.x-p.y)/2.; p.x -= clamp(p.x,-2.*r,0.); return -length(p)*sign(p.y); }
// coverage fields (0..1) in screen-normalised space, y up, height = 1
float pinkField(vec2 p, float s){
  float pulse = smoothstep(2.2,2.8,s)*(1.-smoothstep(2.9,3.7,s));
  vec2 c = vec2(-.22+.025*sin(s*.9), .07+.02*cos(s*.8));
  float R = .30 + .04*pulse;
  float disc = smoothstep(.003,-.003, length(p-c)-R);
  float tone = .72 + .28*smoothstep(-.3,.3,p.y-c.y);
  // rays
  vec2 d = p-c; float ang = atan(d.y,d.x); float r = length(d);
  float rays = step(.5, fract(ang/TAU*18. + s*.06)) * smoothstep(R+.02,R+.05,r) * smoothstep(.62,.38,r) * .75;
  // diagonal stripe band lower right
  float band = step(.5, fract((p.x*1.0 - p.y*1.0)*9. + s*.2)) * smoothstep(.0,.04,p.x-.18) * smoothstep(-.1,-.14,p.y) * smoothstep(-.5,-.3,p.y) * 0.0;
  return max(disc*tone, rays);
}
float blueField(vec2 p, float s){
  float f = 0.;
  for (int i=0;i<3;i++){
    float fi = float(i);
    float y = -.14 - fi*.11 + .05*sin(p.x*(3.5+fi*1.4) + s*(.5+fi*.2) + fi*2.);
    float m = smoothstep(.003,-.003, p.y - y);
    float tone = mix(.95, .45, fi*.5) ;
    f = max(f, m*tone*(i==0?1.:1.));
  }
  // moon + dot grid sky
  float moon = smoothstep(.003,-.003, length(p-vec2(.40,.28)+.02*vec2(sin(s*.7),cos(s*.6)))-.07);
  vec2 g = fract(p*vec2(1.78,1.)*22.)-.5; float dots = smoothstep(.22,.16,length(g)) * smoothstep(.1,.45,p.y) * step(p.x,-.2)*.8;
  return max(f, max(moon, dots));
}
float yellowField(vec2 p, float s){
  float pulse = smoothstep(2.2,2.8,s)*(1.-smoothstep(2.9,3.7,s));
  vec2 c = vec2(-.10+.05*cos(s*.7), .16+.03*sin(s*.9));
  float disc = smoothstep(.003,-.003, length(p-c)-(.21+.03*pulse));
  float tri = smoothstep(.003,-.003, sdTri((p-vec2(.38,-.04))*rot(s*.25), .13));
  float star = 0.; for (int i=0;i<5;i++){ float a = float(i)/5.*TAU+s*.3; star = max(star, smoothstep(.012,.0, sdSeg(p-vec2(-.5,.3), vec2(0.), vec2(cos(a),sin(a))*.08))); }
  return max(max(disc*.92, tri), star);
}
float ink(float cov, vec2 fc, float seed){
  float g = .62*hash21(floor(fc/1.3)+seed*13.7) + .38*(fbm(fc*.012+seed)*.5+.5);
  return smoothstep(g-.05, g+.05, cov*.985);
}
vec3 scene(vec2 fc){
  float s = uS;
  vec3 paper = vec3(.955,.93,.875);
  float fiber = .5+.5*gnoise(fc*vec2(.9,.12)); paper *= .965 + .035*fiber + .02*hash21(fc);
  float mis = 5. + 11.*smoothstep(2.0,2.7,s)*(1.-smoothstep(2.9,3.8,s)) + 1.5*sin(s*1.7);
  vec2 oP = vec2(cos(s*.6),sin(s*.5))*mis, oB = vec2(sin(s*.45+2.),cos(s*.55))*mis, oY = vec2(cos(s*.35+4.),sin(s*.4+1.))*mis*.8;
  vec2 nrm = vec2(uRes.y*.5);
  // roller reveal per layer (top -> bottom)
  float yn = fc.y/uRes.y;
  float rP = smoothstep(.0,.04, (1.35 - (s+.6)*1.3) - (1.-yn)*0. - (1.-yn)) ;
  float rB = smoothstep(.0,.04, (1.35 - (s-.0)*1.3) - (1.-yn));
  float rY = smoothstep(.0,.04, (1.35 - (s-.6)*1.3) - (1.-yn));
  float revP = 1.-smoothstep(.0,.04, yn - (1.2-(s+.6)*1.4)); float revB = 1.-smoothstep(.0,.04, yn - (1.2-(s+.0)*1.4)); float revY = 1.-smoothstep(.0,.04, yn - (1.2-(s-.6)*1.4));
  vec2 pP = (fc+oP - .5*uRes)/uRes.y, pB = (fc+oB - .5*uRes)/uRes.y, pY = (fc+oY - .5*uRes)/uRes.y;
  float iP = ink(pinkField(pP,s), fc+oP, 1.) * (s>.0 ? 1. : revP*step(-.6,s)) ;
  float iB = ink(blueField(pB,s), fc+oB, 2.) * (s>.7 ? 1. : revB);
  float iY = ink(yellowField(pY,s), fc+oY, 3.) * (s>1.3 ? 1. : revY);
  vec3 col = paper;
  col *= mix(vec3(1.), vec3(1.,.30,.58), iP*.94);
  col *= mix(vec3(1.), vec3(.0,.47,.78), iB*.92);
  col *= mix(vec3(1.), vec3(1.,.88,.05), iY*.95);
  col += (hash21(fc*1.7+s)-.5)*.02;
  return col;
}` }));
})();
