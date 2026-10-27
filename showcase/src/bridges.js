// v2 bridges: one per boundary, built from the two effects' own material. Registered with Engine.bridge(type, def);
// boundaries without an entry here still use the v1 transitions (src/transitions.js) until they are rebuilt.
(() => { const E = Engine;

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
})();
