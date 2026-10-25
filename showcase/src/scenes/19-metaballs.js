// 19 Metaballs — flat lava-lamp metaballs: iso-contour colour bands, neck bridging, glossy rim, gather -> merge -> burst. 2D contour look (distinct from 01's chrome 3D liquid)
(() => { const E = Engine;
E.register(19, E.shaderScene({ hudDark: false, frag: `
const int N = 11;
vec2 center(int i, float s){
  float fi = float(i);
  vec2 orb = vec2(cos(s*(.45+.12*fi)+fi*2.1)*(.55+.12*sin(fi)), sin(s*(.55+.09*fi)+fi*1.3)*(.30+.06*cos(fi)));
  orb.x *= 1.35;
  float gather = smoothstep(1.7,2.5,s)*(1.-smoothstep(2.75,3.35,s));
  vec2 inner = vec2(cos(fi*2.4+s*2.)*.07, sin(fi*2.4+s*2.)*.07);
  float burst = smoothstep(2.9,3.5,s);
  vec2 out_ = orb*(1.+burst*.0);
  return mix(orb, inner, gather);
}
float radius(int i, float s){ float fi = float(i); float gather = smoothstep(1.7,2.5,s)*(1.-smoothstep(2.75,3.35,s)); return (.075+.04*hash11(fi*3.1+1.)) * (1. + .45*gather); }
vec3 scene(vec2 fc){
  vec2 p = (fc - .5*uRes)/uRes.y; float s = uS;
  float F = 0.; vec2 G = vec2(0.);
  for (int i=0;i<N;i++){
    vec2 d = p - center(i,s); float r = radius(i,s);
    float q = dot(d,d) + 1e-4; float f = r*r/q;
    F += f; G += -2.*f*d/q;
  }
  // background: hot gradient with soft halos
  vec3 bg = mix(vec3(.95,.22,.18), vec3(.55,.07,.42), smoothstep(-.5,.5,p.y + .1*sin(p.x*2.+s*.5)));
  bg = mix(bg, vec3(.20,.04,.40), smoothstep(.2,.9,length(p)));
  bg += vec3(1.,.55,.2)*smoothstep(1.,.0,F*1.0)*.0;
  bg += vec3(1.,.5,.3)*clamp(F*.18,0.,.6)*.7;
  vec3 col = bg;
  float iso = 1.;
  float aa = fwidth(F)*1.2 + 1e-4;
  float inside = smoothstep(iso-aa, iso+aa, F);
  if (inside > 0.){
    float lvl = F - iso;
    float v = log2(1. + lvl*2.2)*1.35;
    float band = clamp(floor(v), 0., 4.);
    vec3 c0 = vec3(.99,.22,.62), c1 = vec3(1.,.36,.42), c2 = vec3(1.,.62,.28), c3 = vec3(1.,.88,.42), c4 = vec3(1.,.98,.86);
    vec3 inner = band < .5 ? c0 : (band < 1.5 ? c1 : (band < 2.5 ? c2 : (band < 3.5 ? c3 : c4)));
    vec3 n = normalize(vec3(-G*.05, 1.));
    float spec = pow(max(dot(n, normalize(vec3(-.5,.7,.6))),0.), 40.);
    float rim = pow(1.-n.z, 2.);
    inner *= .9 + .12*n.z;
    inner += spec*.5 + rim*vec3(.4,.1,.3)*.25;
    float fv = fract(v); float edgeD = min(fv, 1.-fv)/(fwidth(v)+1e-4);
    inner = mix(inner, vec3(.45,.05,.25), (1.-smoothstep(.5,1.5,edgeD))*.55*step(v,4.));
    col = mix(col, inner, inside);
  }
  // outline ring of the iso surface
  float ring = 1. - smoothstep(0., 2.2*aa+.004, abs(F-iso));
  col = mix(col, vec3(1.,.98,.92), ring*.9*(1.-inside*.0));
  // floating bubbles
  for (int i=0;i<10;i++){ float fi = float(i); vec2 bp = vec2((hash11(fi*7.7)-.5)*1.6, fract(hash11(fi*3.3)+s*(.05+.04*hash11(fi))) - .5)*vec2(1.,1.1); float br = .008+.012*hash11(fi*9.1);
    float d = length(p-bp)-br; col = mix(col, vec3(1.,.9,.8), smoothstep(.002,.0,abs(d))*.6); }
  col *= 1. - .3*dot(p,p);
  return col;
}` }));
})();
