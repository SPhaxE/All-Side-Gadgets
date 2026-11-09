// GL post helpers shared by scenes: separable gaussian blur at reduced resolution (bloom / frost / halos).
(() => {
  const E = Engine, gl = E.gl;
  let prog = null;
  function ensure() {
    if (prog) return;
    prog = E.program(E.PRELUDE + `
      uniform sampler2D uTex; uniform vec2 uDir; uniform float uGain;
      void main(){
        vec3 s = vec3(0.); float w = 0.;
        for (int i=-6;i<=6;i++){ float k = float(i); float g = exp(-k*k/18.); s += texture(uTex, vUv + uDir*k).rgb*g; w += g; }
        fragColor = vec4(s/w*uGain, 1.);
      }`);
  }
  // makeBlur(w, h): returns blur(tex, radiusPx, gain) -> texture (at w x h). radius is in output pixels of w x h.
  function makeBlur(w, h) {
    const a = E.makeTarget(w, h), b = E.makeTarget(w, h);
    return function blur(tex, radius, gain = 1, passes = 1) {
      ensure();
      let src = tex;
      for (let i = 0; i < passes; i++) {
        for (const [dst, dir] of [[a, [radius / 6 / w, 0]], [b, [0, radius / 6 / h]]]) {
          E.bindTarget(dst); gl.useProgram(prog.pr); E.bindTex(0, src, prog.u.uTex);
          gl.uniform2f(prog.u.uDir, dir[0], dir[1]); gl.uniform1f(prog.u.uGain, dst === b && i === passes - 1 ? gain : 1);
          E.drawQuad(); src = dst.tex;
        }
      }
      return b.tex;
    };
  }
  window.Post = { makeBlur };
})();
