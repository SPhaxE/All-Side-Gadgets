// 03 Holographic foil (v3) — holographic trading cards. Each card is a ray-traced plane with a diffraction-grating
// foil (colour from angle, three orders, five lights), silver mirror base, embossed art (frame, emblem, title bars),
// glitter and a sweeping glare. Choreography: three hero cards sway -> nine more spiral in and orbit -> hero flip ->
// all twelve fly into a 6x2 wall that fills the frame; the seams heal into one foil plane, which is cut along the
// Bauhaus grid (scene 04 drains each tile into its shape, see bridges.js).
(() => { const E = Engine, G = BauhausGeo;
const NC = 12, HX = 1.77778 / 6, HY = .5, ZW = 3;          // card half extents; the wall at depth 3 fills the frame exactly
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = E.ease, lerp = (a, b, t) => a + (b - a) * t;
const cen = new Float32Array(NC * 3), axx = new Float32Array(NC * 3), axy = new Float32Array(NC * 3);
function rotAxes(yaw, pitch, roll) {   // returns [ax, ay] unit vectors
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry(yaw) * Rx(pitch) * Rz(roll)
  const rz = (x, y) => [x * cr - y * sr, x * sr + y * cr, 0];
  const rx = v => [v[0], v[1] * cp - v[2] * sp, v[1] * sp + v[2] * cp];
  const ry = v => [v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy];
  return [ry(rx(rz(1, 0))), ry(rx(rz(0, 1)))];
}
function cardState(i, s) {
  const slot = [7, 4, 9, 0, 1, 2, 3, 5, 6, 8, 10, 11][i];       // heroes land in the middle of the wall
  const wc = slot % 6, wr = Math.floor(slot / 6);
  const wall = { p: [-1.77778 + HX * (2 * wc + 1), wr ? -.5 : .5, ZW], r: [0, 0, 0] };
  let free;
  if (i < 3) {                                                  // hero cards
    const k = i - 1;
    let yaw = .55 * Math.sin(s * .9 + i * 2.1) + k * -.35, pitch = .18 * Math.sin(s * .7 + i), roll = .06 * Math.sin(s * .5 + i * 1.7);
    if (i === 0) yaw += 2 * Math.PI * ease((s - 3.0) / .75);    // climax flip (full turn, shows the back)
    const spread = 1 - .25 * ease((s - 1.5) / 1.2);
    free = { p: [k * .78 * spread, .04 * Math.sin(s * 1.3 + i), 2.15 + Math.abs(k) * .35 - (i === 0 ? .25 * Math.sin(Math.PI * clamp((s - 3.0) / .75)) : 0)], r: [yaw, pitch, roll] };
  } else {                                                      // orbiters: spiral in from depth, then a tilted ring behind the heroes
    const j = i - 3, a = j / 9 * Math.PI * 2 + s * .55 + (s > 3.0 ? .9 * ease((s - 3.0) / .75) : 0);
    const arrive = ease((s - .6 - j * .09) / 1.1);
    const R = lerp(3.8, 1.85, arrive), z0 = lerp(11, 4.3, arrive);
    free = { p: [Math.cos(a) * R, Math.sin(a) * R * .38 + .05, z0 + Math.sin(a) * R * .55], r: [a * 1.0 + s * 1.7 + j, .25 * Math.sin(s + j), .2 * Math.cos(a)] };
  }
  const fly = ease((s - 3.75 - (i < 3 ? .25 : (i - 3) * .05)) / .95);
  return { p: free.p.map((v, k) => lerp(v, wall.p[k], fly)), r: free.r.map((v, k) => lerp(v, 0, fly)) };
}
E.register(3, E.shaderScene({ scaled: true, hudDark: false,
  uniforms(p, s, tg, gl) {
    for (let i = 0; i < NC; i++) {
      const st = cardState(i, s), [ax, ay] = rotAxes(...st.r);
      cen.set(st.p, i * 3); axx.set(ax, i * 3); axy.set(ay, i * 3);
    }
    gl.uniform3fv(p.u.uCen, cen); gl.uniform3fv(p.u.uAx, axx); gl.uniform3fv(p.u.uAy, axy);
    gl.uniform1f(p.u.uHeal, ease((s - 4.75) / .4));
    gl.uniform1f(p.u.uCut, ease((s - 5.0) / .3));
  },
  frag: `
uniform vec3 uCen[${NC}], uAx[${NC}], uAy[${NC}]; uniform float uHeal, uCut;
const vec2 HE = vec2(${HX}, ${HY});
vec3 spec(float l){
  if (l < 380. || l > 750.) return vec3(0.);
  vec3 c;
  if (l < 440.) c = vec3(-(l-440.)/60., 0., 1.); else if (l < 490.) c = vec3(0., (l-440.)/50., 1.);
  else if (l < 510.) c = vec3(0., 1., -(l-510.)/20.); else if (l < 580.) c = vec3((l-510.)/70., 1., 0.);
  else if (l < 645.) c = vec3(1., -(l-645.)/65., 0.); else c = vec3(1., 0., 0.);
  return c*(l < 420. ? .3 + .7*(l-380.)/40. : (l > 700. ? .3 + .7*(750.-l)/50. : 1.));
}
float sdRBox(vec2 p, vec2 b, float r){ vec2 d = abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
float sdStar(vec2 p, float r, float n, float m){ float an = PI/n, en = PI/m; vec2 acs = vec2(cos(an),sin(an)), ecs = vec2(cos(en),sin(en));
  float bn = mod(atan(p.x,p.y), 2.*an) - an; p = length(p)*vec2(cos(bn), abs(sin(bn))); p -= r*acs; p += ecs*clamp(-dot(p,ecs), 0., r*acs.y/ecs.y); return length(p)*sign(p.x); }
float sdHex(vec2 p, float r){ const vec3 k = vec3(-.866025404,.5,.577350269); p = abs(p); p -= 2.*min(dot(k.xy,p),0.)*k.xy; p -= vec2(clamp(p.x,-k.z*r,k.z*r), r); return length(p)*sign(p.y); }
// emblem relief: signed distance of the engraved lines (card-local, x in [-HX,HX], y in [-HY,HY])
float emblem(vec2 p, int kind){
  vec2 c = p - vec2(0., .06);
  if (kind == 0) return min(abs(sdStar(c, .17, 5., 2.6))-.004, abs(length(c)-.215)-.003);
  if (kind == 1) return min(min(abs(length(c)-.08), abs(length(c)-.14)), abs(length(c)-.20)) - .004;
  if (kind == 2) return min(abs(sdHex(c, .15))-.004, abs(sdHex(c*rot(PI/6.), .08))-.004);
  float a = atan(c.y,c.x); return min(abs(length(c) - .09 - .04*step(.5,fract(a/TAU*12.)))-.004, abs(length(c)-.2)-.003);
}
vec3 scene(vec2 fc){
  float s = uS;
  vec2 q = (fc - .5*uRes)/uRes.y;
  vec3 rd = normalize(vec3(q, 1.5));
  // ---- nearest card ----
  float tBest = 1e9; int hit = -1; vec2 lp = vec2(0.);
  float corner = mix(.035, .0, uHeal), inset = mix(1., 1.0005, uHeal);
  for (int i=0;i<${NC};i++){
    vec3 n = cross(uAx[i], uAy[i]); float dn = dot(rd, n); if (abs(dn) < 1e-4) continue;
    float t = dot(uCen[i], n)/dn; if (t <= 0. || t >= tBest) continue;
    vec3 P = rd*t - uCen[i]; vec2 l = vec2(dot(P, uAx[i]), dot(P, uAy[i]));
    if (sdRBox(l, HE*inset, corner) < 0.) { tBest = t; hit = i; lp = l; }
  }
  // ---- studio background ----
  vec3 bg = mix(vec3(.012,.012,.03), vec3(.06,.04,.11), smoothstep(-.5,.6,q.y));
  for (int i=0;i<10;i++){ float fi = float(i); vec2 c = vec2(hash11(fi*3.1)*2.-1., hash11(fi*5.7)*1.-.5)*vec2(.95,.55) + .03*vec2(sin(s*.4+fi), cos(s*.5+fi*2.));
    float r = .05+.08*hash11(fi*2.3); bg += hsv2rgb(vec3(hash11(fi*9.1),.55,1.))*smoothstep(r,r*.5,length(q-c))*.05; }
  if (hit < 0) return bg;
  vec3 C = uCen[hit], AX = uAx[hit], AY = uAy[hit], N0 = cross(AX, AY);
  bool front = dot(rd, N0) > 0.;
  vec3 Pw = rd*tBest;
  vec2 cu = lp/HE;                                              // -1..1 on the card
  // slight bend + micro scratches in the normal
  vec3 n = front ? -N0 : N0;
  n = normalize(n + AX*cu.x*.10*(1.-uHeal) + (AX*gnoise(lp*40.+float(hit)) + AY*gnoise(lp*40.+7.))*.012);
  vec3 V = -rd;
  int kind = hit - (hit/4)*4;
  // ---- art (front only, fades as the wall heals) ----
  float art = front ? 1. - uHeal : 0.;
  float frameD = abs(sdRBox(lp, HE - vec2(.022), .02)) - .0025;
  float embD = emblem(lp, kind);
  float titleD = sdRBox(lp - vec2(-.05, -.36), vec2(.17, .016), .016);
  float infoD = min(sdRBox(lp - vec2(-.09, -.415), vec2(.13, .007), .007), sdRBox(lp - vec2(-.12, -.44), vec2(.10, .007), .007));
  float lineD = min(min(frameD, embD), min(titleD, infoD));
  float relief = smoothstep(.006, .0, lineD)*art;
  // raise the engraved lines: tilt the normal across them
  vec2 gD = vec2(emblem(lp+vec2(.001,0.),kind) - embD, emblem(lp+vec2(0.,.001),kind) - embD)/.001;
  n = normalize(n + (AX*gD.x + AY*gD.y)*.35*smoothstep(.01,.0,abs(embD))*art);
  float inEmb = smoothstep(.235, .22, length(lp - vec2(0.,.06)))*art;
  // ---- lights ----
  vec3 Lp = vec3(.8*sin(s*.7), .55 + .2*cos(s*.5), -.2);
  vec3 L = normalize(Lp - Pw);
  vec3 R = reflect(-V, n);
  vec3 b1 = normalize(vec3(.3*sin(s*.4), .85, -.5)), u1 = normalize(cross(b1, vec3(1.,0.,0.))), v1 = cross(b1, u1);
  float sb = dot(R,b1) > 0. ? smoothstep(.45,.38,abs(dot(R,u1)))*smoothstep(.12,.08,abs(dot(R,v1))) : 0.;
  vec3 b2 = normalize(vec3(-.8, .3, -.5)), u2 = normalize(cross(b2, vec3(0.,1.,0.))), v2 = cross(b2, u2);
  sb += dot(R,b2) > 0. ? smoothstep(.2,.16,abs(dot(R,u2)))*smoothstep(.35,.3,abs(dot(R,v2)))*.7 : 0.;
  vec3 mirror = vec3(.82,.84,.9)*(.05 + .2*smoothstep(-.2,1.,R.y) + sb*1.3);
  // ---- grating direction field: a different foil pattern per card; one continuous field once the wall heals ----
  vec2 W = Pw.xy;                                               // world position on the wall plane (z = 3)
  float gCard;
  if (kind == 0) gCard = .7 + 1.4*fbm(lp*2.5 + float(hit));                 // flowing
  else if (kind == 1) gCard = atan(cu.y*HE.y, cu.x*HE.x) + PI*.5;            // concentric
  else if (kind == 2) gCard = atan(cu.y*HE.y, cu.x*HE.x);                    // starburst
  else { vec2 cid = floor(lp*11.); gCard = hash21(cid + float(hit))*PI; }    // sticker mosaic
  float gWall = .25*s + 1.6*fbm(W*.55) + .5*sin(W.x*1.1);
  float gAng = mix(gCard, gWall, uHeal);
  if (inEmb > .5) gAng = atan(lp.y-.06, lp.x) + PI*.5;
  vec3 gw = AX*cos(gAng) + AY*sin(gAng);
  vec3 g = normalize(gw - n*dot(n,gw)); vec3 bdir = cross(n, g);
  vec3 rb = vec3(0.);
  for (int i=0;i<5;i++){
    float fi = float(i);
    vec3 Li = i == 0 ? L : normalize(vec3(sin(fi*1.9 + s*.3)*.9, .5 + .3*sin(fi*2.7), -.6 + .4*cos(fi*1.9)));
    float wi = i == 0 ? 1. : .5;
    vec3 Hh = Li + V; float k = abs(dot(Hh, g)), kb = dot(Hh, bdir);
    float spread = exp(-kb*kb*mix(2.4, 1.3, inEmb));
    for (int m=1;m<=3;m++) rb += spec(1550.*k/float(m))*(1.1/float(m))*spread*wi;
  }
  rb = max(mix(vec3(lum(rb)), rb, 1.4), 0.);
  vec3 col = mirror*(.6 + .4*(1.-clamp(lum(rb),0.,1.))) + rb*1.0 + vec3(.03,.03,.04);
  // engraved art reads as bright polished silver
  col = mix(col, mirror*1.6 + vec3(.25) + rb*.35, relief*.85);
  // glitter: sparkles flash when their tiny facet lines up with the key light
  vec2 gc = floor(lp*160.); vec2 hn = hash22(gc + float(hit)*13.);
  vec3 nf = normalize(n + (AX*(hn.x-.5) + AY*(hn.y-.5))*.9);
  col += pow(max(dot(reflect(-V,nf), L),0.), 350.)*step(.86, hash21(gc+3.))*vec3(1.,.97,.9)*2.2*(front?1.:.4);
  // sweeping glare (hero moments)
  float sw = dot(cu, normalize(vec2(1.,.6))) - (fract(s*.45 + float(hit)*.13)*4. - 2.);
  col += exp(-sw*sw*30.)*.35*vec3(1.,.97,.93)*(1.-uHeal);
  // back of the card: navy with a holographic logo
  if (!front) { float r = length(lp); col = vec3(.05,.07,.16) + rb*.45*smoothstep(.2,.18,abs(r-.12)) + mirror*.25; }
  // card edge bevel
  float ed = sdRBox(lp, HE*inset, corner);
  col += smoothstep(-.006, .0, ed)*.5*(1.-uHeal);
  // ---- cut along the Bauhaus grid once the wall faces the camera squarely ----
  if (uCut > 0.) { vec2 dpx = vec2(fc.x, uRes.y - fc.y)*(1920./uRes.x); vec2 gg = vec2(dpx.x - (${G.OX}.), dpx.y);
    vec2 fr = abs(fract(gg/${G.TILE}.+.5)-.5)*${G.TILE}.; float gap = mix(0., 6., uCut);
    col = mix(col, vec3(.02), (1. - smoothstep(gap, gap+1.5, min(fr.x, fr.y)))*uCut);
    col += (1. - smoothstep(0., 3., abs(min(fr.x,fr.y)-gap-1.)))*uCut*.45; }
  col *= 1. - .2*dot(q,q);
  return col/(1.+col*.2);
}` }));
})();
