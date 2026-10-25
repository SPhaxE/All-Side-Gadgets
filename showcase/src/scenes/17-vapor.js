// 17 Vaporwave grid — striped sunset, neon-outlined mountains, endless perspective grid, chrome katakana title, palms, VHS scanlines
(() => { const E = Engine;
E.register(17, E.postScene({
  hudDark: false,
  draw(c, s, w, h) {
    c.clearRect(0, 0, w, h);
    const pulse = Math.max(0, Math.min(1, (s - 2.2) / .5)) * (1 - Math.max(0, Math.min(1, (s - 3.2) / .7)));
    const ty = 285 + 12 * Math.sin(s * 1.5);
    // chrome title
    c.save(); c.translate(960, ty); c.scale(1 + .03 * pulse, 1 + .03 * pulse); c.transform(1, 0, -.18, 1, 0, 0);
    c.font = '900 168px "Inter","Inter Display",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const txt = 'ＶＡＰＯＲＷＡＶＥ'; c.font = '900 150px "IPAGothic","Inter",sans-serif';
    const g = c.createLinearGradient(0, -90, 0, 90); g.addColorStop(0, '#ffffff'); g.addColorStop(.46, '#9fe9ff'); g.addColorStop(.5, '#2a1050'); g.addColorStop(.58, '#ff7ad9'); g.addColorStop(1, '#ffe6fb');
    c.lineWidth = 14; c.strokeStyle = '#2a0a55'; c.strokeText(txt, 4, 8); c.lineWidth = 6; c.strokeStyle = '#00f0ff'; c.shadowColor = '#00f0ff'; c.shadowBlur = 28; c.strokeText(txt, -3, -2);
    c.shadowBlur = 0; c.fillStyle = g; c.fillText(txt, 0, 0);
    c.restore();
    c.save(); c.translate(960, ty + 118); c.font = '700 56px "IPAGothic","WenQuanYi Zen Hei",sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff9bf0'; c.shadowColor = '#ff2bd6'; c.shadowBlur = 20;
    c.lineWidth = 8; c.strokeStyle = '#1a0538'; c.strokeText('ヴェイパーウェイヴ  ·  夕暮れのグリッド', 0, 0); c.fillText('ヴェイパーウェイヴ  ·  夕暮れのグリッド', 0, 0); c.restore();
    // palms
    const palm = (x, y, sc, flip) => {
      c.save(); c.translate(x, y); c.scale(flip * sc, sc); c.fillStyle = '#12032b'; c.strokeStyle = '#ff2bd6'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-26, -200, 6, -420); c.lineTo(22, -420); c.quadraticCurveTo(-4, -200, 16, 0); c.closePath(); c.fill();
      for (let i = 0; i < 8; i++) { const a = -Math.PI * .5 + (i - 3.5) * .42 + Math.sin(s * 1.3 + i) * .04; c.save(); c.translate(14, -420); c.rotate(a);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(110, -60, 230, 50); c.quadraticCurveTo(120, -20, 0, 10); c.closePath(); c.fill(); c.stroke(); c.restore(); }
      c.restore();
    };
    palm(150, 1040, 1.15, 1); palm(1790, 1040, 1.0, -1); palm(300, 1040, .62, 1);
    // sparkles
    for (let i = 0; i < 14; i++) { const x = 100 + ((i * 421) % 1700), y = 120 + ((i * 197) % 360); const t = .5 + .5 * Math.sin(s * 3 + i * 2); c.fillStyle = `rgba(255,255,255,${t * .9})`; c.fillRect(x - 1, y - 12 * t, 2, 24 * t); c.fillRect(x - 12 * t, y - 1, 24 * t, 2); }
  },
  frag: `
float hash1(float x){ return fract(sin(x*127.1)*43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(hash1(i), hash1(i+1.), f); }
vec3 scene(vec2 fc){
  vec2 p = (fc - .5*uRes)/uRes.y; float s = uS;
  float y0 = -.04;
  vec3 col;
  float pulse = smoothstep(2.2,2.7,s)*(1.-smoothstep(3.2,3.9,s));
  if (p.y > y0){
    float t = (p.y - y0)/(.5-y0);
    col = mix(vec3(.98,.28,.55), vec3(.09,.02,.26), pow(clamp(t,0.,1.),.55));
    col = mix(col, vec3(1.,.62,.28), exp(-(p.y-y0)*9.)*.55);
    // stars
    vec2 sg = floor(p*vec2(1.78,1.)*95.); float hh = hash21(sg); col += step(.992,hh)*smoothstep(.1,.5,t)*(.5+.5*sin(s*3.+hh*50.));
    // sun
    vec2 sc = vec2(0., y0+.17); float R = .27 + .015*pulse;
    vec2 d = p - sc; float r = length(d);
    if (r < R){
      float yn = (p.y - (sc.y-R))/(2.*R);
      float stripe = fract(yn*14. - s*.05); float gap = (1.-yn)*(.85) - .05;   // thicker gaps toward the bottom
      float on = step(gap, stripe) ;
      if (yn > .55) on = 1.;
      vec3 sunc = mix(vec3(1.,.25,.55), vec3(1.,.9,.25), smoothstep(.0,1.,yn));
      col = mix(col, sunc, on*smoothstep(R,R-.004,r));
    }
    col += vec3(1.,.3,.6)*exp(-max(r-R,0.)*10.)*.25;
    // mountains
    float mx = p.x*2.4 + 40.;
    float mh = y0 + .015 + .13*(1.-abs(2.*n1(mx)-1.))*(.55+.45*n1(mx*.31+7.));
    float mfill = smoothstep(.002,-.002,p.y-mh);
    col = mix(col, vec3(.06,.01,.16), mfill);
    float mline = smoothstep(.0035,.0,abs(p.y-mh));
    col += vec3(.1,.95,1.)*mline*(.8+.4*pulse);
    // horizontal glow band
    col += vec3(1.,.3,.7)*exp(-abs(p.y-y0)*40.)*.5;
  } else {
    float dy = y0 - p.y;
    float gz = 1./dy + s*2.4;
    float gx = p.x/dy;
    float lw = .045;
    float lx = abs(fract(gx*1.15)-.5); float lz = abs(fract(gz*.55)-.5);
    float fx = fwidth(gx*1.15), fz = fwidth(gz*.55);
    float line = max(1.-smoothstep(0.,max(fx*1.4,.012),lx), 1.-smoothstep(0.,max(fz*1.4,.012),lz));
    float fade = smoothstep(0.,.14,dy);
    vec3 base = mix(vec3(.30,.04,.42), vec3(.05,.0,.12), smoothstep(0.,.5,dy));
    vec3 lc = mix(vec3(1.,.15,.85), vec3(.2,.95,1.), smoothstep(.0,.8,abs(p.x)));
    col = base + lc*line*fade*1.35 + lc*line*fade*.25*pulse;
    col += vec3(1.,.3,.7)*exp(-dy*14.)*.35;
  }
  vec2 uvv = fc/uRes;
  // chromatic overlay with a drifting VHS tracking band
  float band = smoothstep(.04,.0,abs(fract(uvv.y*.9 - s*.12)-.5)-.45)*.0;
  vec2 off = vec2(2.5,0.)/uRes;
  vec4 ov = vec4(texture(uTex, uvv+off).r, texture(uTex, uvv).g, texture(uTex, uvv-off).b, texture(uTex, uvv).a);
  col = mix(col, ov.rgb, ov.a);
  col += ov.rgb*ov.a*0.0;
  col *= .9 + .1*sin(fc.y*3.14159);
  col += (hash21(fc+floor(s*30.))-.5)*.05;
  col *= 1. - .35*dot(p,p);
  return col;
}`,
}));
})();
