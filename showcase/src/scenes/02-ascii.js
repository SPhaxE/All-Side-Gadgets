// 02 ASCII art (v2) — the street-dancer footage rendered as ASCII: 12x24 px cells, brightness ramp + edge-direction
// glyphs, warm white for the lit dancer and dark teal for the night street, glyph trails on fast motion, a ripple of
// flipping characters radiating from the dancer at the climax, and at the end the characters snap into a crystal grid.
(() => { const E = Engine, gl = E.gl;
const CW = 12, CH = 24, W = 1920, H = 1080, COLS = W / CW, ROWS = H / CH;
const RAMP = ' .:-=+*#%@', EDGE = '-/|\\', EXTRA = '0123456789ABCDEF';
let prog, target, atlas, foot, mask;
E.register(2, E.customScene({
  hudDark: false,
  init() {
    target = E.makeTarget(W, H);
    foot = Footage('assets/build/dancer/rgb/%03d.jpg', 225, { cache: 8 });
    mask = Footage('assets/build/dancer/mask/%03d.png', 225, { cache: 8 });
    const cv = document.createElement('canvas'); const GW = 48, GH = 96; cv.width = GW * 16; cv.height = GH * 3;
    const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '800 80px "JetBrains Mono",monospace';
    [RAMP, EDGE, EXTRA].forEach((str, r) => [...str].forEach((ch, i) => c.fillText(ch, i * GW + GW / 2, r * GH + GH / 2 + 4)));
    atlas = E.makeTex(cv.width, cv.height); E.uploadCanvas(atlas, cv); E.atlas = atlas;
    prog = E.program(E.PRELUDE + `
      uniform sampler2D uF, uFp, uM, uAtlas; uniform float uAspect, uRip, uCryst;
      // footage is portrait: fit to full height, centred; outside it the street is extended by clamping + darkening
      vec2 fuv(vec2 d){ float w = 1080.*uAspect; float u = (d.x - (960. - w*.5))/w; return vec2(u, 1. - d.y/1080.); }
      float edgeFade(vec2 d){ float w = 1080.*uAspect; return 1. - smoothstep(0., 520., abs(d.x - 960.) - w*.5)*.65; }
      vec3 src(sampler2D t, vec2 d){ return texture(t, clamp(fuv(d), vec2(.002), vec2(.998))).rgb * edgeFade(d); }
      vec3 scene(vec2 fc){
        float s = uS;
        vec2 d = vec2(fc.x, uRes.y - fc.y)*(1920./uRes.x);
        vec2 cs = vec2(12.,24.), cell = floor(d/cs), cuv = fract(d/cs), cc = (cell + .5)*cs;
        // crystal: at the end cells re-quantise to a coarser, perfectly regular block grid
        float M = texture(uM, clamp(fuv(cc), vec2(.002), vec2(.998))).r * step(0., fuv(cc).x) * step(fuv(cc).x, 1.);
        float raw = lum(src(uF, cc)), rawp = lum(src(uFp, cc));
        // dancer (dark clothes on a bright road): inverted + stretched so the figure is the dense, bright part
        float Ld = clamp((1. - raw*1.6)*1.25, 0., 1.), Lb = clamp(raw*.55, 0., 1.)*.6;
        float L = mix(Lb, .35 + .65*Ld, M);
        float gx = texture(uM, clamp(fuv(cc + vec2(cs.x,0.)),0.,1.)).r - texture(uM, clamp(fuv(cc - vec2(cs.x,0.)),0.,1.)).r;
        float gy = texture(uM, clamp(fuv(cc + vec2(0.,cs.y)),0.,1.)).r - texture(uM, clamp(fuv(cc - vec2(0.,cs.y)),0.,1.)).r;
        float motion = abs(raw - rawp)*M;
        float r = length(cc - vec2(960., 560.));
        float ring = exp(-pow((r - uRip*1300.)/90., 2.))*step(.001, uRip)*(1. - uRip*.6)*(1. - M);
        float Ls = clamp(L + ring*.7, 0., .999);
        float row = 0., idx = floor(Ls*10.);
        vec2 g = vec2(gx, -gy*.5);
        if (length(g) > .35) { float th = mod(atan(g.y, g.x) + PI*.5, PI); row = 1.; idx = mod(floor(th/(PI*.25) + .5), 4.); Ls = 1.; }
        if (ring > .55 || motion > .3) { row = 2.; idx = floor(hash21(cell + floor(s*15.))*16.); }
        if (uCryst > 0.) { float k = step(hash21(cell*.37), uCryst*.7)*(1. - M); if (k > .5) { row = 0.; idx = mod(cell.x + cell.y, 2.) < .5 ? 3. : 6.; Ls = .35; } }
        float a = texture(uAtlas, vec2((idx + cuv.x)/16., 1. - (row + cuv.y)/3.)).r;
        vec3 warm = vec3(1.,.93,.80), teal = vec3(.20,.62,.60);
        vec3 col = mix(teal*(.5 + .9*Ls), warm*(.55 + .6*Ls), M);
        col = mix(col, vec3(.95,.55,.25), step(.5, row - 1.)*.6);          // flicker glyphs in amber
        col = mix(col, vec3(.6,.85,.9), uCryst*.3*(1. - M));
        vec3 o = col*a + col*.04*Ls;
        o *= .92 + .08*sin(fc.y*3.14159);                                  // faint CRT lines
        return o;
      }
      void main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
  },
  async render(s, tg) {
    const fi = Math.floor(Math.max(0, s + .75) * 30 + 1e-4);
    const [t, tp, m] = await Promise.all([foot.tex(fi), foot.tex(fi - 2), mask.tex(fi)]);
    E.bindTarget(target); E.setBase(prog, W, H, s, tg);
    E.bindTex(0, t, prog.u.uF); E.bindTex(1, tp, prog.u.uFp); E.bindTex(2, atlas, prog.u.uAtlas); E.bindTex(3, m, prog.u.uM);
    gl.uniform1f(prog.u.uAspect, 340 / 480);
    gl.uniform1f(prog.u.uRip, E.ease((s - 3.0) / 1.3) * (s < 4.4 ? 1 : 0));
    gl.uniform1f(prog.u.uCryst, E.ease((s - 4.5) / .9));
    E.drawQuad();
    return target.tex;
  },
}));
})();
