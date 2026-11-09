// 17 Vaporwave (v2) — a pastel "vaporwave temple": an endless colonnade of fluted columns in fog, a pink marble floor
// that mirrors everything, a floating chrome sphere reflecting the sky and the columns, retro OS dialogs popping up
// (ＡＥＳＴＨＥＴＩＣＳ.EXE, katakana), VHS chroma and scan-lines. At the climax the sphere rises, the sky turns to a
// sunset gradient and the marble floor ripples like water.
(() => { const E = Engine;
const W = 1920, H = 1080;
function dialog(c, x, y, w, h, title, body, prog, k) {
  if (k <= 0) return;
  const sc = .6 + .4 * E.ease(k / .6) + .04 * Math.sin(k * 18) * Math.exp(-k * 6);
  c.save(); c.translate(x + w / 2, y + h / 2); c.scale(sc, sc); c.translate(-w / 2, -h / 2); c.globalAlpha = Math.min(1, k * 4);
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(10, 12, w, h);
  c.fillStyle = '#f2ecff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2b1f4a'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ff7ad9'); g.addColorStop(1, '#7ad7ff');
  c.fillStyle = g; c.fillRect(3, 3, w - 6, 34);
  c.fillStyle = '#1b1035'; c.font = '700 20px "JetBrains Mono"'; c.fillText(title, 14, 27);
  for (let i = 0; i < 3; i++) { c.strokeStyle = '#1b1035'; c.strokeRect(w - 30 - i * 28, 9, 20, 20); }
  c.font = '500 26px "IPAGothic","WenQuanYi Zen Hei"'; c.fillStyle = '#2b1f4a'; body.forEach((l, i) => c.fillText(l, 20, 80 + i * 36));
  if (prog >= 0) { c.strokeStyle = '#2b1f4a'; c.strokeRect(20, h - 46, w - 40, 22); c.fillStyle = '#9b6bff';
    for (let i = 0; i < Math.floor(prog * 20); i++) c.fillRect(24 + i * (w - 48) / 20, h - 42, (w - 48) / 20 - 3, 14); }
  c.restore();
}
E.register(17, E.postScene({
  hudDark: false,
  draw(c, s) {
    c.clearRect(0, 0, W, H);
    dialog(c, 140, 140, 520, 250, 'ＡＥＳＴＨＥＴＩＣＳ.EXE', ['ようこそ  ·  WELCOME', '永遠の夏 · 1995'], -1, s - 2.25);
    dialog(c, 1250, 210, 480, 230, 'LOADING...', ['データ読み込み中', ''], E.ease((s - 2.6) / 1.2), s - 2.55);
    dialog(c, 980, 640, 440, 200, 'MESSAGE', ['⚠ 現実が見つかりません', 'reality.dll not found'], -1, s - 2.85);
  },
  frag: `
float RISE, RIP;
float sdCol(vec3 p){                                   // fluted column with base and capital, repeated along z
  vec3 q = p; q.x = abs(q.x) - 2.4; q.z = mod(q.z, 2.6) - 1.3;
  float a = atan(q.z, q.x); float r = .32 + .018*cos(a*18.);
  float shaft = max(length(q.xz) - r, abs(q.y - 2.4) - 2.4);
  float cap = max(max(abs(q.x) - .5, abs(q.z) - .5), abs(q.y - 4.85) - .12);
  float base = max(max(abs(q.x) - .48, abs(q.z) - .48), abs(q.y - .1) - .1);
  float beam = max(abs(q.x) - .5, abs(q.y - 5.15) - .2);          // architrave along the row
  return min(min(shaft, min(cap, base)), beam);
}
vec3 SPH;
float map(vec3 p, out int id){ float d1 = sdCol(p); float d2 = length(p - SPH) - .85; id = d1 < d2 ? 1 : 2; return min(d1, d2); }
vec3 sky(vec3 rd){
  float y = rd.y;
  vec3 a = mix(vec3(1.,.72,.86), vec3(.55,.85,1.), smoothstep(-.05,.5,y));
  vec3 sunset = mix(vec3(1.,.55,.45), vec3(.55,.3,.75), smoothstep(-.05,.45,y));
  vec3 c = mix(a, sunset, RISE);
  c += vec3(1.,.9,.8)*pow(max(dot(rd, normalize(vec3(0.,.12,1.))),0.), 40.)*(.4 + .6*RISE);
  c = mix(c, vec3(1.,.95,1.), smoothstep(.55,.0,abs(fbm(rd.xz/(rd.y+.3)*1.3 + uS*.03)))*.25*step(0.,y));   // marble clouds
  return c;
}
vec3 shade(vec3 ro, vec3 rd, out float tHit, out int id, out vec3 n){
  float t = 0.; id = 0; tHit = 1e9;
  for (int i=0;i<90;i++){ vec3 p = ro + rd*t; int k; float d = map(p, k); if (d < .002*t) { id = k; tHit = t; break; } t += d; if (t > 60.) break; }
  if (id == 0) { n = vec3(0.); return sky(rd); }
  vec3 p = ro + rd*tHit; vec2 e = vec2(.002,0.); int k;
  n = normalize(vec3(map(p+e.xyy,k)-map(p-e.xyy,k), map(p+e.yxy,k)-map(p-e.yxy,k), map(p+e.yyx,k)-map(p-e.yyx,k)));
  vec3 L = normalize(vec3(.4,.8,.5));
  if (id == 1) { float dif = clamp(dot(n,L)*.5+.55, 0., 1.); vec3 marble = vec3(.98,.92,.95)*(.9 + .1*fbm(p.xy*3.));
    vec3 c = marble*(.55 + .55*dif)*mix(vec3(1.,.9,.97), vec3(.95,.97,1.), n.x*.5+.5); return mix(c, sky(rd)*.95, 1. - exp(-tHit*.045)); }
  return vec3(0.);
}
vec3 scene(vec2 fc){
  float s = uS; vec2 q = (fc - .5*uRes)/uRes.y;
  RISE = ease((s - 3.3)/1.1); RIP = RISE*(1. - ease((s - 5.)/1.));
  SPH = vec3(0., 1.6 + 1.2*RISE + .12*sin(s*1.4), s*1.1 + 7.);
  vec3 ro = vec3(.3*sin(s*.4), 1.5, s*1.1);
  vec3 fw = normalize(vec3(-.05*sin(s*.4), .08 + .1*RISE, 1.)), rt = normalize(cross(vec3(0.,1.,0.), fw)), up = cross(fw, rt);
  vec3 rd = normalize(fw*1.5 + rt*q.x + up*q.y);
  vec3 col; float t; int id; vec3 n;
  // floor plane y = 0 (pink marble mirror) vs scene
  float tf = rd.y < 0. ? -ro.y/rd.y : 1e9;
  col = shade(ro, rd, t, id, n);
  if (id == 2) {                                                   // chrome sphere: reflect
    vec3 p = ro + rd*t; vec3 r = reflect(rd, n); float t2; int id2; vec3 n2;
    vec3 rc = shade(p + n*.01, r, t2, id2, n2);
    if (r.y < 0.) { float tf2 = -p.y/r.y; if (tf2 < t2) rc = mix(vec3(1.,.66,.82), vec3(.95,.6,.8), fbm((p + r*tf2).xz*.8))*.9; }
    col = rc*vec3(.95,.97,1.) + pow(1. - max(dot(-rd, n),0.), 4.)*.3;
  }
  if (tf < t) {
    vec3 p = ro + rd*tf;
    vec3 nf = vec3(0.,1.,0.);
    nf = normalize(nf + vec3(sin(length(p.xz - SPH.xz)*3. - s*6.), 0., cos(length(p.xz - SPH.xz)*3. - s*6.))*.06*RIP*exp(-length(p.xz - SPH.xz)*.15));
    vec3 r = reflect(rd, nf); float t2; int id2; vec3 n2;
    vec3 rc = shade(p + nf*.01, r, t2, id2, n2);
    if (id2 == 2) { vec3 p2 = p + r*t2; rc = sky(reflect(r, n2))*.95; }
    vec3 marble = mix(vec3(1.,.70,.84), vec3(.96,.62,.80), smoothstep(.0,.6,abs(fbm(p.xz*.6 + vec2(fbm(p.xz*1.7)*1.5)))));
    marble = mix(marble, vec3(1.,.9,.95), smoothstep(.02,.0,abs(fbm(p.xz*1.1)-.1))*.6);   // veins
    float tile = step(.97, max(fract(p.x*.5), fract(p.z*.5)));
    marble *= 1. - tile*.15;
    float fres = .25 + .6*pow(1. + rd.y, 6.);
    col = mix(marble, rc, fres);
    col = mix(col, sky(rd)*.95, 1. - exp(-tf*.04));
  }
  // dialogs, VHS chroma + scan-lines + tracking noise
  vec2 uv = fc/uRes; vec2 o = vec2(2.5,0.)/uRes;
  vec4 ov = vec4(texture(uTex, uv+o).r, texture(uTex, uv).g, texture(uTex, uv-o).b, texture(uTex, uv).a);
  col = mix(col, ov.rgb, ov.a);
  col *= .93 + .07*sin(fc.y*3.14159);
  float tr = smoothstep(.02,.0,abs(fract(uv.y*.7 - s*.15) - .5) - .47);
  col += tr*.05*(hash21(fc + floor(s*30.)) - .3);
  col *= 1. - .3*dot(q,q);
  return col;
}`,
}));
})();
