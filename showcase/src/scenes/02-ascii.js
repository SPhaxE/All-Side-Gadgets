// 02 ASCII art — 3D scene rendered to a tiny buffer, mapped to a glyph atlas (brightness ramp + edge chars) over digit rain
(() => { const E = Engine; const gl = E.gl;
const CW = 12, CH = 24, W = 1920, H = 1080, COLS = W / CW, ROWS = H / CH;   // 160 x 45 cells
const RAMP = ' .:-=+*#%@', EDGE = '-/|\\', DIGITS = '0123456789ABCDEF';
let srcProg, outProg, srcT, atlas;
const SRC = `
float s_;
float smin(float a, float b, float k){ float h = max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }
float map(vec3 p){
  float t = s_;
  p.xz *= rot(t*.8); p.xy *= rot(t*.55+.4);
  vec2 q = vec2(length(p.xz)-.95, p.y);
  float d = length(q)-.30 - .05*sin(atan(p.z,p.x)*6.+t*3.);
  vec3 p2 = p; p2.yz *= rot(PI*.5); p2.xy *= rot(t*.9);
  vec2 q2 = vec2(length(p2.xz)-.52, p2.y); d = smin(d, length(q2)-.15, .18);
  d = smin(d, length(p)-.30-.08*sin(t*4.), .25);
  return d;
}
vec4 scene4(vec2 fc){
  s_ = uS;
  vec2 uv = (fc/uRes - .5)*vec2(16./9.,1.);
  vec3 ro = vec3(0.,0.,-4.7); vec3 rd = normalize(vec3(uv, 1.5));
  float t = 0.; bool hit = false;
  for (int i=0;i<64;i++){ float d = map(ro+rd*t); if (d<.002){ hit=true; break; } t += d; if (t>7.) break; }
  if (!hit) return vec4(0.);
  vec3 p = ro+rd*t; vec2 e = vec2(.004,0.);
  vec3 n = normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
  vec3 L = normalize(vec3(-.5,.7,-.6));
  float dif = max(dot(n,L),0.), fr = pow(1.-max(dot(n,-rd),0.),2.);
  float lum = .1 + .82*dif + .35*fr;
  float hue = fract(n.x*.18 + n.y*.12 + uS*.07 + t*.05);
  return vec4(clamp(lum,0.,1.), hue, 1., 1.);
}
void main(){ fragColor = scene4(gl_FragCoord.xy); }`;
const OUT = `
uniform sampler2D uSrc; uniform sampler2D uAtlas;
vec4 S(ivec2 c){ return texelFetch(uSrc, clamp(c, ivec2(0), ivec2(160,45)-1), 0); }
vec3 scene(vec2 fc){
  vec2 cs = vec2(12.,24.);
  vec2 cf = floor(fc/cs); ivec2 ci = ivec2(cf); vec2 cuv = fract(fc/cs);
  vec4 c = S(ci);
  float a; vec3 col = vec3(0.); float row = 0., idx = 0.; bool draw = true;
  // background rain
  float sp = 2.+6.*hash11(cf.x*7.3); float ph = hash11(cf.x*3.1)*50.;
  float trail = 10. + 14.*hash11(cf.x*1.7);
  float pos = mod(cf.y*1. + (uS+9.)*sp + ph, 45.+trail);   // moves downward as s grows
  float head = max(0., 1. - pos/trail); head = pow(head, 2.2) * step(pos, trail);
  vec3 rainCol = mix(vec3(.05,.35,.30), vec3(.2,.9,.8), head);
  if (c.w < .5){
    float cc = floor(hash21(cf + floor(uS*7.+cf.x))*16.);
    row = 2.; idx = cc; col = rainCol*head*.9 + vec3(.02,.06,.07)*.0;
    draw = head > .02;
  } else {
    float L = c.x;
    // edge detection on luminance
    float gx = S(ci+ivec2(1,0)).x*S(ci+ivec2(1,0)).w - S(ci+ivec2(-1,0)).x*S(ci+ivec2(-1,0)).w;
    float gy = S(ci+ivec2(0,1)).x*S(ci+ivec2(0,1)).w - S(ci+ivec2(0,-1)).x*S(ci+ivec2(0,-1)).w;
    vec2 g = vec2(gx, gy*.5);
    bool edge = length(g) > .30;
    if (edge){
      float th = mod(atan(g.y,g.x) + PI*.5, PI);
      float k = mod(floor(th/(PI*.25)+.5), 4.);
      row = 1.; idx = k; L = max(L, .75);
    } else { row = 0.; idx = floor(clamp(L,0.,.999)*10.); }
    col = hsv2rgb(vec3(c.y, .6, 1.)) * (.45 + .75*L);
    col = mix(col, vec3(1.), smoothstep(.8,1.,L)*.7);
  }
  vec2 auv = vec2((idx + cuv.x)/16., 1. - (row + 1. - cuv.y)/3.);
  a = draw ? texture(uAtlas, auv).r : 0.;
  vec3 o = col*a;
  if (c.w > .5) o += col*.05*c.x;   // faint cell tint under the subject
  return o;
}`;
E.register(2, E.customScene({
  hudDark: false,
  init() {
    srcProg = E.program(E.PRELUDE + SRC); srcT = E.makeTarget(COLS, ROWS, { nearest: true });
    outProg = E.program(E.PRELUDE + OUT + `\nvoid main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
    this.out = E.makeTarget(W, H);
    const cv = document.createElement('canvas'); const GW = 48, GH = 96; cv.width = GW*16; cv.height = GH*3;
    const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0,0,cv.width,cv.height);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 80px "JetBrains Mono",monospace';
    [RAMP, EDGE, DIGITS].forEach((str, r) => { [...str].forEach((ch, i) => { c.fillText(ch, i*GW + GW/2, r*GH + GH/2 + 4); }); });
    atlas = E.makeTex(cv.width, cv.height); E.uploadCanvas(atlas, cv); E.atlas = atlas;
  },
  render(s, tg) {
    E.bindTarget(srcT); E.setBase(srcProg, COLS, ROWS, s, tg); E.drawQuad();
    E.bindTarget(this.out); E.setBase(outProg, W, H, s, tg);
    E.bindTex(0, srcT.tex, outProg.u.uSrc); E.bindTex(1, atlas, outProg.u.uAtlas); E.drawQuad();
    return this.out.tex;
  },
}));
})();
