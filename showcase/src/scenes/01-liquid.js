// 01 Liquid morph — chrome metaball liquid, shape morphing, neck-pinch / break / merge
(() => { const E = Engine;
E.register(1, E.shaderScene({ w: 1280, h: 720, hudDark: false, frag: `
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b) - h*h*k*.25; }
float sdBox(vec2 p, vec2 b, float r){ vec2 d = abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
float sdStar(vec2 p, float r, float n, float m){
  float an = PI/n, en = PI/m; vec2 acs = vec2(cos(an),sin(an)), ecs = vec2(cos(en),sin(en));
  float bn = mod(atan(p.x,p.y), 2.*an) - an; p = length(p)*vec2(cos(bn), abs(sin(bn)));
  p -= r*acs; p += ecs*clamp(-dot(p,ecs), 0., r*acs.y/ecs.y); return length(p)*sign(p.x); }
float sdTri(vec2 p, float r){ const float k = sqrt(3.); p.x = abs(p.x)-r; p.y = p.y + r/k; if (p.x+k*p.y>0.) p = vec2(p.x-k*p.y, -k*p.x-p.y)/2.; p.x -= clamp(p.x,-2.*r,0.); return -length(p)*sign(p.y); }
float shapeD(int i, vec2 p){
  if (i==0) return length(p)-.30;
  if (i==1) return sdBox(p, vec2(.27), .08);
  if (i==2) return sdStar(p, .36, 5., 3.2) - .02;
  if (i==3) return abs(length(p)-.27)-.075;
  if (i==4) return sdTri(p*rot(.2), .2) - .06;
  return length(p*vec2(.62,1.))-.3;
}
const float KS = 11.;
float sunion(float acc, float d){ return acc + exp(-KS*d); }
float field(vec2 p, float s){
  float t = s;
  // viscous noise warp
  p += .035*vec2(gnoise(p*3.+t*.6), gnoise(p*3.+9.-t*.5));
  float sh = t*.95 + 4.; int i0 = int(mod(floor(sh),6.)); int i1 = int(mod(floor(sh)+1.,6.)); float f = ease(fract(sh));
  float acc = exp(-KS*mix(shapeD(i0,p), shapeD(i1,p), f));
  float pulse = smoothstep(1.8,2.6,t)*(1.-smoothstep(2.8,3.5,t));      // climax: all pulled into the core
  float R = mix(.62, .04, pulse);
  for (int i=0;i<6;i++){
    float fi = float(i);
    float w = .55 + .21*fi; float ph = fi*1.7;
    vec2 c = vec2(cos(w*t+ph)*1.35, sin(w*1.31*t+ph*1.3)*.72) * (R/.62);
    c = mix(c, vec2(cos(fi*1.047+t*.8), sin(fi*1.047+t*.8))*R, pulse*.0);
    float r = .09 + .05*hash11(fi+3.) + pulse*.04;
    acc = sunion(acc, (length(p-c)-r)*.85);
  }
  return -log(acc)/KS;
}
vec3 env(vec3 r, float s){
  float h = r.y*.5+.5;
  vec3 sky = mix(vec3(.02,.01,.10), vec3(.95,.30,.85), smoothstep(.25,.9,h));
  sky = mix(sky, vec3(.15,.85,1.), smoothstep(.55,.0,abs(r.x*.8+r.y*.2-.1))*.7);
  float bands = smoothstep(.0,.25, sin(r.y*6.+r.x*2.5+s*.9)-.7);
  sky += bands*vec3(1.,.95,.9)*.8;
  float hor = smoothstep(.02,.0,abs(r.y+.12)); sky += hor*vec3(1.,.8,.4)*1.1;
  sky += pal(r.x*.6+r.y*.4+s*.08, vec3(.5),vec3(.5),vec3(1.),vec3(0.,.33,.67))*.25;
  return sky;
}
vec3 scene(vec2 fc){
  vec2 uv = (fc - .5*uRes)/uRes.y;
  float s = uS;
  float d = field(uv, s);
  vec3 bg = mix(vec3(.03,.02,.12), vec3(.10,.03,.20), length(uv)*.9);
  bg += .06*pal(uv.x*.5+s*.1, vec3(.5),vec3(.5),vec3(1.),vec3(0.,.1,.2))*smoothstep(.9,.0,length(uv));
  bg += vec3(.9,.25,.8)*exp(-max(d,0.)*7.)*.18;
  if (d > 0.){
    return bg;
  }
  float eps = .028;
  vec2 g = vec2(field(uv+vec2(eps,0.),s)-field(uv-vec2(eps,0.),s), field(uv+vec2(0.,eps),s)-field(uv-vec2(0.,eps),s))/(2.*eps);
  float fp = 9.*exp(9.*d);
  vec3 n = normalize(vec3(g*fp*.16, 1.));
  vec3 v = vec3(0.,0.,1.);
  vec3 r = reflect(-v, n);
  float fr = pow(1.-n.z, 2.5);
  vec3 col = env(r, s)*.95;
  col += fr*vec3(.4,.9,1.)*.8;
  col += pow(max(dot(r, normalize(vec3(-.4,.6,.7))),0.),80.)*1.6;
  float edge = smoothstep(.0,.01,-d); col = mix(bg, col, edge);
  return col;
}` }));
})();
