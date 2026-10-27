// 03 Holographic foil (v2) — diffraction-grating holographic film (colour from angle, lambda = d|k|/m, three orders),
// silver mirror base reflecting a dark studio with two softboxes, a mosaic of grating patches that flash independently,
// ridged creases, a moving point light. Camera: top-down (glyph emboss from 02) -> low glide -> top-down emblem -> grid cut.
(() => { const E = Engine;
E.register(3, E.shaderScene({ scaled: true, hudDark: false,
  uniforms(p, s, tg, gl) { if (E.atlas) E.bindTex(5, E.atlas, p.u.uAtlas); },
  frag: `
uniform sampler2D uAtlas;
float tdOf(float s){ return clamp(1. - ease((s-.25)/.9) + ease((s-3.25)/.6), 0., 1.); }
float crumpleOf(float s){ return (1. - ease((s-3.45)/.45)) * (.35 + .65*ease((s+.2)/1.2)); }
float hfield(vec2 P, float s){
  float h = .035*sin(P.x*2.3 + P.y*1.2 + s*1.5) + .028*sin(-P.x*1.3 + P.y*2.7 - s*1.15);
  float zc = mix(-1.5, 7., ease((s-2.4)/1.3));                         // the big crest rolling through at beat 3
  h += .12*exp(-pow((P.y - zc)*2.,2.))*step(2.2,s)*(1.-step(3.9,s));
  float cr = crumpleOf(s);                                              // sharp creases with curved faces (ridged noise)
  h -= cr*(.030*abs(gnoise(P*2.1 + vec2(3.1, s*.05))) + .014*abs(gnoise(P*5.3 + 7.)) + .006*abs(gnoise(P*11.+1.)));
  return h * (1. - .93*ease((s-3.45)/.45));
}
vec3 spec(float l){
  vec3 c = vec3(0.);
  if (l < 380. || l > 750.) return c;
  if (l < 440.) c = vec3(-(l-440.)/60., 0., 1.); else if (l < 490.) c = vec3(0., (l-440.)/50., 1.);
  else if (l < 510.) c = vec3(0., 1., -(l-510.)/20.); else if (l < 580.) c = vec3((l-510.)/70., 1., 0.);
  else if (l < 645.) c = vec3(1., -(l-645.)/65., 0.); else c = vec3(1., 0., 0.);
  float f = l < 420. ? .3 + .7*(l-380.)/40. : (l > 700. ? .3 + .7*(750.-l)/50. : 1.);
  return c*f;
}
float emblemD(vec2 q){ float r = length(q), a = atan(q.y,q.x);
  float star = r - (.20 + .07*pow(abs(cos(a*4.)), 6.));
  float rings = min(min(abs(r-.27), abs(r-.33)), abs(r-.40)) - .006;
  return min(abs(star)-.006, rings); }
vec3 scene(vec2 fc){
  float s = uS;
  vec2 q = (fc - .5*uRes)/uRes.y;
  vec2 dpx = vec2(fc.x, uRes.y - fc.y)*(1920./uRes.x);
  float td = tdOf(s);
  // ---- camera: always a real perspective camera; top-down = looking straight down from above ----
  vec3 Cg = vec3(.25*sin(s*.35), .42, s*.55 - 1.2), Fg = normalize(vec3(.18*sin(s*.45), -.42, 1.)), Ug = vec3(0.,1.,0.);
  vec3 Ct = vec3(0., 1.25, s*.55*0. + 0.), Ft = vec3(0.,-1.,0.), Ut = vec3(0.,0.,1.);
  vec3 C = mix(Cg, Ct, td), F = normalize(mix(Fg, Ft, td)), Uu = normalize(mix(Ug, Ut, td));
  vec3 Rr = normalize(cross(Uu, F)); Uu = cross(F, Rr);
  float foc = mix(1.25, 1.0, td);
  vec3 rd = normalize(F*foc + Rr*q.x + Uu*q.y);
  if (rd.y > -.01) return mix(vec3(.01,.01,.03), vec3(.05,.03,.09), clamp(rd.y*3.,0.,1.));
  float t = -C.y/rd.y; vec2 P = C.xz + rd.xz*t; vec3 Pw = vec3(P.x, 0., P.y);
  // ---- surface normal ----
  float e = .0025, h0 = hfield(P,s);
  vec3 n = normalize(vec3(-(hfield(P+vec2(e,0.),s)-h0)/e, 1., -(hfield(P+vec2(0.,e),s)-h0)/e));
  float glyphAmp = (1. - ease((s-.3)/1.1))*td;                         // glyph emboss carried in from scene 02
  if (glyphAmp > 0.) { vec2 cs = vec2(12.,24.); vec2 cell = floor(dpx/cs), cuv = fract(dpx/cs); float idx = floor(hash21(cell*1.7)*10.);
    float g = texture(uAtlas, vec2((idx+cuv.x)/16., 1.-cuv.y/3.)).r;
    float gx = texture(uAtlas, vec2((idx+cuv.x+.05)/16., 1.-cuv.y/3.)).r - g, gy = texture(uAtlas, vec2((idx+cuv.x)/16., 1.-(cuv.y+.03)/3.)).r - g;
    n = normalize(n + vec3(-gx, 0., gy)*2.2*glyphAmp); }
  float press = ease((s-3.55)/.3)*(1.-ease((s-4.55)/.4)), inEmb = 0.;
  if (press > 0.) { float ed = emblemD(q); float ex = emblemD(q+vec2(.002,0.)) - ed, ey = emblemD(q+vec2(0.,.002)) - ed;
    n = normalize(n + vec3(ex, 0., -ey)*160.*smoothstep(.012,.0,ed)*press); inEmb = smoothstep(.43,.41,length(q))*press; }
  // ---- light + view ----
  vec3 V = normalize(C - Pw);
  vec3 Lp = C + vec3(.55*sin(s*.8), .25 + .15*cos(s*.6), .35*cos(s*.55));
  vec3 L = normalize(Lp - Pw);
  vec3 R = reflect(-V, n);
  // silver mirror reflecting a dark studio with two rectangular softboxes
  vec3 b1 = normalize(vec3(.25*sin(s*.4), .9, .4)), u1 = normalize(cross(b1, vec3(0.,0.,1.))), v1 = cross(b1, u1);
  vec3 b2 = normalize(vec3(-.6, .7, -.3)), u2 = normalize(cross(b2, vec3(0.,1.,0.))), v2 = cross(b2, u2);
  float sb = 0.;
  if (dot(R,b1) > 0.) sb += smoothstep(.40,.34,abs(dot(R,u1)))*smoothstep(.10,.06,abs(dot(R,v1)))*2.6;
  if (dot(R,b2) > 0.) sb += smoothstep(.18,.14,abs(dot(R,u2)))*smoothstep(.18,.14,abs(dot(R,v2)))*1.6;
  vec3 mirror = vec3(.80,.82,.88)*(.05 + .30*smoothstep(-.1,1.,R.y)*smoothstep(1.2,.3,R.y) + sb);
  // ---- diffraction grating: colour comes from angle (lambda = d*|k|/m) ----
  // grating direction: one flowing field (no confetti), radial inside the emblem
  float gAng = .3*s + 1.6*fbm(P*.45 + vec2(0., s*.03)) + .4*sin(P.x*1.3);
  if (inEmb > .5) gAng = atan(q.y, q.x) + PI*.5;
  vec2 g2 = vec2(cos(gAng), sin(gAng));
  vec3 g = normalize(vec3(g2.x, 0., g2.y) - n*dot(n, vec3(g2.x,0.,g2.y))); vec3 bdir = cross(n, g);
  // every light in the room diffracts: key point light + four studio lights spread over the hemisphere
  vec3 rb = vec3(0.);
  for (int i=0;i<5;i++){
    float fi = float(i);
    vec3 Li = i == 0 ? L : normalize(vec3(sin(fi*1.9 + s*.25)*.9, .55 + .25*sin(fi*2.7), cos(fi*1.9 + s*.25)*.9));
    float wi = i == 0 ? 1. : .55;
    vec3 Hh = Li + V; float k = abs(dot(Hh, g)), kb = dot(Hh, bdir);
    float spread = exp(-kb*kb*mix(2.2, 1.2, inEmb));
    for (int m=1;m<=3;m++){ float lam = 1550.*k/float(m); rb += spec(lam)*(1.1/float(m))*spread*wi; }
  }
  rb = max(mix(vec3(lum(rb)), rb, 1.45), 0.);                         // keep overlapping orders spectral, not muddy
  vec3 col = mirror*1.25*(.6 + .4*(1.-clamp(lum(rb),0.,1.))) + rb*1.05 + vec3(.035,.035,.045);
  // tiny glints on crease ridges
  float gl = pow(max(dot(R, L),0.), 600.)*crumpleOf(s);
  col += gl*vec3(1.,.97,.92)*2.5;
  // ---- cut along the Bauhaus grid (top-down; the camera is exactly overhead here) ----
  float cut = ease((s-4.55)/.5);
  if (cut > 0.) { vec2 gg = vec2(dpx.x - (-120.), dpx.y); vec2 fr = abs(fract(gg/360.+.5)-.5)*360.;
    float gap = mix(0., 7., cut); float line = 1. - smoothstep(gap, gap+1.5, min(fr.x, fr.y));
    col = mix(col, vec3(.02), line*cut); col += (1. - smoothstep(0., 3., abs(min(fr.x,fr.y)-gap-1.)))*cut*.5; }
  col *= 1. - .22*dot(q,q);
  return col/(1.+col*.2);
}` }));
})();
