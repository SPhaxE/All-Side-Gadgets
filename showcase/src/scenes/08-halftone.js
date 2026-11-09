// 08 Halftone dots (v2) — the flower photo from scene 07 printed as a CMYK halftone on paper. The dots themselves
// animate: screens counter-rotate into moire rosettes, a wave from the flower re-shapes the dots (round -> line -> cross),
// the four separations lift apart in depth (3/4 view) and snap back into register, then the camera pushes into one
// black dot, which becomes the O of scene 09.
(() => { const E = Engine, gl = E.gl;
const W = 1920, H = 1080;
let prog, target, src, copyProg;
E.register(8, E.customScene({
  hudDark: true,
  init() {
    target = E.makeTarget(W, H); src = E.makeTarget(W, H);
    copyProg = E.program(E.PRELUDE + `uniform sampler2D uTex; void main(){ fragColor = vec4(texture(uTex, vUv).rgb, 1.); }`);
    prog = E.program(E.PRELUDE + `
      uniform sampler2D uSrc; uniform float uRotA, uShapeT, uSep, uYaw, uZoom, uO;
      const float CELL = 22.;
      vec3 photo(vec2 d){ vec2 uv = d/vec2(1920.,1080.); uv.y = 1.-uv.y;
        vec3 c = texture(uSrc, clamp(uv, 0., 1.)).rgb;
        c = mix(vec3(lum(c)), c, 1.9); c = clamp((c - .5)*1.45 + .42, 0., 1.);        // pop-art: punchy contrast + saturation
        return c; }
      vec4 cmyk(vec3 c){ float k = 1.-max(c.r,max(c.g,c.b)); float inv = 1./max(1.-k,1e-3); return vec4((1.-c.r-k)*inv,(1.-c.g-k)*inv,(1.-c.b-k)*inv,k); }
      // coverage of one ink screen at design-px d; shape morphs by a wave travelling out from the flower
      float screenAt(vec2 d, float ang, int ch){
        mat2 R = rot(ang); vec2 q = R*d/CELL; vec2 cid = floor(q), f = fract(q)-.5;
        vec2 cp = transpose(R)*((cid+.5)*CELL);
        vec4 k4 = cmyk(photo(cp)); float v = ch==0 ? k4.x : (ch==1 ? k4.y : (ch==2 ? k4.z : k4.w));
        float r = length(cp - vec2(960.,420.))/1100.;
        float sh = clamp(uShapeT - r*1.6, 0., 2.);                            // 0 round, 1 line, 2 cross
        float dRound = length(f) - sqrt(v)*.56;
        float dLine = abs(f.y) - v*.5;
        float dCross = min(abs(f.x), abs(f.y)) - v*.30;
        float dd = sh < 1. ? mix(dRound, dLine, ease(sh)) : mix(dLine, dCross, ease(sh-1.));
        float aa = fwidth(q.x)*.9 + .02;
        return smoothstep(aa, -aa, dd);
      }
      vec3 scene(vec2 fc){
        vec2 sp = (fc - .5*uRes)/uRes.y;                                      // screen, height 1
        vec3 paper = vec3(.965,.94,.885);
        vec3 inks[4] = vec3[4](vec3(.0,.68,.94), vec3(.93,.0,.55), vec3(1.,.93,.0), vec3(.12,.10,.11));
        float angs[4] = float[4](.2618, 1.309, 0., .7854);
        vec3 col = paper;
        // 3/4 view: each separation is a plane at depth z_i, viewed by a yawed camera; zoom pushes toward the O dot
        for (int i=0;i<4;i++){
          float z = (float(i) - 1.5)*uSep;
          vec3 ro = vec3(sin(uYaw)*2.2, 0., -2.2*cos(uYaw)); vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0.,1.,0.), fw)), up = cross(fw, rt);
          vec3 rd = normalize(fw*2.2 + rt*sp.x + up*sp.y);
          float t = (z - ro.z)/rd.z; vec3 P = ro + rd*t; // plane z = const
          vec2 pd = vec2(P.x, -P.y)*1080./1.0 + vec2(960.,540.);            // plane coords -> design px (1 unit = screen height)
          pd = (pd - vec2(960.,540.))/uZoom + vec2(960.,540.) + vec2(7.5*(1.-1./uZoom))*0.;
          float a = angs[i] + uRotA*(i==3 ? 1. : (i==1 ? -.6 : .35));
          float cov = screenAt(pd, a, i);
          float shadow = uSep > .001 ? .0 : 0.;
          col *= mix(vec3(1.), inks[i], cov*.95);
        }
        col *= .965 + .035*gnoise(fc*.6);                                     // paper tooth
        // the O: one black dot that grows to 60% of the frame height at the end of the push
        float rO = mix(0., .30, uO);
        float dO = length(sp) - rO;
        col = mix(col, paper, ease(uO*1.3));                                   // the rest of the print fades to paper...
        col = mix(col, inks[3], smoothstep(.002, -.002, dO)*step(.001,uO));    // ...leaving the single black dot
        return col;
      }
      void main(){ fragColor = vec4(clamp(scene(gl_FragCoord.xy),0.,1.),1.); }`);
  },
  async render(s, tg) {
    if (!this.cached) {      // the flower "photo": scene 07 at full bloom, rendered once and kept
      const t = await E.SCENES[6].render(5.4, 7 * 6 + 5.4);
      E.bindTarget(src); gl.useProgram(copyProg.pr); E.bindTex(0, t, copyProg.u.uTex); E.drawQuad();
      this.cached = true;
    }
    E.bindTarget(target); E.setBase(prog, W, H, s, tg); E.bindTex(0, src.tex, prog.u.uSrc);
    gl.uniform1f(prog.u.uRotA, .9 * E.ease((s - .6) / 1.8) - .9 * E.ease((s - 3.0) / .9));
    gl.uniform1f(prog.u.uShapeT, 2.6 * E.ease((s - 1.5) / 1.6) * (1 - E.ease((s - 3.9) / .7)) * 1.0);
    const lift = E.ease((s - 3.0) / .45) * (1 - E.ease((s - 3.9) / .3));
    gl.uniform1f(prog.u.uSep, .35 * lift);
    gl.uniform1f(prog.u.uYaw, .55 * lift);
    const push = E.ease((s - 4.35) / 1.4);
    gl.uniform1f(prog.u.uZoom, Math.pow(16, push));
    gl.uniform1f(prog.u.uO, E.ease((s - 4.9) / .5));
    E.drawQuad();
    return target.tex;
  },
}));
})();
