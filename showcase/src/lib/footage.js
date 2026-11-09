// Footage frames (pre-extracted by tools/build-assets.js) as WebGL textures, loaded on demand with an LRU cache.
// Footage(urlPattern, count, {nearest, cache}) -> { count, async tex(i) }   urlPattern like 'assets/build/horse/fs/%03d.png' (1-based files)
(() => {
  const E = Engine, gl = E.gl;
  window.Footage = function (pattern, count, opts = {}) {
    const cap = opts.cache || 24, cache = new Map(), pool = [];
    const url = i => pattern.replace(/%0(\d)d/, (_, n) => String(i + 1).padStart(+n, '0'));
    async function load(i) {
      const blob = await (await fetch(url(i))).blob();
      const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
      const tex = pool.pop() || E.makeTex(bmp.width, bmp.height, { nearest: !!opts.nearest });
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      bmp.close();
      return tex;
    }
    return {
      count,
      async tex(i) {
        i = Math.max(0, Math.min(count - 1, i | 0));
        if (cache.has(i)) { const t = cache.get(i); cache.delete(i); cache.set(i, t); return t; }
        const t = await load(i); cache.set(i, t);
        if (cache.size > cap) { const [k, old] = cache.entries().next().value; cache.delete(k); pool.push(old); }
        return t;
      },
    };
  };
  window.loadJSON = async u => (await fetch(u)).json();
})();
