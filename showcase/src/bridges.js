// v2 bridges: one per boundary, built from the two effects' own material. Registered with Engine.bridge(type, def);
// boundaries without an entry here still use the v1 transitions (src/transitions.js) until they are rebuilt.
(() => { const E = Engine;

// ---- 01 Liquid -> 02 ASCII : the gradient figure is read as characters, a wave of cells rolling down from the head
E.bridge(0, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.); vec2 cs = vec2(12.,24.), cell = floor(d/cs), cuv = fract(d/cs);
    vec2 cu = vec2((cell.x+.5)*12./1920., 1.-(cell.y+.5)*24./1080.);
    vec3 ca = A(cu); float l = lum(ca);
    float idx = floor(clamp(l*1.4,0.,.999)*10.);
    float g = texture(uAtlas, vec2((idx+cuv.x)/16., 1.-cuv.y/3.)).r;
    vec3 asc = ca/max(max(ca.r,max(ca.g,ca.b)),.2)*g*(.4+.8*l);
    float wave = cell.y/45. + hash21(cell)*.25;
    float k1 = smoothstep(wave-.15, wave+.05, p*1.6);
    float k2 = smoothstep(.45, 1., p + hash21(cell+3.)*.2);
    return mix(mix(A(uv), asc, k1), B(uv), k2);
  }` });

// ---- 02 ASCII -> 03 Holo cards : the crystallised glyph grid catches holographic light; a rainbow glare sweeps it into the cards
E.bridge(1, { glsl: `
  vec3 spec(float l){ l = clamp(l,0.,1.)*6.; return clamp(vec3(abs(l-3.)-1., 2.-abs(l-2.), 2.-abs(l-4.)),0.,1.); }
  vec3 transition(vec2 uv, float p){
    vec3 a = A(uv); float la = lum(a);
    float pos = dot(uv - .5, normalize(vec2(1.,.55))) + .5, d = pos - (p*1.7 - .35);
    vec3 holo = la*spec(fract(pos*1.6 + uv.y*.5 + p))*2.2 + a*.3;
    vec3 aa = mix(a, holo, smoothstep(.8, .0, d)*smoothstep(0.,.15,p));
    vec3 c = mix(aa, B(uv), smoothstep(.2, -.2, d));
    return c + exp(-d*d*60.)*smoothstep(0.,.1,p)*(1.-smoothstep(.9,1.,p))*.6;
  }` });

// ---- 08 Halftone -> 09 Kinetic : both sides show the same black dot on paper here; the dot opens into the O
E.bridge(7, { glsl: `vec3 transition(vec2 uv, float p){ return mix(A(uv), B(uv), p); }` });

// ---- 09 Kinetic -> 10 Pixel : the type is cut into grid squares that shrink to 6px pixels and recolour into the wave
E.bridge(8, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.);
    float bs = mix(96., 6., ease(clamp(p/.55,0.,1.)));
    vec2 cell = floor(d/bs), cu = (cell+.5)*bs/vec2(1920.,1080.); cu.y = 1.-cu.y;
    vec3 a = A(cu); float lv = mix(255., 6., ease(p/.5)); a = floor(a*lv)/lv;
    vec2 c6 = floor(d/6.); float th = hash21(c6);
    float m = smoothstep(th - .05, th + .05, ease((p - .3)/.7)*1.1);
    vec2 c6u = (c6+.5)*6./vec2(1920.,1080.); c6u.y = 1.-c6u.y;
    return mix(p < .02 ? A(uv) : a, B(c6u), m);
  }` });

// ---- 10 Pixel -> 11 Murmuration : the pixel spray-flock dissolves pixel by pixel into the real dusk sky and flock
E.bridge(9, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.); vec2 c6 = floor(d/6.);
    float th = hash21(c6)*.7 + (1.-uv.y)*.3;
    return mix(A(uv), B(uv), smoothstep(th - .08, th + .08, p*1.15));
  }` });

// ---- 11 Galaxy -> 12 Riso : the galaxy is pressed into fluorescent ink dots on paper, then the poster prints over it
E.bridge(10, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.);
    vec2 q = rot(.26)*d/9.; vec2 f = fract(q)-.5;
    float l = clamp(lum(A(uv))*2.2, 0., 1.);
    float dot_ = smoothstep(.04, -.04, length(f) - sqrt(l)*.6);
    vec3 paper = vec3(.97,.94,.86), ink = mix(vec3(1.,.28,.72), vec3(1.,.78,.12), smoothstep(.3,.9,l));
    vec3 printed = mix(paper, paper*mix(vec3(1.), ink, .95), dot_);
    float k1 = ease(clamp(p/.5,0.,1.)), k2 = ease(clamp((p-.45)/.55,0.,1.));
    float g = hash21(floor(d/2.));
    return mix(mix(A(uv), printed, smoothstep(g-.2, g+.2, k1*1.3)), B(uv), k2);
  }` });

// ---- 12 Riso -> 13 Glitch : the strips thin into white scan-lines on black — exactly the frame scene 13 opens on
E.bridge(11, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.);
    float l = lum(A(uv));
    float lines = smoothstep(3.2, 1.6, abs(mod(d.y, 22.) - 11.));
    vec3 mid = mix(A(uv)*(1.-ease(p/.5)), vec3(lines)*mix(1., l*1.5, .4), ease(clamp((p-.15)/.5,0.,1.)));
    return mix(mid, B(uv), ease(clamp((p-.5)/.5,0.,1.)));
  }` });

// ---- 13 Glitch -> 14 Topo : the rolling white lines tint orange/blue and lie down into the terrain's contours
E.bridge(12, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec3 a = A(uv)*mix(vec3(1.), mix(vec3(.3,.6,1.), vec3(1.,.6,.2), uv.y), ease(p/.6));
    return mix(a, B(uv), ease(clamp((p-.3)/.7,0.,1.)));
  }` });

// ---- 14 Topo -> 15 Glass : the overhead map goes out of focus into bokeh and becomes the glass backdrop
E.bridge(13, { glsl: `
  vec3 transition(vec2 uv, float p){
    float r = ease(p)*28./1080.; vec3 c = vec3(0.);
    for (int i=0;i<16;i++){ float a = float(i)*2.39996; float rr = sqrt((float(i)+.5)/16.)*r; c += A(uv + vec2(cos(a),sin(a))*rr*vec2(9./16.,1.)); }
    c /= 16.;
    return mix(c*(1. + .4*p), B(uv), ease(clamp((p-.35)/.65,0.,1.)));
  }` });

// ---- 15 Glass -> 16 Paper : the paper panels fold down flat and the diorama layers pop up from below, back to front
E.bridge(14, { glsl: `
  vec3 transition(vec2 uv, float p){
    float y = 1. - uv.y;
    float layer = floor(y*8.); float k = ease(clamp((p*1.6 - (7.-layer)*.08)/.7, 0., 1.));
    vec2 ub = vec2(uv.x, uv.y - (1.-k)*.25);
    vec3 b = B(ub)*(.75 + .25*k);
    float popped = step(1. - y, k*1.02);
    vec3 a = A(vec2(uv.x, .5 + (uv.y - .5)/max(1. - ease(p)*.85, .05)));
    float shadow = smoothstep(.05, 0., abs((1. - y) - k))*.35*(1.-p);
    return mix(a*(1. - shadow), b, max(popped*ease(clamp(p*1.4,0.,1.)), ease((p-.6)/.4)));
  }` });

// ---- 16 Paper -> 17 Vaporwave : the pop-up book opens like double doors; the temple lies behind it
E.bridge(15, { glsl: `
  vec3 transition(vec2 uv, float p){
    float k = ease(p); float side = uv.x < .5 ? -1. : 1.;
    float edge = .5 - .5*k;                                          // each door folds toward its hinge at the frame edge
    float x = abs(uv.x - .5);
    if (x > edge) {
      float u = (x - edge)/max(.5 - edge, 1e-3);                     // 0 at the door's free edge, 1 at the hinge
      vec2 su = vec2(.5 + side*(.5*u), uv.y);
      float shade = .6 + .4*u;
      return A(su)*shade;
    }
    vec3 b = B(uv);
    float sh = smoothstep(.12, 0., edge - x)*.35*(1.-k);
    return b*(1. - sh);
  }` });

// ---- 17 Vaporwave -> 18 Starry Night : the temple is repainted with strokes that follow a swirling flow
E.bridge(16, { glsl: `
  vec3 transition(vec2 uv, float p){
    float q = ease(clamp(p/.65,0.,1.));
    vec2 pos = uv; vec3 acc = vec3(0.); float ws = 0.;
    for (int i=0;i<10;i++){ float a = fbm(pos*vec2(3.5,2.) + 1.7)*TAU*1.4; float w = 1. - float(i)/12.; acc += A(pos)*w; ws += w; pos += vec2(cos(a),sin(a))*.012*q; }
    vec3 a = acc/ws;
    a = mix(a, a*vec3(.55,.7,1.2) + vec3(.02,.05,.15), q*.6);
    return mix(a, B(uv), ease(clamp((p-.4)/.6,0.,1.)));
  }` });

// ---- 03 Holographic foil -> 04 Bauhaus : the foil plate is already cut along the Bauhaus grid (scene 03); tile by tile
// (diagonal wave) the iridescence drains into the flat colour that tile has in scene 04, with a last specular glint
E.bridge(2, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.); vec2 g = vec2(d.x + 120., d.y); vec2 id = floor(g/360.);
    float delay = (id.x + id.y)/7.;
    float k = ease(clamp((p*1.5 - delay*.5)/.6, 0., 1.));
    vec3 a = A(uv), b = B(uv);
    float glint = exp(-pow((k-.5)*5.,2.)) * .6;
    return mix(a, b, k) + glint*vec3(1.,.97,.92);
  }` });

// ---- 04 Bauhaus -> 05 Neon : the fills sink and the edges ignite — and those edges ARE scene 05's tubes (same geometry, same clock)
E.bridge(3, { glsl: `
  float edgeA(vec2 uv){ vec2 o = vec2(2.,0.)/uRes, o2 = vec2(0.,2.)/uRes; return length(A(uv+o)-A(uv-o)) + length(A(uv+o2)-A(uv-o2)); }
  vec3 transition(vec2 uv, float p){
    vec3 a = A(uv), b = B(uv);
    float sink = ease(p/.7);
    float e = clamp(edgeA(uv), 0., 1.5);
    float lit = sin(PI*clamp(p/.75,0.,1.));              // edges glow in A's own colours before the tubes take over
    vec3 glowA = a*e*1.6*lit + vec3(1.)*e*.25*lit;
    vec3 sunk = a*(1.-sink)*(1.-.5*sink);
    return sunk + glowA + b*smoothstep(.1,.85,p);
  }` });

// ---- 05 Neon -> 06 Dithering : the last tube is already bent into the horse's outline (scene 05); inside it the
// ordered-dither pixels fill the horse first, then the background — scene 06 itself does the filling, so A only has to let go
E.bridge(4, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec3 a = A(uv), b = B(uv);
    float hold = 1. - ease(clamp((p-.3)/.7, 0., 1.));      // neon glow lingers over the filling pixels, then fades
    return b + a*hold*(1.-.5*lum(b));
  }` });
// ---- 06 Dithering -> 07 Clay : the swollen dither balls soften, warm up and pick up clay colours while the clay set
// (whose pellets are rolling in from the same spots) fades up underneath
E.bridge(5, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec3 a = A(uv), b = B(uv);
    vec2 px = 1./uRes; vec3 s = a; for (int i=0;i<8;i++){ float an = float(i)*.785; s += A(uv + vec2(cos(an),sin(an))*px*8.*p); } s /= 9.;
    vec3 warm = mix(s, s*vec3(1.05,.8,.7) + vec3(.35,.22,.18), ease(p/.6));
    return mix(warm, b, ease((p-.25)/.75));
  }` });

// ---- 07 Clay -> 08 Halftone : the bloom is printed: CMYK dots grow out of the clay photo, round cells swelling from the flowers
E.bridge(6, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 d = vec2(uv.x, 1.-uv.y)*vec2(1920.,1080.); mat2 R = rot(.7854); vec2 q = R*d/15.; vec2 f = fract(q)-.5, id = floor(q);
    vec2 cp = transpose(R)*((id+.5)*15.);
    float delay = length(cp - vec2(960.,420.))/1300.;
    float r = ease(clamp((p*1.6 - delay)/.7, 0., 1.))*.75;
    float inside = smoothstep(r+.03, r-.03, length(f))*step(.001, r);
    return mix(A(uv), B(uv), max(inside, ease((p-.6)/.4)));
  }` });
// ---- 18 Flow -> 19 Lava lamp : the vortex core glows and swells; the painting melts into warm liquid around it
E.bridge(17, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 q = (uv - .5)*vec2(16./9.,1.); float r = length(q - vec2(0., .1));
    vec2 sw = rot(p*2.5*exp(-r*2.))*(uv - .5) + .5;
    vec3 a = A(sw) + vec3(1.,.55,.2)*exp(-r*mix(9.,2.5,p))*sin(PI*p)*.8;
    return mix(a, B(uv), smoothstep(r - .1, r + .3, p*1.6 - .3));
  }` });

// ---- 19 Lava lamp -> 20 Fractal : the sprouting wax blob turns into the low-power fractal growing from the same spot
E.bridge(18, { glsl: `
  vec3 transition(vec2 uv, float p){
    vec2 q = (uv - .5)*vec2(16./9.,1.); float r = length(q);
    float m = smoothstep(.0, .35, p*1.5 - r*.8);
    return mix(A(uv)*(1. - .5*p), B(uv), m);
  }` });

// ---- 20 Fractal -> 01 Liquid (loop seam) : both sides show the same gradient sphere here; a plain cross-fade hides any residue
E.bridge(19, { glsl: `
  vec3 transition(vec2 uv, float p){ return mix(A(uv), B(uv), p); }` });
})();
