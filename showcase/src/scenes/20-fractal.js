// 20 Ray-marched fractals — Mandelbulb dive, orbit-trap colouring, fog, glow
(() => { const E = Engine;
E.register(20, E.shaderScene({ w: 1280, h: 720, hudDark: false, frag: `
float POW;
float map(vec3 p, out vec4 trap){
  vec3 w = p; float m = dot(w,w); float dz = 1.;
  trap = vec4(abs(w), m);
  for (int i=0;i<7;i++){
    dz = POW*pow(m,(POW-1.)*.5)*dz + 1.;
    float r = length(w);
    float b = POW*acos(clamp(w.y/r,-1.,1.)); float a = POW*atan(w.x,w.z);
    w = p + pow(r,POW)*vec3(sin(b)*sin(a), cos(b), sin(b)*cos(a));
    trap = min(trap, vec4(abs(w), m));
    m = dot(w,w);
    if (m > 256.) break;
  }
  return .25*log(m)*sqrt(m)/dz;
}
float de(vec3 p){ vec4 t; return map(p,t); }
vec3 calcN(vec3 p, float e){
  vec2 k = vec2(1.,-1.);
  return normalize(k.xyy*de(p+k.xyy*e)+k.yyx*de(p+k.yyx*e)+k.yxy*de(p+k.yxy*e)+k.xxx*de(p+k.xxx*e));
}
vec3 scene(vec2 fc){
  vec2 uv = (fc - .5*uRes)/uRes.y;
  float s = uS;
  float k = (s+.45)/(4.5+.9);                 // 0..1 over the scene's visible life
  POW = mix(3.2, 8., ease(k*1.5)) + .35*sin(s*1.3);
  float R = mix(3.9, 2.05, easeO(k));         // dive
  float a = .6 + s*.42, el = .45 + .25*sin(s*.5);
  vec3 ro = R*vec3(cos(a)*cos(el), sin(el), sin(a)*cos(el));
  vec3 ta = vec3(0.,.0,0.);
  vec3 f = normalize(ta-ro), rt = normalize(cross(f,vec3(0.,1.,0.))), up = cross(rt,f);
  vec3 rd = normalize(f*1.35 + rt*uv.x + up*uv.y);
  vec3 bg = mix(vec3(.01,.0,.04), vec3(.08,.02,.16), smoothstep(-.6,.6,uv.y)) + .05*vec3(.6,.2,1.)*exp(-dot(uv,uv)*2.);
  float t = 0., minD = 1e9; int steps = 0; bool hit = false; vec4 tr;
  for (int i=0;i<120;i++){
    vec3 p = ro + rd*t; float d = map(p, tr);
    minD = min(minD, d/ max(t,.1));
    if (d < .0006*t) { hit = true; steps = i; break; }
    t += d*.9; steps = i;
    if (t > 7.) break;
  }
  vec3 col = bg;
  float glow = exp(-minD*14.);
  if (hit){
    vec3 p = ro + rd*t; vec3 n = calcN(p, .0015*t);
    vec4 q; map(p, q);
    vec3 base = pal(q.x*1.3 + q.w*.18 + .08*s, vec3(.45,.4,.5), vec3(.55,.5,.5), vec3(1.,1.,.8), vec3(.0,.33,.6));
    base = mix(base, vec3(1.,.5,.1), smoothstep(.0,.25,q.y)*.55);
    base *= base*1.4;
    float ao = 1. - float(steps)/120.; ao = pow(ao, 2.4);
    vec3 L = normalize(vec3(.6,.8,-.3)); vec3 L2 = normalize(vec3(-.7,.2,.6));
    float dif = max(dot(n,L),0.), dif2 = max(dot(n,L2),0.);
    float spec = pow(max(dot(reflect(rd,n),L),0.), 40.);
    float rim = pow(1.-max(dot(n,-rd),0.), 3.);
    col = base*(.06 + 1.15*dif + .5*dif2*vec3(.2,.5,1.))*ao*1.4 + spec*.7*ao + rim*vec3(.2,.6,1.)*1.1*ao;
    col = mix(col, bg, 1.-exp(-t*t*.02));
  }
  col += glow * vec3(.55,.25,1.) * .55 * (hit?.5:1.);
  col = pow(col, vec3(.9)); col = col/(1.+col*.25);
  col *= 1. - .35*dot(uv,uv);
  return col;
}` }));
})();
