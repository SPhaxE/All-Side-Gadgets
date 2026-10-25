// STUB 7 clay
(() => { const E = Engine;
E.register(7, E.shaderScene({ w: 960, h: 540, frag: `
vec3 scene(vec2 fc){ vec2 uv = fc/uRes; return vec3(uv, .5+.5*sin(uS*2.+6.)) * .6 + .2; }` }));
})();
