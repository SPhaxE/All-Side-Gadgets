// 08 Halftone dots — pop-art sun/moon image printed as rotated CMYK screens (15/75/0/45), subtractive overprint on paper
(() => { const E = Engine;
E.register(8, E.shaderScene({ hudDark: true, frag: `
const float CELL = 15.;
vec3 srcImg(vec2 fc, float s){
  vec2 uv = (fc - .5*uRes)/uRes.y;
  float pulse = smoothstep(2.0,2.7,s)*(1.-smoothstep(2.9,3.7,s));
  // background: diagonal teal->blue with bands
  float g = uv.x*.6 + uv.y*.8;
  vec3 bg = mix(vec3(.05,.78,.78), vec3(.10,.22,.78), smoothstep(-.6,.6,g + .12*sin(s*.8)));
  bg = mix(bg, bg*.7+vec3(.1,0.,.2), smoothstep(.55,.62, sin(g*14.+s*1.5)*.5+.5)*.6);
  // sun
  vec2 sc = vec2(-.18+.06*sin(s*.7), .04+.04*cos(s*.9));
  float R = .36 + .05*pulse + .015*sin(s*2.);
  vec2 d = uv - sc; float r = length(d);
  vec3 col = bg;
  if (r < R){
    vec3 n = vec3(d/R, sqrt(max(1.-r*r/(R*R),0.)));
    vec3 l = normalize(vec3(-.5,.6,.65));
    float dif = clamp(dot(n,l)*.5+.55,0.,1.);
    vec3 warm = mix(vec3(.95,.12,.55), vec3(1.,.93,.1), pow(dif,1.3));
    col = warm;
  }
  // moon
  float a = s*.9+1.; vec2 mc = sc + vec2(cos(a)*.62, sin(a)*.32); float mr = .1+.02*pulse;
  vec2 dm = uv - mc; if (length(dm) < mr){ vec3 n = vec3(dm/mr, sqrt(max(1.-dot(dm,dm)/(mr*mr),0.))); float dif = clamp(dot(n,normalize(vec3(-.5,.6,.65)))*.5+.55,0.,1.); col = mix(vec3(.05,.1,.5), vec3(.55,.95,1.), dif); }
  // ripple from sun on climax
  float rip = exp(-pow((r-(s-2.6)*.6)*10.,2.))*step(2.6,s); col = mix(col, vec3(1.,.95,.85), rip*.6);
  // ground stripes
  float gy = uv.y + .43; if (gy < 0.){ col = mix(vec3(.12,.05,.35), vec3(.95,.2,.5), smoothstep(.0,-.12,gy)*.0 + .5*(.5+.5*sin(-gy*40.+ s*2.))); }
  return col;
}
vec4 toCMYK(vec3 c){ float k = 1.-max(c.r,max(c.g,c.b)); float inv = 1./max(1.-k,1e-3); return vec4((1.-c.r-k)*inv,(1.-c.g-k)*inv,(1.-c.b-k)*inv,k); }
float screen(vec2 fc, float ang, float val, float aa){
  mat2 R = rot(ang);
  vec2 q = R*fc/CELL; vec2 f = fract(q)-.5;
  float rad = sqrt(clamp(val,0.,1.))*.72;
  float d = length(f);
  return smoothstep(rad+aa, rad-aa, d);
}
vec3 scene(vec2 fc){
  float s = uS; float wob = .03*sin(s*.5);
  vec3 paper = vec3(.965,.94,.88);
  float aa = .6/CELL*1.0;
  // per-ink sample at its own cell centre
  float angs[4] = float[4](.2618+wob, 1.309+wob, 0.+wob, .7854+wob);
  vec4 cov = vec4(0.);
  for (int i=0;i<4;i++){
    mat2 R = rot(angs[i]);
    vec2 q = R*fc/CELL; vec2 cc = (floor(q)+.5);
    vec2 cp = transpose(R)*(cc*CELL);               // cell centre in screen space (rot is orthonormal)
    vec4 k = toCMYK(srcImg(cp, s));
    float v = i==0 ? k.x : (i==1 ? k.y : (i==2 ? k.z : k.w));
    float c = screen(fc, angs[i], v, aa);
    if (i==0) cov.x = c; else if (i==1) cov.y = c; else if (i==2) cov.z = c; else cov.w = c;
  }
  vec3 inkC = vec3(.0,.68,.94), inkM = vec3(.93,.0,.55), inkY = vec3(1.,.95,.0), inkK = vec3(.13,.11,.12);
  vec3 col = paper;
  col *= mix(vec3(1.), inkC, cov.x*.95);
  col *= mix(vec3(1.), inkM, cov.y*.95);
  col *= mix(vec3(1.), inkY, cov.z*.95);
  col *= mix(vec3(1.), inkK, cov.w*.97);
  col *= .96 + .04*gnoise(fc*.7);      // paper tooth
  return col;
}` }));
})();
