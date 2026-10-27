// 12 Risograph print (v2) — a fluorescent poster (pink sun over mirrored mountains) printed in five spot inks as
// coarse halftone with grain and mis-registration. Like the reference, the print is sliced into strips that slide
// past each other: diagonal shear -> vertical mirrored "spine" -> full-frame diagonal stripes at the climax ->
// everything slides home and the poster re-forms.
(() => { const E = Engine;
E.register(12, E.shaderScene({ scaled: true, hudDark: true,
  uniforms(p, s, tg, gl) {
    const e = E.ease, k1 = e((s - .9) / .6) * (1 - e((s - 2.0) / .45));    // diagonal shear
    const k2 = e((s - 2.15) / .45) * (1 - e((s - 3.25) / .4));                // vertical mirrored spine
    const k3 = e((s - 3.35) / .4) * (1 - e((s - 4.45) / .6));                 // climax: full-frame stripes
    gl.uniform3f(p.u.uK, k1, k2, k3);
  },
  frag: `
uniform vec3 uK;
// spot inks
const vec3 PINK = vec3(1.,.28,.72), RED = vec3(1.,.22,.24), YEL = vec3(1.,.78,.12), GRN = vec3(.25,.62,.42), BLU = vec3(.24,.55,.82);
// poster coverage of each ink at poster coords p (height 1, centre 0): x = pink, y = red, z = yellow, w = green, v = blue
void poster(vec2 p, float s, out float pk, out float rd, out float yl, out float gn, out float bl){
  pk = 0.; rd = .35; yl = .92; gn = 0.; bl = 0.;
  // sun with a ragged edge
  vec2 c = vec2(0., .18 + .01*sin(s*1.3)); float a = atan(p.y-c.y, p.x-c.x);
  float R = .30 + .012*sin(a*23. + s*2.) + .008*sin(a*41.);
  float sun = smoothstep(.004, -.004, length(p - c) - R);
  pk = max(pk, sun*.95); rd = mix(rd, 0., sun); yl = mix(yl, .08, sun);
  // horizon band
  float band = step(abs(p.y + .06), .045);
  pk = max(pk, band*.9); rd = mix(rd, .25, band); yl = mix(yl, .1, band);
  // mirrored mountains (hourglass) below the horizon
  float m1 = step(p.y, -.1) * step(abs(p.x) - .9*(-.1 - p.y)*1.9, 0.) * step(-.42, p.y);
  float m2 = step(p.y, -.1) * step(-.32, p.y) * step(abs(abs(p.x) - .62) - (p.y + .32)*1.2, 0.);
  float m3 = step(p.y, -.42) * step(abs(p.x) - (p.y + .74)*1.5, 0.);
  gn = max(gn, max(m2, m1*.0)); bl = max(bl, m3*.9 + m1*.55);
  pk = max(pk, step(p.y, -.42)*step(-.5, p.y)*.85);
  float mt = max(max(m2, m3), m1); rd = mix(rd, 0., mt); yl = mix(yl, .15, mt);
}
float screen(vec2 d, float ang, float v, float cell){
  vec2 q = rot(ang)*d/cell; vec2 f = fract(q)-.5;
  float r = sqrt(clamp(v,0.,1.))*.62, aa = .9/cell*1.5 + .03;
  return smoothstep(r+aa, r-aa, length(f));
}
vec3 scene(vec2 fc){
  float s = uS;
  vec2 d = vec2(fc.x, uRes.y-fc.y)*(1920./uRes.x);                 // design px, y down
  vec2 p = (d - vec2(960.,540.))/1080.; p.y = -p.y;                 // poster coords, y up
  // ---- strip slicing ----
  vec2 pp = p;
  if (uK.x > 0.) { vec2 dir = normalize(vec2(1.,-.62)), nrm = vec2(-dir.y, dir.x);
    float k = floor(dot(pp, nrm)/.11); pp += dir*(mod(k,2.)*2.-1.)*.42*uK.x*(.6+.4*hash11(k)); }
  if (uK.y > 0.) { float k = floor(pp.x/.09); float off = (mod(k,2.)*2.-1.)*.5*uK.y; pp.y += off; pp.x = mix(pp.x, abs(pp.x), uK.y); }
  if (uK.z > 0.) { vec2 dir = normalize(vec2(.62,1.)), nrm = vec2(-dir.y, dir.x);
    float k = floor(dot(pp, nrm)/.075); pp = mix(pp, pp + dir*(mod(k,2.)*2.-1.)*.9 + nrm*.0, uK.z); pp = mix(pp, rot(1.5708*uK.z)*pp, .35*uK.z); }
  // ---- mis-registration per ink (bigger during the climax) ----
  float mis = (.006 + .02*uK.z + .01*uK.x)*1.;
  vec3 col = vec3(.97,.94,.86);
  float pk, rd, yl, gn, bl, t0, t1, t2, t3;
  float cell = 7.5 + 5.*uK.z;
  poster(pp + vec2(mis, 0.), s, pk, t0, t1, t2, t3);  col *= mix(vec3(1.), PINK, screen(d, .26, pk, cell)*.95);
  poster(pp + vec2(-mis, mis*.6), s, t0, rd, t1, t2, t3); col *= mix(vec3(1.), RED, screen(d, 1.31, rd, cell)*.9);
  poster(pp + vec2(0., -mis), s, t0, t1, yl, t2, t3); col *= mix(vec3(1.), YEL, screen(d, 0., yl, cell)*.92);
  poster(pp + vec2(mis*.5, mis), s, t0, t1, t2, gn, t3); col *= mix(vec3(1.), GRN, smoothstep(.4,.6,gn)*.9);
  poster(pp + vec2(-mis*.5, -mis*.4), s, t0, t1, t2, t3, bl); col *= mix(vec3(1.), BLU, smoothstep(.3,.5,bl)*.85);
  // drum grain, scratches, uneven ink
  col *= .93 + .07*fbm(d*.012 + 3.);
  col += (hash21(floor(d/1.5) + floor(s*12.)) - .5)*.07;
  col = mix(col, vec3(.97,.94,.86), step(.997, hash21(floor(d/3.)+7.))*.8);
  return col;
}` }));
})();
