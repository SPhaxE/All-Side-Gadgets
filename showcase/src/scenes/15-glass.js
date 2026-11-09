// 15 Glassmorphism (v2) — five kinds of glass slide over a glowing backdrop (the topo glow from scene 14, now bokeh,
// plus crisp shapes so the refraction reads): reeded/fluted glass, pillow-grid glass, coarse frosted glass, rippling
// water glass and a classic frosted UI card. Each panel has its own refraction, a bevel highlight and a soft shadow.
// At the climax they line up in depth and the camera trucks sideways; at the end they turn into paper (scene 16).
(() => { const E = Engine;
const NP = 5;
const rects = new Float32Array(NP * 4), depth = new Float32Array(NP), paper = new Float32Array(NP);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
E.register(15, E.shaderScene({ scaled: true, hudDark: false,
  uniforms(p, s, tg, gl) {
    const e = E.ease;
    // [x, y] at rest (design px), entry direction, entry time
    const D = [[560, 470, 1, .7, .9], [1010, 560, -1, 1.15, .6], [1420, 430, 0, 1.9, .3], [760, 760, 0, 2.3, .1], [1240, 820, 1, 2.6, 0]];
    const sizes = [[230, 330], [250, 250], [220, 300], [270, 190], [300, 170]];
    const truck = e((s - 3.1) / 1.4) * 260 - e((s - 4.6) / 1.0) * 260;
    for (let i = 0; i < NP; i++) {
      const [x, y, dir, t0, z] = D[i], k = e((s - t0) / .75);
      const ex = dir === 1 ? 2400 : dir === -1 ? -500 : x, ey = dir === 0 ? 1500 : y;
      rects.set([ex + (x - ex) * k + truck * (z - .45) * 1.6, ey + (y - ey) * k, sizes[i][0], sizes[i][1]], i * 4);
      depth[i] = z; paper[i] = e((s - 4.55 - i * .08) / .7);
    }
    gl.uniform4fv(p.u.uR, rects); gl.uniform1fv(p.u.uPaper, paper);
    gl.uniform1f(p.u.uDrop, s - 2.55);
  },
  frag: `
uniform vec4 uR[${NP}]; uniform float uPaper[${NP}]; uniform float uDrop;
float sdRBox(vec2 p, vec2 b, float r){ vec2 d = abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
float cov(float d, float w){ return smoothstep(w, -w, d); }
// backdrop (design px): bokeh glows + crisp shapes
vec3 bg(vec2 d, float blur){
  float s = uS; vec2 p = d/1080.;
  vec3 col = mix(vec3(.04,.03,.09), vec3(.10,.05,.16), p.y);
  col += vec3(1.,.45,.12)*exp(-length(p - vec2(.55 + .05*sin(s*.4), .62))*3.2)*.8;
  col += vec3(.2,.5,1.)*exp(-length(p - vec2(1.25, .35 + .05*cos(s*.5)))*3.)*.8;
  col += vec3(.9,.25,.6)*exp(-length(p - vec2(.95, .95))*4.)*.55;
  float w = 1.5 + blur;
  col = mix(col, vec3(1.,.55,.18), cov(length(d - vec2(520. + 30.*sin(s*.5), 520.)) - 190., w)*.9);
  col = mix(col, vec3(.35,.7,1.), cov(abs(length(d - vec2(1350., 420. + 25.*cos(s*.6))) - 170.) - 26., w));
  col = mix(col, vec3(1.,.35,.65), cov(sdRBox(d - vec2(1000. + 40.*sin(s*.35), 800.), vec2(230.,70.), 70.), w));
  vec2 g = mod(d + vec2(s*20., 0.), 48.) - 24.; col = mix(col, vec3(.95,.92,1.), cov(length(g) - 4., w*.6)*smoothstep(1.,.6,p.y)*.55);
  col = mix(col, vec3(1.,.9,.3), cov(length(d - vec2(1650., 860.)) - 90., w));
  float st = step(.5, fract((d.x + d.y)/60.)); col = mix(col, col*1.25 + .04, st*cov(sdRBox(d - vec2(260., 880.), vec2(200.,120.), 20.), w)*.6);
  return col;
}
vec3 bgBlur(vec2 d, float r){ vec3 c = vec3(0.); for (int i=0;i<12;i++){ float a = float(i)*2.39996; float rr = sqrt((float(i)+.5)/12.)*r; c += bg(d + vec2(cos(a),sin(a))*rr, r*.5); } return c/12.; }
vec3 scene(vec2 fc){
  float s = uS;
  vec2 d = vec2(fc.x, uRes.y-fc.y)*(1920./uRes.x);
  // shadows of all panels first
  float shadow = 0.;
  for (int i=0;i<${NP};i++){ vec4 R = uR[i]; float sd = sdRBox(d - R.xy - vec2(18.,26.), R.zw, 34.); shadow = max(shadow, smoothstep(40., -10., sd)*.45); }
  // find the top-most panel under this pixel (later = on top)
  int top = -1; float topD = 1.;
  for (int i=0;i<${NP};i++){ vec4 R = uR[i]; float sd = sdRBox(d - R.xy, R.zw, 34.); if (sd < 0.) { top = i; topD = sd; } }
  if (top < 0) return bg(d, 0.)*(1. - shadow);
  vec4 R = uR[top]; vec2 l = d - R.xy;                          // panel-local px
  vec2 off = vec2(0.); float blur = 0.; vec3 tint = vec3(1.); float extra = 0.;
  if (top == 0) {                                                // reeded / fluted
    float w = 26.; float u = mod(l.x, w)/w*2. - 1.; off.x = -u*34.; tint = vec3(.96,.98,1.); extra = .08*(1. - u*u);
  } else if (top == 1) {                                         // pillow grid glass
    vec2 cell = mod(l, 64.)/64.*2. - 1.; off = -cell*26.*(1. - .3*dot(cell,cell)); extra = .1*smoothstep(.75,1.,max(abs(cell.x),abs(cell.y)));
  } else if (top == 2) {                                         // coarse frosted
    off = (hash22(floor(l/2.)) - .5)*36.; blur = 14.; tint = vec3(.97);
  } else if (top == 3) {                                         // water ripple from a drop
    vec2 c = vec2(-60., -20.); float r = length(l - c); float wv = sin(r*.09 - uDrop*9.)*exp(-r*.006)*step(0., uDrop)*exp(-max(uDrop,0.)*.35);
    off = normalize(l - c + 1e-3)*wv*22.; extra = wv*.06; tint = vec3(.93,.98,1.);
  } else {                                                       // classic frosted UI card
    blur = 30.; tint = vec3(.92,.94,1.);
  }
  vec3 behind = blur > 0. ? bgBlur(d + off, blur) : bg(d + off, 0.);
  vec3 col = behind*tint*.92 + vec3(.06,.06,.09) + extra;
  col += (hash21(d + floor(s*24.)) - .5)*.03;
  // classic card: UI elements
  if (top == 4) {
    col = mix(col, vec3(1.), cov(sdRBox(l - vec2(-150., -95.), vec2(80., 9.), 9.), 1.2)*.9);
    col = mix(col, vec3(1.), cov(sdRBox(l - vec2(-120., -62.), vec2(110., 5.), 5.), 1.2)*.45);
    for (int i=0;i<6;i++){ float fi = float(i); float hh = 20. + 40.*(.5+.5*sin(s*2.+fi)); col = mix(col, mix(vec3(.4,.9,1.), vec3(1.,.5,.9), fi/5.), cov(sdRBox(l - vec2(-170. + fi*36., 90. - hh*.5), vec2(11., hh*.5), 6.), 1.2)*.95); }
    float on = step(0., sin(s*1.6)); col = mix(col, mix(vec3(.5), vec3(.4,1.,.5), on), cov(sdRBox(l - vec2(200., -90.), vec2(46., 24.), 24.), 1.2));
    col = mix(col, vec3(1.), cov(length(l - vec2(200. + (on*2.-1.)*22., -90.)) - 19., 1.2));
  }
  // bevel highlight (top-left light) + rim
  float rim = smoothstep(3., 0., abs(topD + 2.));
  float lit = dot(normalize(l + 1e-3), normalize(vec2(-.6,-.8)))*.5 + .5;
  col += rim*(.15 + .75*lit);
  col += smoothstep(26., 0., -topD)*.05;
  // turning into paper (scene 16): flat paper colours, fibres, cut edge
  float pp = uPaper[top];
  if (pp > 0.) {
    vec3 P[5] = vec3[5](vec3(.95,.90,.80), vec3(.62,.78,.80), vec3(.36,.56,.66), vec3(.20,.37,.48), vec3(.91,.66,.48));
    vec3 pc = P[top]*(.95 + .05*fbm(d*.05)) * (.97 + .03*sin(d.x*.9 + fbm(d*.1)*6.));
    pc = mix(pc, vec3(.99,.97,.93), smoothstep(5., 1., -topD));      // white paper core at the cut edge
    col = mix(col, pc, pp);
  }
  return col;
}` }));
})();
