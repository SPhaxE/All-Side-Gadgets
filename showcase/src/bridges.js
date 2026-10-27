// v2 bridges: one per boundary, built from the two effects' own material. Registered with Engine.bridge(type, def);
// boundaries without an entry here still use the v1 transitions (src/transitions.js) until they are rebuilt.
(() => { const E = Engine;

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
})();
