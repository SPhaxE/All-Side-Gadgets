// 14 Topographic lines (v2) — a low flight over a 3D terrain: glowing orange plateaus with fine white contour lines,
// dark valleys traced by electric-blue contours, depth haze. The terrain breathes at the climax while a pulse of light
// runs out along the contours; finally the camera rises to look straight down (scene 15 blurs it into glass bokeh).
(() => { const E = Engine;
E.register(14, E.shaderScene({ scaled: true, hudDark: false, frag: `
float B;   // breathing
float terr(vec2 p){
  float f = fbm(p*.42 + vec2(3.1, 7.7));
  float plateau = smoothstep(.02, .22, f);                                  // high mesas
  float h = plateau*.55 + f*.35 + .06*fbm(p*1.7);
  return h*B;
}
vec3 scene(vec2 fc){
  float s = uS;
  vec2 q = (fc - .5*uRes)/uRes.y;
  B = 1. + .35*sin(PI*clamp((s-3.2)/.9, 0., 1.));
  float up = ease((s - 4.4)/1.6);                                           // rise to top-down at the end
  vec3 ro = vec3(.4*sin(s*.25), mix(1.12, 4.2, up) + (B - 1.)*1.1, s*.9);
  float yaw = .25*sin(s*.3);
  vec3 fw = normalize(mix(vec3(sin(yaw), -.42, cos(yaw)), vec3(0., -1., .0001), up));
  vec3 rt = normalize(cross(vec3(0.,1.,0.)*(1.-up) + vec3(0.,0.,1.)*up, fw)); vec3 uu = cross(fw, rt);
  vec3 rd = normalize(fw*1.35 + rt*q.x + uu*q.y);
  // march the height field
  float t = .05; float h = 0.; vec3 p = ro; bool hit = false;
  for (int i=0;i<160;i++){ p = ro + rd*t; h = terr(p.xz); float dd = p.y - h; if (dd < .002*t) { hit = true; break; } t += max(dd*.45, .004); if (t > 18.) break; }
  vec3 sky = mix(vec3(.01,.012,.03), vec3(.05,.03,.08), clamp(q.y*2.+.5,0.,1.));
  if (!hit) return sky;
  // refine
  float t0 = t - .01; for (int i=0;i<6;i++){ float tm = (t0 + t)*.5; vec3 pm = ro + rd*tm; if (pm.y - terr(pm.xz) < 0.) t = tm; else t0 = tm; }
  p = ro + rd*t; h = terr(p.xz);
  vec2 e = vec2(.004, 0.);
  vec3 n = normalize(vec3(terr(p.xz - e.xy) - terr(p.xz + e.xy), 2.*e.x, terr(p.xz - e.yx) - terr(p.xz + e.yx)));
  float hn = h/B;                                                            // normalised height
  float plateau = smoothstep(.28, .42, hn);
  // base colours: hot orange mesas, near-black valleys
  vec3 L = normalize(vec3(-.4, .8, .3));
  float dif = clamp(dot(n, L)*.6 + .4, 0., 1.);
  vec3 mesa = mix(vec3(.75,.22,.04), vec3(1.,.62,.12), smoothstep(.35,.75,hn))*(.55 + .6*dif);
  vec3 low = vec3(.012,.015,.03)*(.6 + .4*dif);
  vec3 col = mix(low, mesa, plateau);
  // contour lines
  float N = 36.; float v = hn*N; float fw2 = fwidth(v)*1.2 + 1e-4;
  float line = 1. - smoothstep(.0, fw2*1.6, abs(fract(v) - .5)*2. - 1. + fw2*1.6);
  float lv = abs(fract(v-.5)-.5)/fw2; float l1 = 1. - smoothstep(.6, 1.6, lv);
  float major = step(mod(floor(v+.5), 5.), .5);
  vec3 lineCol = mix(vec3(.25,.6,1.)*1.6, vec3(1.,.95,.88), plateau);
  // a pulse of light travelling outward along the contours at the climax
  float pulse = .45*exp(-pow((hn*N - (s - 3.2)*22.) * .12, 2.)) * step(3.2, s) * (1. - step(4.6, s));
  col += lineCol*l1*(.55 + .45*major + 2.5*pulse);
  col += vec3(.2,.5,1.)*exp(-lv*.35)*(1.-plateau)*.18;                      // blue glow around valley lines
  // haze + depth of field feel
  float fog = 1. - exp(-t*t*.008);
  col = mix(col, sky + vec3(.06,.03,.05), fog);
  col *= 1. - .25*dot(q,q);
  return col/(1.+col*.15);
}` }));
})();
