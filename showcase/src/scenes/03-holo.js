// 03 Holographic foil — three iridescent foil cards in perspective, thin-film hue, diffraction lines, glitter, sweeping glare
(() => { const E = Engine;
E.register(3, E.shaderScene({ hudDark: false, frag: `
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
float sdRBox(vec2 p, vec2 b, float r){ vec2 d = abs(p)-b+r; return length(max(d,0.))+min(max(d.x,d.y),0.)-r; }
float sdHex(vec2 p, float r){ const vec3 k = vec3(-.866025404,.5,.577350269); p = abs(p); p -= 2.*min(dot(k.xy,p),0.)*k.xy; p -= vec2(clamp(p.x,-k.z*r,k.z*r), r); return length(p)*sign(p.y); }
float sdStar(vec2 p, float r, float n, float m){
  float an = PI/n, en = PI/m; vec2 acs = vec2(cos(an),sin(an)), ecs = vec2(cos(en),sin(en));
  float bn = mod(atan(p.x,p.y), 2.*an) - an; p = length(p)*vec2(cos(bn), abs(sin(bn)));
  p -= r*acs; p += ecs*clamp(-dot(p,ecs), 0., r*acs.y/ecs.y); return length(p)*sign(p.x); }

// returns rgb + coverage in a ; card-local coords q in card units (height 1 = card height)
vec4 foil(vec2 q, vec3 N, float seed, float sweep){
  vec2 hs = vec2(.33,.46);
  float d = sdRBox(q, hs, .04);
  if (d > 0.) return vec4(0.);
  // normal perturbation from noise (brushed foil)
  float n1 = fbm(q*3.2 + seed*7.);
  float n2 = fbm(q*9. - seed*3.);
  float tilt = N.x*.9 + N.y*.6;
  float hue = .55 + seed*.23 + tilt*2.4 + n1*1.2 + q.x*.55 - q.y*.35;
  vec3 base = hsv2rgb(vec3(fract(hue), .62, .95));
  vec3 silver = vec3(.78,.82,.9) * (.65 + .35*sin(q.y*9.+tilt*6.));
  vec3 col = mix(silver, base, .78);
  // diffraction fine lines
  float ang = .6 + seed;
  float lines = .5 + .5*sin(dot(q, vec2(cos(ang),sin(ang)))*260. + hue*3. + n2*2.);
  col *= .93 + .14*lines;
  col += .07*hsv2rgb(vec3(fract(hue*1.7+lines*.2),.8,1.))*lines;
  // motif: concentric hex rings + star + frame
  float r = length(q - vec2(0.,.06));
  float rings = smoothstep(.012,.0,abs(fract(r*9.)-.5)*.11 - .0) * smoothstep(.34,.2,r);
  float hx = abs(sdHex((q-vec2(0.,.06))*rot(uS*.0+seed), .20)) ;
  float star = sdStar((q-vec2(0.,.06))*rot(seed*3.+tilt*1.5), .17, 5., 2.6+seed);
  float motif = smoothstep(.006,.0,abs(star)) + smoothstep(.005,.0,abs(hx-.02))*.8 + rings*.55;
  col = mix(col, vec3(1.), clamp(motif,0.,1.)*.75);
  col *= 1. - .25*smoothstep(.0,-.09,star)*step(star,0.);          // star filled slightly darker -> relief
  // frame
  float fr = abs(sdRBox(q, hs-vec2(.028), .02));
  col = mix(col, vec3(1.), smoothstep(.004,.0,fr)*.8);
  // text-like bars
  float bar = 0.;
  for (int i=0;i<3;i++){ float y = -.30 - float(i)*.04; float w = .22 - float(i)*.05; bar = max(bar, smoothstep(.006,.0,sdRBox(q-vec2(-.33+.06+w,y), vec2(w,.008), .008))); }
  col = mix(col, vec3(1.), bar*.85);
  // glitter
  vec2 gc = floor(q*95.); float hh = hash21(gc + floor(tilt*7.+seed*13.));
  float gl = smoothstep(.972,1.,hh) * (.6+.4*sin(uS*9.+hh*40.));
  col += gl*vec3(1.,.95,.9)*1.4;
  // sweeping glare
  float sw = dot(q, normalize(vec2(1.,.55))) - sweep;
  float glare = smoothstep(.07,.0,abs(sw)) + smoothstep(.02,.0,abs(sw-.11))*.6;
  col += glare*vec3(1.,.97,.92)*.8;
  // edge bevel
  float edge = smoothstep(-.012,.0,d);
  col = mix(col, vec3(1.), edge*.7);
  col = mix(col, col*.55, smoothstep(.0,-.2,d)*.0);
  return vec4(col, smoothstep(.0,-.003,d));
}
vec4 cardAt(vec2 p, vec3 C, mat3 R, float seed, float sweep){
  vec3 ro = vec3(0.,0.,-2.35); vec3 rd = normalize(vec3(p, 1.7));
  vec3 N = R*vec3(0.,0.,-1.);
  float den = dot(rd,N); if (abs(den)<1e-4) return vec4(0.);
  float t = dot(C-ro,N)/den; if (t<=0.) return vec4(0.);
  vec3 hit = ro + rd*t - C;
  vec3 loc = transpose(R)*hit;
  vec4 c = foil(loc.xy, N, seed, sweep);
  return vec4(c.rgb, c.a);
}
vec3 scene(vec2 fc){
  vec2 p = (fc - .5*uRes)/uRes.y;
  float s = uS;
  vec3 bg = mix(vec3(.02,.02,.07), vec3(.10,.07,.20), smoothstep(-.6,.7,p.y));
  // soft bokeh
  for (int i=0;i<14;i++){ float fi=float(i); vec2 c = vec2(hash11(fi*3.1)*2.-1., hash11(fi*5.7)*1.2-.6)*vec2(.95,.5); c.x += .05*sin(s*.4+fi); c.y += .04*cos(s*.5+fi*2.);
    float r = .05+.09*hash11(fi*2.3); bg += hsv2rgb(vec3(hash11(fi*9.1),.6,1.))*smoothstep(r,r*.6,length(p-c))*.07; }
  vec3 col = bg;
  float pulse = smoothstep(2.0,2.8,s)*(1.-smoothstep(3.2,4.0,s));
  float sw = mix(-.7, .8, fract(s*.42+.1)) ;
  // side cards (behind), then centre card
  mat3 RL = rotY(.5 + .25*sin(s*.9+1.)) * rotX(.12*sin(s*.7));
  mat3 RR = rotY(-.5 - .25*sin(s*.8+2.)) * rotX(-.1*sin(s*.6+1.));
  mat3 RC = rotY(.42*sin(s*1.1+.4) + 1.8*pulse*sin(s*3.)*.35) * rotX(.22*cos(s*.85));
  vec4 c;
  vec2 shadowP = p + vec2(.0,.05);
  c = cardAt(p, vec3(-.84,.0+.03*sin(s*1.3),.9), RL, .35, sw+.3); if (c.a>0.) col = mix(col, c.rgb*.9, c.a);
  c = cardAt(p, vec3(.84,.0+.03*cos(s*1.1),.9), RR, .75, sw-.2); if (c.a>0.) col = mix(col, c.rgb*.9, c.a);
  // contact glow under centre card
  col += vec3(.5,.3,1.)*exp(-length((p-vec2(0.,-.02))*vec2(1.2,.7))*3.2)*.12;
  c = cardAt(p, vec3(0.,.02*sin(s*1.6),.2), RC, .0, sw); if (c.a>0.) col = mix(col, c.rgb, c.a);
  return col;
}` }));
})();
