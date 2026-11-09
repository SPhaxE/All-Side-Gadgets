// Transitions are bespoke per boundary: each one is built from the visual language of the two effects it joins
// (A's image is processed by B's idiom, or both meet in a shared device). No global/parametric transition engine.
// type = index of the outgoing scene (0-based). p is already eased (smootherstep) by the compositor.
// Coordinates: uv in 0..1 (y up); "DS" is the 1920x1080 design space so sizes are resolution independent.
window.TRANSITION_GLSL = `
const vec2 DS = vec2(1920.,1080.);
float L3(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.,-1./3.,2./3.,-1.); vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g)); vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r)); float d = q.x-min(q.w,q.y); float e = 1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)), d/(q.x+e), q.x); }
vec3 blurA(vec2 uv, float r){ vec3 s = A(uv)*.2; for (int i=0;i<8;i++){ float a = float(i)/8.*TAU; s += A(uv+vec2(cos(a),sin(a))*r/DS)*.1; } return s; }

// ---- 1 Liquid morph -> 2 ASCII art : the chrome liquid is re-read as characters, then the glyph field becomes the ASCII scene
vec3 t0(vec2 uv, float p){
  vec2 cs = vec2(12.,24.); vec2 px = uv*DS; vec2 cell = floor(px/cs); vec2 cuv = fract(px/cs); vec2 cu = (cell+.5)*cs/DS;
  vec3 ca = (A(cu)*2. + A(cu+vec2(-4.,-8.)/DS) + A(cu+vec2(4.,-8.)/DS) + A(cu+vec2(-4.,8.)/DS) + A(cu+vec2(4.,8.)/DS))/6.;
  float lum = L3(ca);
  float idx = floor(clamp(lum*1.25,0.,.999)*10.);
  vec2 auv = vec2((idx+cuv.x)/16., 1.-(1.-cuv.y)/3.);
  float g = texture(uAtlas, auv).r;
  float mx = max(ca.r,max(ca.g,ca.b));
  vec3 gc = ca/max(mx,.25) * (.5 + .5*min(lum*2.,1.));
  vec3 ascii = gc*g + ca*.10;
  float dl = hash21(cell) * .5 + .5*vnoise(cell*.12);                 // soft per-cell delay -> a wave of characters rolling over the blob
  float s1 = ease(clamp(p/.55 - dl*.5, 0., 1.));
  vec3 a = mix(A(uv), ascii, s1);
  float s2 = ease(clamp((p-.35)/.65*1.5 - dl*.5, 0., 1.));
  return mix(a, B(uv), s2);
}

// ---- 2 ASCII art -> 3 Holographic foil : glyphs pick up foil iridescence, then a holographic glare sweep carries the cards in
vec3 t1(vec2 uv, float p){
  vec3 a = A(uv); float lm = L3(a);
  vec2 dir = normalize(vec2(1.,.55));
  float pos = dot(uv-.5, dir) + .5;
  float front = p*1.9 - .45;
  float d = pos - front;
  float m = smoothstep(.24,-.24,d);
  float hue = fract(pos*1.3 + uv.y*.4 + p*1.2 + lm*.5);
  vec3 irid = hsv2rgb(vec3(hue,.75,1.));
  float ahead = smoothstep(1.0,.0,d)*smoothstep(.0,.1,p);
  vec3 aRec = mix(a, lm*irid*1.9 + a*.25, ahead*.92);
  vec3 b = B(uv);
  vec3 c = mix(aRec, b, m);
  float env = smoothstep(0.,.15,p)*(1.-smoothstep(.88,1.,p));
  float glare = exp(-pow(d*9.,2.))*env;
  c += glare*vec3(1.,.97,.92)*.5 + exp(-pow((d-.15)*16.,2.))*env*.3*vec3(.75,.9,1.);
  return c;
}

// ---- 3 Holographic foil -> 4 Bauhaus : foil is colour-quantised to primaries, then the Bauhaus tile grid flips over (diagonal wave)
vec3 poster(vec3 c){
  vec3 hsv = rgb2hsv(c);
  vec3 red = vec3(.89,.22,.17), yel = vec3(.95,.72,.02), blu = vec3(.12,.31,.61), blk = vec3(.08,.08,.09), cre = vec3(.94,.90,.82);
  if (hsv.z < .24) return blk;
  if (hsv.y < .30) return hsv.z > .62 ? cre : blk;
  float h = hsv.x;
  if (h < .09 || h > .90) return red;
  if (h < .42) return yel;
  if (h < .76) return blu;
  return red;
}
vec3 t2(vec2 uv, float p){
  vec2 px = uv*DS; const float CS = 270.; const float OX = 15.;
  vec3 cream = vec3(.94,.90,.82);
  if (px.x < OX || px.x >= OX + 7.*CS) return mix(A(uv), B(uv), p);
  vec2 tp = vec2(px.x-OX, DS.y-px.y);                       // y down, like the canvas scene
  vec2 id = floor(tp/CS); vec2 loc = tp/CS - id - .5;
  float delay = (id.x + id.y)/9.;
  float local = (p*1.45 - delay*.6)/.45;
  float sx = (local <= 0. || local >= 1.) ? 1. : max(.001, abs(cos(PI*local)));
  bool front = local < .5;
  vec2 l2 = vec2(loc.x/sx, loc.y);
  vec3 col;
  if (abs(l2.x) > .5) col = cream;
  else {
    vec2 sp = vec2(OX + (id.x+.5+l2.x)*CS, DS.y - (id.y+.5+l2.y)*CS)/DS;
    if (front){ vec3 a = A(sp); col = mix(a, poster(a), smoothstep(.0,.45,p)); }
    else col = B(sp);
  }
  float lw = 3.*smoothstep(.0,.25,p);
  vec2 bd = (.5 - abs(loc))*CS;                              // px distance to tile border
  float ln = 1. - smoothstep(lw-.8, lw+.8, min(bd.x,bd.y));
  col = mix(col, vec3(.08,.08,.09), ln*smoothstep(.0,.25,p));
  return col;
}

// ---- 4 Bauhaus -> 5 Neon : flat shapes keep only their outlines, which ignite as neon tubes while the fills sink; then the sign powers up
float edgeA(vec2 uv){ vec2 o = vec2(2.,0.)/DS, o2 = vec2(0.,2.)/DS; return length(A(uv+o)-A(uv-o)) + length(A(uv+o2)-A(uv-o2)); }
vec3 t3(vec2 uv, float p){
  vec3 a = A(uv);
  float e = clamp(edgeA(uv), 0., 1.5);
  float halo = 0.;
  for (int i=0;i<8;i++){ float ang = float(i)/8.*TAU; halo += edgeA(uv + vec2(cos(ang),sin(ang))*11./DS) + edgeA(uv + vec2(cos(ang),sin(ang))*26./DS)*.6; }
  halo /= 12.;
  vec3 neon = hsv2rgb(vec3(fract(uv.x*.7 + uv.y*.45 + p*.7), .78, 1.));
  float sink = ease(p/.62);
  vec3 dark = a * (1.-sink) * (1.-sink*.4);
  float lit = ease(p/.45) * (1. - ease((p-.62)/.38));
  vec3 glow = neon*(e*2.4 + halo*1.5) * lit + vec3(1.)*e*lit*.6;
  vec3 mid = dark + glow + vec3(.01,.0,.03)*sink;
  float s = smoothstep(.45,1.0,p);
  return mix(mid, B(uv), s);
}

// ---- 5 Neon glow -> 6 Dithering : neon light is colour-depth-reduced with ordered (Bayer) dither into the 1-bit navy/peach palette, then pixels swap to the dither scene through the same threshold matrix
float bayer8(vec2 p){ ivec2 q = ivec2(mod(p,8.)); int x = q.x, y = q.y, xy = x ^ y; int v = ((y&1)<<5)|((xy&1)<<4)|((y&2)<<2)|((xy&2)<<1)|((y&4)>>1)|((xy&4)>>2); return (float(v)+.5)/64.; }
vec3 t4(vec2 uv, float p){
  vec2 cell = floor(uv*DS/4.); vec2 cu = (cell+.5)*4./DS;
  float bay = bayer8(cell);
  vec3 a = A(cu); float la = L3(a);
  float q = ease(clamp(p/.55,0.,1.));
  float levels = mix(10.,1.,q);
  float v = clamp(floor(la*1.7*levels + bay)/levels, 0., 1.);
  vec3 pal = mix(vec3(.04,.07,.19), vec3(1.,.85,.69), v);
  vec3 colA = mix(A(uv), mix(a, pal, q), smoothstep(0.,.18,p));
  float m = ease(clamp((p-.42)/.58,0.,1.));
  return bay < m ? B(cu) : colA;
}

// ---- 6 Dithering -> 7 Clay 3D : the dither grain is pressed smooth and warmed like pressed clay, then a clay blob inflates from the table with a lit rim and contact shadow
vec3 t5(vec2 uv, float p){
  float q = ease(clamp(p/.6,0.,1.));
  vec2 w = vec2(sin(uv.y*7.+p*5.), cos(uv.x*6.-p*4.))*.012*sin(PI*clamp(p/.7,0.,1.));
  vec3 a = blurA(uv+w, mix(0.,26.,q));
  a = mix(a, a*.55 + vec3(1.,.82,.72)*.55, q*.7);
  vec2 c0 = vec2(.5,.36); vec2 d = (uv-c0)*vec2(1.78,1.);
  float wob = fbm(uv*3.+vec2(p*1.2,0.))*.07;
  float R = ease(clamp((p-.22)/.78,0.,1.))*1.5;
  float sd = length(d) - R + wob;
  float ex = smoothstep(.0,.07,R);
  float inside = smoothstep(.012,-.012,sd)*ex;
  float lit = dot(normalize(d+1e-4), normalize(vec2(-.6,.8)))*.5 + .5;
  float rim = smoothstep(.07,.0,abs(sd+.03))*(1.-smoothstep(.92,1.,p))*ex;
  vec3 c = mix(a, B(uv), inside);
  c = mix(c, c*(.7+.55*lit), rim*.7) + rim*lit*.10;
  c *= 1. - .2*smoothstep(.09,.0,sd)*(1.-inside)*(1.-smoothstep(.9,1.,p))*ex;
  return c;
}

// ---- 7 Clay 3D -> 8 Halftone dots : both images are re-read as CMYK and printed through the rotated screens; the dot sizes follow the tone of A, then of B
vec4 toCMYK(vec3 c){ float k = 1.-max(c.r,max(c.g,c.b)); float inv = 1./max(1.-k,1e-3); return vec4((1.-c.r-k)*inv,(1.-c.g-k)*inv,(1.-c.b-k)*inv,k); }
vec3 blurB(vec2 uv, float r){ vec3 s = B(uv)*.2; for (int i=0;i<8;i++){ float a = float(i)/8.*TAU; s += B(uv+vec2(cos(a),sin(a))*r/DS)*.1; } return s; }
vec3 srcT6(vec2 uv, float p){ float m = smoothstep(0.,1.,clamp((p-.25)/.5,0.,1.)); return mix(blurA(uv,7.), blurB(uv,9.), m); }
vec3 t6(vec2 uv, float p){
  vec2 fc = uv*DS;
  float angs[4] = float[4](.2618,1.309,0.,.7854);
  vec4 cov = vec4(0.);
  for (int i=0;i<4;i++){
    mat2 R = rot(angs[i]);
    vec2 q = R*fc/15.; vec2 cc = floor(q)+.5;
    vec2 cp = transpose(R)*(cc*15.);
    vec4 k = toCMYK(srcT6(cp/DS, p));
    float v = i==0 ? k.x : (i==1 ? k.y : (i==2 ? k.z : k.w));
    float rad = sqrt(clamp(v,0.,1.))*.72;
    cov[i] = smoothstep(rad+.04, rad-.04, length(fract(q)-.5));
  }
  vec3 ht = vec3(.965,.94,.88);
  ht *= mix(vec3(1.), vec3(0.,.68,.94), cov.x*.95);
  ht *= mix(vec3(1.), vec3(.93,0.,.55), cov.y*.95);
  ht *= mix(vec3(1.), vec3(1.,.95,0.), cov.z*.95);
  ht *= mix(vec3(1.), vec3(.13,.11,.12), cov.w*.97);
  float a1 = ease(clamp(p/.4,0.,1.)), a2 = ease(clamp((p-.62)/.38,0.,1.));
  return mix(mix(A(uv), ht, a1), B(uv), a2);
}

// ---- 8 Halftone dots -> 9 Kinetic typography : the 45-degree dot screen swells; every dot opens onto the lime type scene until the dots merge into it
vec3 t7(vec2 uv, float p){
  vec2 fc = uv*DS; mat2 R = rot(.7854); vec2 q = R*fc/34.; vec2 f = fract(q)-.5; vec2 id = floor(q);
  vec2 cp = transpose(R)*((id+.5)*34.);
  float delay = clamp(cp.x/DS.x,0.,1.)*.5 + hash21(id)*.15;
  float r = ease(clamp((p*1.6-delay)/.9,0.,1.))*.74;
  float d = length(f);
  float inside = smoothstep(r+.02, r-.02, d)*step(.001,r);
  vec3 col = mix(A(uv), B(uv), inside);
  float ring = smoothstep(.03,.0,abs(d-r))*step(.02,r)*(1.-step(.7,r));
  return mix(col, vec3(.08), ring*.75);
}

// ---- 9 Kinetic typography -> 10 Pixel art : the type is resampled coarser and coarser into a limited palette, then pixels trade places with the pixel-art scene (random per-pixel dissolve on the 6px grid)
vec3 t8(vec2 uv, float p){
  float q = ease(clamp(p/.6,0.,1.));
  float sA = mix(1., 6., q);
  vec2 px = uv*DS; vec2 cell = floor(px/sA); vec2 uvA = (cell+.5)*sA/DS;
  float lv = mix(40.,5.,q);
  vec3 a = floor(A(uvA)*lv + .5)/lv;
  vec2 c6 = floor(px/6.); vec2 u6 = (c6+.5)*6./DS;
  float m = ease(clamp((p-.35)/.65,0.,1.));
  return bayer8(c6) < m ? B(u6) : (p < .02 ? A(uv) : a);
}

// ---- 10 Pixel art -> 11 Particle swarm : the 6px blocks are blown off on a noise wind and thin out, leaving the particle cloud behind them
vec3 t9(vec2 uv, float p){
  vec2 fc = uv*DS; vec2 c6 = floor(fc/6.); vec2 cu = (c6+.5)*6./DS;
  float pp = p*p;
  vec2 flow = vec2(fbm(cu*vec2(3.,2.)+1.3), fbm(cu*vec2(3.,2.)+7.9))*2.;
  vec2 src = cu - (flow*.45 + vec2(.10,.12))*pp;
  vec2 sc = floor(src*DS/6.);
  vec2 srcq = (sc+.5)*6./DS;
  float thr = ease(clamp((p-.08)/.82,0.,1.))*1.03;
  bool alive = hash21(sc) > thr && srcq.x > 0. && srcq.x < 1. && srcq.y > 0. && srcq.y < 1.;
  vec3 b = B(uv);
  return alive ? A(srcq) : b;
}

// ---- 11 Particle swarm -> 12 Risograph print : the cloud is re-printed as fluorescent-pink grain on paper, a roller feeds the sheet down the frame, then the ink layers of the poster take over
vec3 t10(vec2 uv, float p){
  vec2 fc = uv*DS;
  float g = .62*hash21(floor(fc/1.3)+13.7) + .38*(fbm(fc*.012+1.)*.5+.5);
  float lm = clamp(L3(blurA(uv,3.))*2.4, 0., 1.);
  float printed = smoothstep(g-.05, g+.05, lm*.985);
  vec3 paper = vec3(.955,.93,.875) * (.97 + .03*hash21(fc));
  vec3 aProc = paper * mix(vec3(1.), vec3(1.,.30,.58), printed*.94);
  float q = ease(clamp(p/.5,0.,1.));
  float local = clamp((q*1.4 - .2 - (1.-uv.y))/.2, 0., 1.);
  vec3 aStage = mix(A(uv), aProc, local);
  float m2 = ease(clamp((p-.45)/.55,0.,1.));
  float sel = smoothstep(g-.12, g+.12, m2*1.25-.1);
  return mix(aStage, B(uv), sel);
}

// ---- 12 Risograph print -> 13 Glitch effect : mis-registration widens into RGB split and torn slices, then blocks of the glitch scene replace the print
vec3 t11(vec2 uv, float p){
  float e = sin(PI*clamp(p,0.,1.))*.9;
  float tq = floor(p*26.);
  float band = floor(uv.y*mix(8.,48.,e));
  float hb = hash21(vec2(band, tq));
  float dx = (hash21(vec2(band*1.3, tq+9.))-.5)*2.*e*.28*step(.55,hb);
  vec2 u = vec2(fract(uv.x+dx), uv.y);
  vec2 bl = floor(uv*vec2(22.,13.)); float hk = hash21(bl + tq*1.31);
  float sw = ease(clamp((p-.25)/.5,0.,1.));
  bool useB = hk < sw;
  float sp = 30.*e/1920.;
  vec3 col;
  if (useB){ col = vec3(B(u+vec2(sp,0.)).r, B(u).g, B(u-vec2(sp,0.)).b); }
  else      { col = vec3(A(u+vec2(sp,0.)).r, A(u).g, A(u-vec2(sp,0.)).b); }
  col *= mix(1., .9 + .1*sin(uv.y*DS.y*3.14159), clamp(e*1.6,0.,1.));
  col += (hash21(uv*DS + tq)-.5)*.1*e;
  return col;
}

// ---- 13 Glitch effect -> 14 Topographic lines : the glitched picture is re-read as a height map; rows turn into contour lines one after another (scan-line tear), then the real terrain takes over
vec3 topoRamp(float t){
  vec3 a = vec3(.05,.55,.62), b = vec3(.35,.95,.70), c = vec3(.85,.98,.35), d = vec3(1.,.62,.18), e = vec3(1.,.93,.82);
  if (t < .28) return mix(a,b,t/.28); if (t < .55) return mix(b,c,(t-.28)/.27); if (t < .82) return mix(c,d,(t-.55)/.27); return mix(d,e,(t-.82)/.18);
}
vec3 t12(vec2 uv, float p){
  vec2 fc = uv*DS;
  float lm = L3(blurA(uv,9.));
  float v = lm*13.; float fw = max(fwidth(v),.03);
  float dist = abs(fract(v-.5)-.5)/fw;
  float line = 1. - smoothstep(.8,1.9,dist);
  vec3 tc = topoRamp(clamp(lm*1.3,0.,1.));
  vec3 lines = mix(vec3(.02,.07,.09), tc*1.1, line);
  float q = ease(clamp(p/.6,0.,1.));
  float rd = hash11(floor(fc.y/6.))*.55;
  float sel = smoothstep(rd, rd+.35, q*1.5);
  float dxs = (hash11(floor(fc.y/6.)+3.)-.5)*.05*sin(PI*q);
  vec3 a = mix(A(uv+vec2(dxs,0.)), lines, sel);
  float m2 = ease(clamp((p-.5)/.5,0.,1.));
  return mix(a, B(uv), m2);
}

// ---- 14 Topographic lines -> 15 Glassmorphism : the map is ground to frosted glass; a glass panel with a bevel highlight swells from the centre, its frost clearing to reveal the glass scene
float sdRBoxT(vec2 p, vec2 b, float r){ vec2 d = abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
vec3 frost(sampler2D t, vec2 uv, float r){ vec3 s = vec3(0.); for (int i=0;i<12;i++){ float a = float(i)*2.39996; float rr = sqrt(float(i)/12.)*r; s += texture(t, uv + vec2(cos(a),sin(a))*rr/DS).rgb; } return s/12.; }
vec3 t13(vec2 uv, float p){
  float q = ease(p);
  vec2 qq = (uv-.5)*vec2(16./9.,1.);
  float gr = smoothstep(.0,.22,p);
  vec2 hs = vec2(.14,.085)*gr + q*vec2(1.35,.9);
  float rad = min(.05 + .08*q, min(hs.x,hs.y)*.98);
  float d = sdRBoxT(qq, hs, rad);
  vec3 outside = frost(uA, uv, 26.*ease(clamp(p/.5,0.,1.)))*(1.-.1*ease(clamp(p/.5,0.,1.))) + vec3(.05,.07,.1)*ease(clamp(p/.5,0.,1.));
  outside *= 1. - .35*smoothstep(.09,.0,sdRBoxT(qq-vec2(.012,-.03), hs, rad))*(1.-q*.5)*gr;
  float clear = ease(clamp((p-.25)/.6,0.,1.));
  vec3 inside = mix(frost(uB, uv, 30.*(1.-clear)) + vec3(.06,.07,.1)*(1.-clear), B(uv), clear);
  float bevel = smoothstep(.012,.0,abs(d+.004));
  float lit = dot(normalize(qq+1e-4), vec2(-.65,.75))*.5+.5;
  vec3 col = mix(outside, inside, smoothstep(.003,-.003,d)*gr);
  col += bevel*(.15+.6*lit)*(1.-smoothstep(.85,1.,p))*gr;
  return col;
}

// ---- 15 Glassmorphism -> 16 Paper cutout : coloured paper sheets with scissor-cut edges, white cores and drop shadows slide across, the last sheet being the paper scene itself
vec3 t14(vec2 uv, float p){
  vec2 px = uv*DS; vec3 col = A(uv);
  vec3 sheet[2] = vec3[2](vec3(1.,.48,.35), vec3(.18,.47,.63));
  for (int i=0;i<3;i++){
    float fi = float(i);
    float k = ease(clamp((p*1.55 - fi*.2)/.75, 0., 1.));
    float jag = (hash11(floor(px.y/54.)+fi*13.)-.5)*70. + 34.*sin(px.y*.011+fi*2.);
    float edge = mix(-120., 2150., k) + jag*step(.001,k)*step(k,.999) ;
    float dx = px.x - edge;
    float sh = (1.-smoothstep(0.,46.,dx))*step(0.,dx)*.42;
    col *= 1. - sh*step(.001,k)*step(k,.999);
    if (dx < 0.){
      vec3 c = (i<2) ? sheet[i]*(.95+.05*hash21(px*.5)) : B(uv);
      col = c;
      if (dx > -8. && k > .001 && k < .999) col = vec3(1.,.98,.94);
    }
  }
  return col;
}

// ---- 16 Paper cutout -> 17 Vaporwave grid : the paper is cut into strips that drop away one after another with shadows, uncovering the sunset grid behind
float bndT(float x, float b){ float y = 1. - b*.25; if (b < .5 || b > 3.5) return y; return y + (hash11(floor(x*1920./70.)+b*7.)-.5)*.03; }
vec3 t15(vec2 uv, float p){
  if (p < .005) return A(uv);
  vec3 col = B(uv);
  for (int k=3;k>=0;k--){
    float fk = float(k);
    float off = ease(clamp((p*1.5 - fk*.13)/.7,0.,1.))*1.25;
    float hi = bndT(uv.x, fk), lo = bndT(uv.x, fk+1.);          // neighbouring strips share their cut line
    float sy = uv.y + off;
    float dLo = (sy - lo)*1080.;
    float dHi = (hi - sy)*1080.;
    if (off > .001 && off < 1.249){ col *= 1. - .38*smoothstep(-52.,0.,dLo)*step(dLo,0.); }
    if (dLo > 0. && dHi > 0. && sy < 1.){
      col = A(vec2(uv.x, sy));
      if (dLo < 6. && off > .001) col = mix(col, vec3(1.,.98,.94), .9);
    }
  }
  return col;
}

// ---- 17 Vaporwave grid -> 18 Flow fields : the neon grid is dragged along a noise flow into long streamlines which turn into the flow-field scene
vec3 t16(vec2 uv, float p){
  float q = ease(clamp(p/.65,0.,1.));
  vec2 pos = uv; vec3 acc = vec3(0.); float wsum = 0.;
  for (int i=0;i<12;i++){
    float a = fbm(pos*vec2(1.78,1.)*1.6 + vec2(0.,.3))*TAU*1.35;
    float w = 1. - float(i)/12.*.8;
    acc += A(pos)*w; wsum += w;
    pos += vec2(cos(a),sin(a))*.020*q;
  }
  vec3 a = acc/wsum;
  a = a*(1.+.5*q) + vec3(.05,.0,.1)*q;
  float m2 = ease(clamp((p-.42)/.58,0.,1.));
  return mix(a, B(uv), m2);
}

// ---- 18 Flow fields -> 19 Metaballs : streamlines are pulled toward growing metaball nuclei; inside the merged iso-surface the metaball scene shows through
vec3 t17(vec2 uv, float p){
  vec2 q = (uv-.5)*vec2(16./9.,1.);
  float F = 0.; vec2 G = vec2(0.);
  for (int i=0;i<9;i++){
    float fi = float(i);
    vec2 c = (vec2(hash11(fi*3.7+1.), hash11(fi*5.9+2.))-.5)*vec2(1.5,.8);
    float r = ease(p)*.42*(.6+.8*hash11(fi*7.1));
    vec2 d = c - q; float dd = dot(d,d)+1e-4;
    F += r*r/dd; G += d*(r*r/dd)/dd;
  }
  vec2 uvA = uv + clamp(G,-3.,3.)*.012*ease(p)*vec2(1./1.78,1.);
  vec3 a = A(uvA);
  float aa = fwidth(F)*1.2+1e-4;
  float inside = smoothstep(1.-aa, 1.+aa, F);
  float ring = 1. - smoothstep(0., 2.5*aa+.004, abs(F-1.));
  vec3 col = mix(a, B(uv), inside);
  col = mix(col, vec3(1.,.97,.9), ring*.8*(1.-smoothstep(.85,1.,p)));
  col += vec3(1.,.4,.5)*smoothstep(1.,.2,F)*.12*(1.-p)*sin(PI*p);
  return col;
}

// ---- 19 Metaballs -> 20 Ray-marched fractals : the concentric contour bands become an endless Droste zoom (self-similar rings) that dives toward the centre and resolves into the fractal
vec3 t18(vec2 uv, float p){
  vec2 q = (uv-.5)*vec2(16./9.,1.);
  float F = 2.35;
  float zoom = exp2(ease(p)*3.2);
  vec2 z = q*zoom; float r = max(length(z),1e-4);
  float k = floor(log(r)/log(F));
  vec2 z2 = (z/pow(F,k))*rot(ease(p)*.9);
  vec2 su = .5 + z2*.30/vec2(16./9.,1.);
  vec3 dro = A(su);
  vec3 a = mix(A(uv), dro, ease(clamp(p/.5,0.,1.)));
  float m2 = ease(clamp((p-.4)/.6,0.,1.));
  float mask = clamp((m2*1.7 - length(q)*1.2)/.4, 0., 1.);
  vec3 col = mix(a, B(uv), mask);
  col += vec3(.5,.3,1.)*sin(PI*p)*.08;
  return col;
}

// ---- 20 Ray-marched fractals -> 1 Liquid morph (loop seam) : the fractal liquefies in sloshing waves with a chrome tint, and chrome droplets grow out of its bright ridges into the liquid scene
vec3 t19(vec2 uv, float p){
  float e = sin(PI*clamp(p/.85,0.,1.));
  vec2 w = (vec2(sin(uv.y*9.+p*7.)+fbm(uv*3.+p), cos(uv.x*8.-p*6.)+fbm(uv*3.+7.))*.022)*e;
  vec3 a = A(uv+w);
  vec3 chrome = pal(L3(a)*1.4+uv.x*.3+p*.6, vec3(.5),vec3(.5),vec3(1.),vec3(.0,.33,.67));
  a = mix(a, a*.55 + chrome*L3(a)*1.3, ease(clamp(p/.7,0.,1.))*.7);
  float lm = L3(a);
  float nz = fbm(uv*vec2(1.78,1.)*3.+3.3)*.5+.5;
  float f = clamp(.55*nz + .45*(1.-clamp(lm*1.6,0.,1.)), 0., 1.);
  float m = clamp((ease(p)*1.6 - f)/.6, 0., 1.);
  m = m*m*(3.-2.*m);
  vec3 b = B(uv - w*(1.-ease(p)));
  return mix(a, b, m);
}

vec3 transition(int type, vec2 uv, float p){
  if (type == 0) return t0(uv,p);
  if (type == 1) return t1(uv,p);
  if (type == 2) return t2(uv,p);
  if (type == 3) return t3(uv,p);
  if (type == 4) return t4(uv,p);
  if (type == 5) return t5(uv,p);
  if (type == 6) return t6(uv,p);
  if (type == 7) return t7(uv,p);
  if (type == 8) return t8(uv,p);
  if (type == 9) return t9(uv,p);
  if (type == 10) return t10(uv,p);
  if (type == 11) return t11(uv,p);
  if (type == 12) return t12(uv,p);
  if (type == 13) return t13(uv,p);
  if (type == 14) return t14(uv,p);
  if (type == 15) return t15(uv,p);
  if (type == 16) return t16(uv,p);
  if (type == 17) return t17(uv,p);
  if (type == 18) return t18(uv,p);
  if (type == 19) return t19(uv,p);
  return mix(A(uv), B(uv), p);   // unreachable: all 20 boundaries have bespoke transitions
}
`;
