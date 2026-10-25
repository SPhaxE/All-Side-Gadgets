// 07 Clay 3D — three clay characters hopping (squash & stretch), matte pastel material with thumbprint bumps, soft shadow + AO, 15fps stop-motion
(() => { const E = Engine;
E.register(7, E.shaderScene({ w: 1280, h: 720, hudDark: true, frag: `
float T_, FJ;
float h3(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float gnoise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.; }
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
float sdRBox(vec3 p, vec3 b, float r){ vec3 q = abs(p)-b+r; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }
float sdCapsule(vec3 p, float h, float r){ p.y -= clamp(p.y,-h,h); return length(p)-r; }
// returns (distance, material): 0 ground, 1 coral, 2 teal, 3 yellow, 4 eye white, 5 pupil
vec2 hop(int i){
  float fi = float(i);
  float per = 1.5;
  float ph = fract((T_ - fi*.34)/per);
  float u = clamp(ph/.55, 0., 1.);
  float y = 4.*u*(1.-u)*1.15;
  float vy = (1.-2.*u);
  float air = step(ph,.55);
  float land = (1.-air) * exp(-(ph-.55)*9.) ;
  float ant = (1.-air) * smoothstep(.85,1.,ph);                 // anticipation crouch
  float sy = 1. + air*.22*vy*vy*0. + air*.16*(abs(vy)) - land*.30*cos((ph-.55)*18.) - ant*.18;
  float sx = 1./sqrt(max(sy,.5));
  return vec2(y, sy) ;
}
vec2 map(vec3 p){
  vec2 res = vec2(p.y, 0.);
  for (int i=0;i<3;i++){
    float fi = float(i);
    vec2 h = hop(i); float y = h.x, sy = h.y; float sx = 1./sqrt(max(sy,.5));
    float jit = (hash11(FJ + fi*7.1)-.5)*.018;
    vec3 c = vec3(-1.75+1.75*fi + jit, .0, .0);
    vec3 q = p - c; q.y -= y;
    float rad = i==0 ? .62 : (i==1 ? .56 : .5);
    float cy = rad*sy;                                    // body centre height after squash
    q.y -= cy; q.xz /= sx; q.y /= sy;
    float d;
    if (i==0) d = length(q)-rad;
    else if (i==1){ q.xz *= rot(.35*sin(T_*2.+1.) + .15); d = sdRBox(q, vec3(rad), .22); }
    else { d = sdCapsule(q, .32, rad*.78); }
    d *= min(sx, sy)*.9;
    vec2 body = vec2(d, float(i+1));
    if (body.x < res.x) res = body;
    // eyes (front = -z)
    float blink = 1. - .9*smoothstep(.0,.06,abs(fract(T_*.45+fi*.3)-.5)-.47);
    for (int e=0;e<2;e++){
      float sg = e==0 ? -1. : 1.;
      vec3 ep = vec3(sg*rad*.38, rad*.22, i==1 ? -rad*1.0 : -rad*.80);
      vec3 qe = (p - c); qe.y -= y; qe.y -= cy; qe.xz /= sx; qe.y /= sy;
      qe -= ep;
      float de = length(qe*vec3(1.,1./blink,1.)) - rad*.20;
      de *= min(sx,sy)*.9;
      if (de < res.x) res = vec2(de, 4.);
      float dp = length(qe - vec3(sg*.0,-.01,-rad*.12)*1.) - rad*.10;
      dp *= min(sx,sy)*.9;
      if (dp < res.x) res = vec2(dp, 5.);
    }
  }
  return res;
}
vec3 calcN(vec3 p){ vec2 e = vec2(.002,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }
float softShadow(vec3 ro, vec3 rd){
  float res = 1., t = .05;
  for (int i=0;i<28;i++){ float h = map(ro+rd*t).x; res = min(res, 9.*h/t); t += clamp(h,.04,.4); if (res<.001||t>8.) break; }
  return clamp(res,0.,1.);
}
float calcAO(vec3 p, vec3 n){ float o = 0., sc = 1.; for (int i=0;i<5;i++){ float h = .02+.13*float(i); o += (h - map(p+n*h).x)*sc; sc *= .8; } return clamp(1.-1.8*o,0.,1.); }
vec3 scene(vec2 fc){
  float s = uS;
  T_ = floor(s*15.+.5)/15.; FJ = floor(s*15.+.5);
  vec2 uv = (fc - .5*uRes)/uRes.y;
  float push = smoothstep(1.8,3.0,s)*(1.-smoothstep(3.6,4.8,s));
  vec3 ro = vec3(0.+.15*sin(T_*.5), 1.9-.25*push, -7.6+1.2*push);
  vec3 ta = vec3(0., .85, 0.);
  vec3 f = normalize(ta-ro), r = normalize(cross(f,vec3(0,1,0))), u = cross(r,f);
  vec3 rd = normalize(f*1.55 + r*uv.x + u*uv.y);
  vec3 bgTop = vec3(1.,.80,.70), bgBot = vec3(.99,.68,.62);
  vec3 col = mix(bgBot, bgTop, smoothstep(-.4,.5,uv.y));
  float t = 0.; vec2 h = vec2(1e9,-1.); 
  for (int i=0;i<90;i++){ h = map(ro+rd*t); if (h.x<.0015*t) break; t += h.x*.9; if (t>26.) { h.y = -1.; break; } }
  if (t < 26. && h.y > -.5){
    vec3 p = ro+rd*t; vec3 n = calcN(p);
    // thumbprint / hand-sculpted bumps
    float bump = gnoise3(p*9.+h.y*3.)*.5 + gnoise3(p*34.)*.22;
    vec3 gn = vec3(gnoise3(p*14.+1.), gnoise3(p*14.+5.), gnoise3(p*14.+9.));
    n = normalize(n + gn*.10*(h.y<.5?.35:1.) );
    vec3 base = h.y < .5 ? vec3(1.,.90,.80) : (h.y<1.5 ? vec3(.97,.40,.34) : (h.y<2.5 ? vec3(.22,.69,.68) : (h.y<3.5 ? vec3(.99,.80,.30) : (h.y<4.5 ? vec3(.99,.98,.96) : vec3(.07,.06,.08)))));
    if (h.y>=.5 && h.y<3.5) base *= .94 + .1*bump;
    vec3 L = normalize(vec3(-.55,.85,-.45));
    float sh = softShadow(p+n*.02, L);
    float ao = calcAO(p, n);
    float wrap = clamp((dot(n,L)+.35)/1.35, 0., 1.); wrap = wrap*wrap*(3.-2.*wrap);
    vec3 amb = mix(vec3(.62,.46,.52), vec3(.95,.82,.78), n.y*.5+.5);
    vec3 lc = vec3(1.,.93,.84);
    vec3 c = base*(amb*.55*ao + lc*wrap*(.35+.65*sh)*1.15);
    // soft subsurface-like tint in shadows
    c += base*vec3(.25,.05,.03)*(1.-wrap)*.25*ao;
    float sheen = pow(max(dot(reflect(rd,n),L),0.), 24.)*.10*(h.y<.5?0.:1.)*sh;
    if (h.y>3.5) sheen *= 6.;
    c += sheen;
    float fog = 1.-exp(-t*.016);
    col = mix(c, mix(bgBot,bgTop,.4), h.y<.5 ? fog*1.4 : fog*.3);
  }
  col *= 1. - .22*dot(uv,uv);
  return col;
}` }));
})();
