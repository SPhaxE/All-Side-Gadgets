// STUB 11 particles
(() => { const E = Engine;
E.register(11, E.shaderScene({ w: 960, h: 540, frag: `
vec3 scene(vec2 fc){ vec2 uv = fc/uRes; return vec3(uv, .5+.5*sin(uS*2.+10.)) * .6 + .2; }` }));
})();
