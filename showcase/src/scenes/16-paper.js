// 16 Paper cutout (v2) — an 8-layer pop-up diorama. Back: sky + rising sun + snowy peaks; middle: forested hills and a
// winding river; front: grass and blurred reeds. Every layer casts a real shadow on the layers behind it (offset and
// softness grow with the gap), with paper fibre, white cut-edge cores, atmospheric fade with depth, a sideways camera
// truck for strong parallax, a flock of paper birds at the climax and 12fps stop-motion jitter.
(() => { const E = Engine;
E.register(16, E.shaderScene({ scaled: true, hudDark: true,
  uniforms(p, s, tg, gl) { const q = E.stepT(s, 12); gl.uniform1f(p.u.uQ, q); gl.uniform1f(p.u.uFJ, Math.floor(s * 12 + 1e-4)); },
  frag: `
uniform float uQ, uFJ;
const int NL = 8;
float Z[8] = float[8](0., 1., 2., 3., 4., 5., 6.2, 7.6);          // depth of each layer (bigger = nearer)
float TRUCK, SUNY;
// top-edge profile of each layer in design px (y down); the layer fills everything below its edge
float edgeY(int i, float x){
  if (i == 1) return 520. - 150.*exp(-pow((x-1300.)/260.,2.)) - 110.*exp(-pow((x-760.)/220.,2.)) - 30.*sin(x*.011) + 14.*abs(sin(x*.05));
  if (i == 2) return 600. - 90.*exp(-pow((x-420.)/260.,2.)) - 120.*exp(-pow((x-1600.)/300.,2.)) - 25.*sin(x*.009+1.) + 8.*abs(sin(x*.07));
  if (i == 3) { float h = 690. - 50.*sin(x*.006+2.) - 20.*sin(x*.017); float tr = mod(x, 46.); float tree = (23. - abs(tr - 23.))*2.6*step(.35, hash11(floor(x/46.))); return h - tree; }
  if (i == 4) return 770. - 30.*sin(x*.004+.5) - 10.*sin(x*.02);
  if (i == 5) { float h = 840. - 60.*sin(x*.005+3.) - 18.*sin(x*.021); float tr = mod(x, 70.); float tree = (35. - abs(tr - 35.))*3.4*step(.45, hash11(floor(x/70.)+9.)); return h - tree; }
  if (i == 6) { float h = 960. - 25.*sin(x*.008); float bl = mod(x, 18.); return h - (9. - abs(bl - 9.))*5.*(.5 + hash11(floor(x/18.))); }
  if (i == 7) { float bl = mod(x, 64.); float id = floor(x/64.); return 1080. - step(.55, hash11(id+3.))*(220. + 260.*hash11(id+7.))*(1. - abs(bl - 32.)/32.); }
  return -1.;
}
vec3 layerCol(int i){
  if (i == 1) return vec3(.80,.86,.90); if (i == 2) return vec3(.54,.70,.80); if (i == 3) return vec3(.33,.55,.58);
  if (i == 4) return vec3(.55,.70,.42); if (i == 5) return vec3(.20,.40,.34); if (i == 6) return vec3(.13,.28,.22); return vec3(.07,.13,.11);
}
float jit(int i){ return (hash11(uFJ + float(i)*7.1) - .5)*2.; }
// soft coverage of layer i at screen px d (blur in px)
float covL(int i, vec2 d, float blur){
  float x = d.x - TRUCK*Z[i]*.12 + jit(i)*.8;
  float e = edgeY(i, x) + jit(i+20)*.6;
  float c = smoothstep(-blur-.7, blur+.7, d.y - e);
  if (i == 4) { float rv = 830. + 18.*sin(x*.01) + 8.*sin(x*.031); c *= 1. - smoothstep(14.+blur, 10.-blur, abs(d.y - rv - (x-960.)*.03)); }   // river cut-out
  return c;
}
vec3 scene(vec2 fc){
  float s = uQ;
  vec2 d = vec2(fc.x, uRes.y-fc.y)*(1920./uRes.x);
  TRUCK = -ease((s + .75)/6.5)*600. + 300.;
  SUNY = 560. - 360.*ease((s - 1.8)/1.8);
  // light comes from the sun: shadows fall away from it
  vec2 Ldir = normalize(vec2(d.x - (1150. - TRUCK*.1), d.y - SUNY + 400.));
  // ---- find the front-most layer covering this pixel ----
  int top = 0;
  for (int i=1;i<NL;i++) if (covL(i, d, i == 7 ? 6. : 0.) > .5) top = i;
  vec3 col;
  if (top == 0) {                                                 // sky + sun (sun is a paper disc on the sky card)
    col = mix(vec3(.99,.93,.80), vec3(.98,.80,.66), smoothstep(200., 760., d.y));
    vec2 sc = vec2(1150. - TRUCK*.05, SUNY); float sd = length(d - sc) - 120.;
    float sunShadow = 1. - .25*smoothstep(30., -10., length(d - sc - vec2(10., 14.)) - 120.)*step(0., sd);
    col *= sunShadow;
    col = mix(col, vec3(1.,.55,.36), smoothstep(1., -1., sd));
    col = mix(col, vec3(1.,.95,.88), smoothstep(3., 0., abs(sd + 2.))*.8);   // cut edge
    // clouds: little paper clouds on wires
    for (int k=0;k<3;k++){ float fk = float(k); vec2 cc = vec2(mod(300. + fk*620. + s*25. - TRUCK*.03, 2300.) - 200., 220. + fk*70.);
      float cd = min(min(length(d - cc) - 46., length(d - cc - vec2(52., 10.)) - 36.), length(d - cc + vec2(50., -12.)) - 32.);
      col *= 1. - .18*smoothstep(25., -5., min(min(length(d - cc - vec2(8.,12.)) - 46., length(d - cc - vec2(60., 22.)) - 36.), length(d - cc + vec2(42., -24.)) - 32.))*step(0., cd);
      col = mix(col, vec3(.99,.98,.95), smoothstep(1., -1., cd)); }
  } else {
    col = layerCol(top);
    // snow caps on the far peaks
    if (top == 1) { float x = d.x - TRUCK*Z[1]*.12; float e = edgeY(1, x); col = mix(col, vec3(.98,.98,.99), smoothstep(1., -1., d.y - e - 28. - 10.*sin(x*.06))); }
    if (top == 4) col = mix(col, vec3(.55,.78,.90), 0.);         // (river shows the layer behind through the cut)
    // atmospheric fade: far layers lighter and cooler
    col = mix(col, vec3(.93,.90,.86), (1. - float(top)/7.)*.35);
    // white paper core along the cut edge
    float x = d.x - TRUCK*Z[top]*.12 + jit(top)*.8; float de = d.y - (edgeY(top, x) + jit(top+20)*.6);
    col = mix(col, vec3(.99,.97,.92), smoothstep(4.5, 1.5, de)*step(0., de)*.9*(top == 7 ? 0. : 1.));
  }
  // ---- shadows from every layer in front of top ----
  float sh = 0.;
  for (int j=1;j<NL;j++){
    if (j <= top) continue;
    float gap = Z[j] - Z[top];
    vec2 o = -Ldir*gap*19.;
    sh = max(sh, covL(j, d + o, 4. + gap*7.)*(.55 - gap*.035));
  }
  col *= 1. - sh;
  // paper fibre + grain
  col *= .95 + .05*fbm(d*.06 + float(top)*3.);
  col *= .985 + .015*sin(d.x*1.3 + fbm(d*.2)*5.);
  // flock of paper birds crossing in front (climax)
  float fl = s - 3.2;
  if (fl > 0. && fl < 2.2) {
    for (int b=0;b<9;b++){ float fb = float(b); vec2 bp = vec2(-200. + fl*1200. + fb*90. - 40.*hash11(fb), 380. + 60.*sin(fb*1.7) + 30.*sin(fl*3. + fb));
      vec2 q = d - bp; float flap = sin(uFJ*1.3 + fb*2.)*.5 + .5; float sz = 34. + 10.*hash11(fb+4.);
      float wing = abs(q.y + abs(q.x)*(.25 + .5*flap)) - 5.; float bd = max(wing, abs(q.x) - sz);
      // bird shadow on the scene
      vec2 q2 = q + Ldir*80.; float bd2 = max(abs(q2.y + abs(q2.x)*(.25 + .5*flap)) - 5., abs(q2.x) - sz);
      col *= 1. - .25*smoothstep(10., -4., bd2);
      col = mix(col, vec3(.97,.95,.90), smoothstep(1., -1., bd)); }
  }
  col *= 1. - .18*dot((d - vec2(960.,540.))/1080., (d - vec2(960.,540.))/1080.)*1.5;
  return col;
}` }));
})();
