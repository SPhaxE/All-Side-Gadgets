// 14 Topographic lines — fbm height field flowing, thin contours + bold index contours every 5th, hypsometric line colours, map frame overlay
(() => { const E = Engine;
E.register(14, E.postScene({
  hudDark: false,
  draw(c, s, w, h) {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(210,255,235,.55)'; c.fillStyle = 'rgba(210,255,235,.85)'; c.lineWidth = 2;
    const m = 44;                                         // frame
    c.strokeRect(m, m, w - 2 * m, h - 2 * m);
    for (let x = m; x <= w - m; x += 96) { const L = ((x - m) / 96) % 5 === 0 ? 22 : 11; c.beginPath(); c.moveTo(x, m); c.lineTo(x, m + L); c.moveTo(x, h - m); c.lineTo(x, h - m - L); c.stroke(); }
    for (let y = m; y <= h - m; y += 96) { const L = ((y - m) / 96) % 5 === 0 ? 22 : 11; c.beginPath(); c.moveTo(m, y); c.lineTo(m + L, y); c.moveTo(w - m, y); c.lineTo(w - m - L, y); c.stroke(); }
    c.font = '600 22px "JetBrains Mono",monospace'; c.textAlign = 'right';
    c.fillText('N 37°47′12″   W 122°25′08″', w - m - 14, m + 38);
    c.fillText('CONTOUR INTERVAL 20 M', w - m - 14, m + 66);
    c.textAlign = 'left'; c.fillText('SCALE 1:25 000', m + 14, h - m - 70);
    c.fillRect(m + 14, h - m - 52, 240, 5); for (let i = 0; i <= 4; i++) c.fillRect(m + 14 + i * 60, h - m - 60, 3, 18);
    // north arrow
    c.save(); c.translate(w - m - 60, h - m - 130); c.beginPath(); c.moveTo(0, -34); c.lineTo(14, 18); c.lineTo(0, 8); c.lineTo(-14, 18); c.closePath(); c.stroke(); c.textAlign = 'center'; c.fillText('N', 0, -42); c.restore();
    // crosshair follows a slow loop
    const cx = 960 + 300 * Math.cos(s * .35), cy = 520 + 170 * Math.sin(s * .5);
    c.beginPath(); c.arc(cx, cy, 26, 0, 7); c.moveTo(cx - 44, cy); c.lineTo(cx - 14, cy); c.moveTo(cx + 14, cy); c.lineTo(cx + 44, cy); c.moveTo(cx, cy - 44); c.lineTo(cx, cy - 14); c.moveTo(cx, cy + 14); c.lineTo(cx, cy + 44); c.stroke();
    c.textAlign = 'left'; c.fillText('ELEV ' + String(Math.round(840 + 420 * Math.sin(s * .9) + 80 * Math.cos(s * .31))) + ' M', cx + 54, cy - 30);
  },
  frag: `
float height(vec2 p, float s){
  vec2 q = p*1.25;
  vec2 w = vec2(fbm(q + vec2(s*.05, 3.1)), fbm(q + vec2(7.7, -s*.04)));
  float h = fbm(q*1.0 + w*1.4 + vec2(s*.03, 0.));
  float r = length(p);
  h += .20*exp(-pow((r-(s-2.4)*.8)*4.5,2.))*step(2.4,s);
  return h*.5 + .5;
}
vec3 ramp(float t){ // hypsometric: deep teal -> mint -> lime -> amber -> hot white
  vec3 a = vec3(.05,.55,.62), b = vec3(.35,.95,.70), c = vec3(.85,.98,.35), d = vec3(1.,.62,.18), e = vec3(1.,.93,.82);
  if (t < .28) return mix(a,b,t/.28); if (t < .55) return mix(b,c,(t-.28)/.27); if (t < .82) return mix(c,d,(t-.55)/.27); return mix(d,e,(t-.82)/.18);
}
vec3 scene(vec2 fc){
  vec2 p = (fc - .5*uRes)/uRes.y; float s = uS;
  float h = height(p, s);
  float N = 30.; float v = h*N;
  float fw = max(fwidth(v), 1e-4);
  float dist = abs(fract(v-.5)-.5)/fw;                  // pixels from nearest contour
  float idx = floor(v+.5); bool major = mod(idx,5.) < .5;
  float wd = major ? 2.4 : .9;
  float line = 1. - smoothstep(wd-.5, wd+.7, dist);
  vec3 bg = mix(vec3(.015,.05,.065), vec3(.03,.09,.11), h) ;
  vec3 tint = ramp(clamp((h-.18)*1.5,0.,1.));
  vec3 col = bg + tint*.06*h;
  col = mix(col, tint*(major?1.15:.85), line);
  // soft glow on index contours
  col += tint*smoothstep(7.,0.,dist)*(major?.14:.03);
  vec4 ov = texture(uTex, fc/uRes);
  col = mix(col, ov.rgb, ov.a);
  col *= 1. - .4*dot(p,p);
  return col;
}`,
}));
})();
