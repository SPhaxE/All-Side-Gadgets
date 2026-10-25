// One themed transition per scene boundary. type = index of outgoing scene (0-based). p already eased.
window.TRANSITION_GLSL = `
const float ASPECT = 16./9.;
float bayer4(vec2 p){ int x = int(mod(p.x,4.)), y = int(mod(p.y,4.)); int i = x + y*4;
  int m[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5); return (float(m[i])+.5)/16.; }
vec3 blur3(sampler2D t, vec2 uv, vec2 dir, int n){ vec3 s = vec3(0.); for(int i=0;i<n;i++){ float k = float(i)/float(n-1)-.5; s += texture(t, uv + dir*k).rgb; } return s/float(n); }

vec3 transition(int type, vec2 uv, float p){
  vec2 fc = uv*uRes;
  vec2 q = (uv-.5)*vec2(ASPECT,1.);
  if (type == 0){ // liquid -> ASCII : mosaic
    float cols = mix(240., 20., sin(p*PI)); vec2 cell = vec2(cols, cols/ASPECT);
    vec2 u2 = (floor(uv*cell)+.5)/cell;
    float wob = vnoise(u2*8.+p*6.);
    return p+ (wob-.5)*.3 < .5 ? A(u2) : B(u2);
  }
  if (type == 1){ // ASCII -> holo : scan wipe with rainbow edge
    float e = p*1.3-.15; float d = uv.y - e; float w = .07;
    vec3 rb = hsv2rgb(vec3(uv.x*1.5+p*2.,.85,1.));
    vec3 base = d < 0. ? B(uv) : A(uv);
    float band = smoothstep(w,0.,abs(d));
    return mix(base, rb, band*.9) + band*.35;
  }
  if (type == 2){ // holo -> bauhaus : sliding strips
    float n = 14.; float i = floor(uv.x*n); float del = hash11(i)*.45;
    float k = ease((p-del)/.55);
    vec2 ua = uv + vec2(0., k); vec2 ub = uv - vec2(0., 1.-k);
    return uv.y + k >= 1. ? B(vec2(uv.x, uv.y + k - 1.)) : A(vec2(uv.x, uv.y + k));
  }
  if (type == 3){ // bauhaus -> neon : iris with glow ring
    float r = length(q); float R = p*1.15; float d = r - R;
    vec3 base = d < 0. ? B(uv) : A(uv);
    float ring = smoothstep(.03,0.,abs(d));
    return base + vec3(1.,.2,.8)*ring*1.4 + vec3(.2,.6,1.)*smoothstep(.12,0.,abs(d))*.35;
  }
  if (type == 4){ // neon -> dither : bloom flash + bayer threshold
    float flash = sin(p*PI);
    vec3 a = A(uv), b = B(uv);
    vec3 c = bayer4(fc/2.) < p ? b : a;
    return c + flash*.35*vec3(1.,.5,.9);
  }
  if (type == 5){ // dither -> clay : noisy dither dissolve
    float n = fbm(uv*vec2(ASPECT,1.)*4.)*.5+.5;
    float th = p*1.4 - .2;
    float m = th - n*.9 + bayer4(fc/3.)*.25;
    return m > 0. ? B(uv) : A(uv);
  }
  if (type == 6){ // clay -> halftone : growing dots
    float cells = 56.; vec2 g = uv*vec2(cells*ASPECT, cells);
    g = rot(.4)*g; vec2 f = fract(g)-.5; float r = length(f);
    float maxR = .75; float rad = p*maxR*1.5 + (1.-uv.x)*0.0;
    float edge = smoothstep(rad-.02, rad+.02, r);
    return mix(B(uv), A(uv), edge);
  }
  if (type == 7){ // halftone -> kinetic : clock wipe
    float a = atan(q.x, q.y); a = (a+PI)/TAU; // 0..1
    float th = p*1.08;
    float d = th - a;
    vec3 base = d>0. ? B(uv) : A(uv);
    return base + vec3(1.)*smoothstep(.015,0.,abs(d))*.6;
  }
  if (type == 8){ // kinetic -> pixel : pixelate out/in
    float s = sin(p*PI); float px = mix(1080., 14., pow(s,.6)); vec2 cell = vec2(px*ASPECT, px);
    vec2 u2 = (floor(uv*cell)+.5)/cell; if (s<.02) u2 = uv;
    return p < .5 ? A(u2) : B(u2);
  }
  if (type == 9){ // pixel -> particle : random block dissolve
    float bs = 48.; vec2 cell = floor(fc/bs); float h = hash21(cell);
    float m = smoothstep(h-.08,h+.02,p*1.1);
    vec2 jitter = (hash22(cell)-.5)*.02*sin(p*PI);
    return mix(A(uv), B(uv+jitter), step(h*.9,p*1.0));
  }
  if (type == 10){ // particle -> riso : ink bleed
    float n = fbm(uv*vec2(ASPECT,1.)*3.5+3.1)*.5+.5;
    float th = p*1.3-.15; float d = th - n;
    vec3 ink = vec3(1.,.28,.55);
    vec3 base = d>0. ? B(uv) : A(uv);
    float edge = smoothstep(.08,0.,abs(d));
    return mix(base, ink, edge*.85);
  }
  if (type == 11){ // riso -> glitch : sliced displacement
    float band = floor(uv.y*28.); float h = hash21(vec2(band, floor(p*10.)));
    float amt = sin(p*PI)*.25*(h-.5);
    vec2 u2 = vec2(fract(uv.x+amt), uv.y);
    bool useB = h < p*1.2 - .1;
    vec3 c = useB ? B(u2) : A(u2);
    float sp = sin(p*PI)*.012;
    c.r = useB ? B(u2+vec2(sp,0.)).r : A(u2+vec2(sp,0.)).r; c.b = useB ? B(u2-vec2(sp,0.)).b : A(u2-vec2(sp,0.)).b;
    return c;
  }
  if (type == 12){ // glitch -> topo : rgb split wipe
    float e = p*1.2-.1 + (hash11(floor(uv.y*60.)+floor(p*14.))-.5)*.06;
    float d = uv.x - e; float sp = .02*sin(p*PI)+.004;
    vec3 a = vec3(A(uv+vec2(sp,0.)).r, A(uv).g, A(uv-vec2(sp,0.)).b);
    vec3 b = vec3(B(uv+vec2(sp,0.)).r, B(uv).g, B(uv-vec2(sp,0.)).b);
    return d < 0. ? b : a;
  }
  if (type == 13){ // topo -> glass : ripple wipe
    float r = length(q); float R = p*1.3; float d = r-R;
    vec2 dir = normalize(q+1e-5); float w = sin(d*40.)*exp(-abs(d)*8.)*.02;
    vec2 u2 = uv + dir*w*vec2(1./ASPECT,1.);
    vec3 base = d<0. ? B(u2) : A(u2);
    return base + smoothstep(.02,0.,abs(d))*.25;
  }
  if (type == 14){ // glass -> paper : torn edge
    float n = fbm(vec2(uv.y*9., 4.2))*.14 + vnoise(vec2(uv.y*60.,1.))*.012;
    float e = p*1.25-.12 + n; float d = uv.x - e;
    vec3 paper = vec3(.96,.94,.9);
    vec3 base = d<0. ? B(uv) : A(uv);
    float strip = smoothstep(.0,.004,d+.02)*(1.-smoothstep(.0,.004,d));
    float sh = smoothstep(.04,0.,d) * step(0.,d);
    base *= 1.-.35*sh;
    return mix(base, paper, strip);
  }
  if (type == 15){ // paper -> vapor : venetian blinds
    float n = 12.; float f = fract(uv.y*n); float k = p*1.4 - .2 + hash11(floor(uv.y*n))*.0;
    return f < clamp(k*1.1,0.,1.) ? B(uv) : A(uv);
  }
  if (type == 16){ // vapor -> flow : warp zoom
    float s = sin(p*PI);
    vec2 c = vec2(.5,.62); vec2 d = uv-c; float z = s*.35;
    vec3 a = vec3(0.), b = vec3(0.);
    for(int i=0;i<10;i++){ float k = float(i)/9.; vec2 u2 = c + d*(1.-z*k);
      a += A(u2); b += B(u2); }
    a/=10.; b/=10.;
    return mix(a,b,smoothstep(.35,.65,p)) + s*.12;
  }
  if (type == 17){ // flow -> metaballs : warped dissolve
    float s = sin(p*PI);
    vec2 w = vec2(fbm(uv*3.+vec2(0.,uT*.0)), fbm(uv*3.+7.3))*.12*s;
    float n = fbm(uv*vec2(ASPECT,1.)*2.5)*.5+.5;
    float m = smoothstep(-.1,.1, p*1.4-.2 - n);
    return mix(A(uv+w), B(uv-w), m);
  }
  if (type == 18){ // metaballs -> fractal : zoom-through
    float s = ease(p);
    vec2 d = uv-.5;
    vec3 a = blur3(uA, .5+d*(1.+p*2.2), d*p*.25, 8);
    float zb = mix(.45,1.,s);
    vec3 b = blur3(uB, .5+d*zb, d*(1.-p)*.2, 8);
    return mix(a,b,smoothstep(.35,.7,p)) + sin(p*PI)*.1;
  }
  // 19: fractal -> liquid : liquid warp wipe
  {
    float s = sin(p*PI);
    float n = fbm(vec2(uv.y*3., p*2.))*.25;
    float e = p*1.5 - .25 + n + sin(uv.y*9.+p*8.)*.05;
    float d = e - uv.x;
    vec2 w = vec2(sin(uv.y*18.+p*10.), cos(uv.x*14.-p*9.))*.02*s;
    vec3 base = d>0. ? B(uv+w) : A(uv+w);
    return base + smoothstep(.03,0.,abs(d))*.4;
  }
}
`;
