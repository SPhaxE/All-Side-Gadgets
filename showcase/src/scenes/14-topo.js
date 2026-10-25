// STUB 14 topo
(() => { const E = Engine;
E.register(14, E.shaderScene({ w: 960, h: 540, frag: `
vec3 scene(vec2 fc){ vec2 uv = fc/uRes; return vec3(uv, .5+.5*sin(uS*2.+13.)) * .6 + .2; }` }));
})();
