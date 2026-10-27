#!/usr/bin/env node
// GPU render pipeline: Chrome (hardware WebGL) renders each frame -> raw RGBA via readPixels ->
// POST to this process -> piped straight into ffmpeg (NVENC if available). No intermediate image files.
//
//   node tools/render-gpu.js                         full loop, 1080p60 -> out/reel_1080p60.mp4
//   node tools/render-gpu.js --scene 5               one effect incl. both transitions
//   node tools/render-gpu.js --check                 print which GPU/renderer Chrome is using, then exit
//   node tools/render-gpu.js --mb 4                  4-sample motion blur (4x render time)
//   node tools/render-gpu.js --out out/frames/%05d.png   PNG sequence instead of mp4
// Options: --fps 60 --scale 1 --from <frame> --to <frame> --encoder auto|nvenc|x264 --codec h264|hevc --cq 17
//          --gl auto|d3d11|vulkan|gl|metal|swiftshader --chrome (use installed Google Chrome) --headless --keep-open
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs'); const { spawn, spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const has = k => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..');
const fps = +arg('fps', 60), scale = +arg('scale', 1), mb = +arg('mb', 1), shutter = +arg('shutter', 0.5);
const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
const glMode = arg('gl', 'auto'), cq = arg('cq', '17'), codec = arg('codec', 'h264');
const sceneArg = arg('scene', null);
const outArg = arg('out', sceneArg ? `out/scene${String(sceneArg).padStart(2, '0')}_${H}p${fps}.mp4` : `out/reel_${H}p${fps}.mp4`);
const OUT = path.resolve(ROOT, outArg);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// ---------- static server + frame sink ----------
const { createServer, gpuArgs } = require('./lib-server');
let sink = null;               // (buffer) => Promise, set once ffmpeg is running
const server = createServer(ROOT, (p, buf) => p === '/frame' ? sink(buf) : Promise.reject(new Error('unknown ' + p)));

// ---------- encoder ----------
function nvencWorks() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-c:v', 'h264_nvenc', '-f', 'null', '-'], { stdio: 'ignore' });
  return r.status === 0;
}
function ffmpegArgs() {
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-'];
  const isImg = /%0?\d*d\.(png|jpg)$/i.test(OUT);
  if (isImg) return [...input, '-vf', 'vflip', OUT];
  const vf = ['-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'];
  const tags = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an'];
  let enc = arg('encoder', 'auto');
  if (enc === 'auto') enc = nvencWorks() ? 'nvenc' : 'x264';
  const gop = ['-g', String(fps), '-bf', '0'];
  let v;
  if (enc === 'nvenc') v = ['-c:v', codec === 'hevc' ? 'hevc_nvenc' : 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', cq, '-b:v', '0', '-maxrate', '120M', '-bufsize', '240M', '-spatial-aq', '1', '-temporal-aq', '1', ...(codec === 'hevc' ? ['-tag:v', 'hvc1'] : ['-profile:v', 'high'])];
  else v = ['-c:v', codec === 'hevc' ? 'libx265' : 'libx264', '-preset', 'slow', '-crf', String(Math.max(10, +cq - 1)), ...(codec === 'hevc' ? ['-tag:v', 'hvc1'] : ['-profile:v', 'high'])];
  console.log(`encoder: ${enc} (${v[1]})`);
  return [...input, ...vf, ...v, ...gop, ...tags, OUT];
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: has('headless'), channel: has('chrome') ? 'chrome' : undefined, args: gpuArgs(glMode) });
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1280), height: Math.min(H, 720) } });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?fps=${fps}&scale=${scale}&mb=${mb}&shutter=${shutter}`);
  await page.waitForFunction('window.__ready===true||window.__error', null, { timeout: 300000 });
  const err = await page.evaluate('window.__error'); if (err) { console.error('INIT ERROR', err); process.exit(1); }

  const info = await page.evaluate(() => {
    const gl = Engine.gl, dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), N: Engine.N, D: Engine.D, HT: Engine.HT, PHASE: Engine.PHASE, FPS: Engine.FPS, NS: Engine.NS };
  });
  const soft = /swiftshader|llvmpipe|software|basic render/i.test(info.renderer);
  console.log(`renderer: ${info.renderer}${soft ? '   <-- SOFTWARE rendering (no GPU)!' : ''}`);
  if (has('check')) { await browser.close(); server.close(); process.exit(soft ? 2 : 0); }
  if (soft && glMode !== 'swiftshader') console.warn('WARNING: Chrome is not using the GPU. Try --chrome, --gl d3d11 (Windows) / --gl vulkan (Linux), or drop --headless. Continuing anyway...');

  // frame range
  let from = +arg('from', 0), to = +arg('to', info.N);
  if (sceneArg) { const k = +sceneArg; from = Math.round(((k - 1) * info.D - info.PHASE - info.HT) * fps); to = from + Math.round((info.D + 2 * info.HT) * fps); }
  const total = to - from;

  const ff = spawn('ffmpeg', ffmpegArgs(), { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error('ffmpeg exited ' + code))));
  sink = buf => new Promise((res, rej) => {
    if (buf.length !== W * H * 4) return rej(new Error(`bad frame size ${buf.length}`));
    if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res);
  });

  console.log(`rendering frames ${from}..${to - 1} (${total} frames, ${(total / fps).toFixed(1)}s) at ${W}x${H}@${fps}${mb > 1 ? ` with ${mb}x motion blur` : ''} -> ${path.relative(process.cwd(), OUT)}`);
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const f = from + i;
    await page.evaluate(async f => {
      await window.renderFrame(f);
      const px = window.readFrame();
      const r = await fetch('/frame', { method: 'POST', body: px });
      if (!r.ok) throw new Error('sink: ' + await r.text());
    }, f);
    if ((i + 1) % fps === 0 || i + 1 === total) {
      const el = (Date.now() - t0) / 1000, rate = (i + 1) / el;
      process.stdout.write(`\r  ${i + 1}/${total}  ${rate.toFixed(1)} fps  elapsed ${el.toFixed(0)}s  eta ${((total - i - 1) / rate).toFixed(0)}s   `);
    }
  }
  ff.stdin.end(); await ffDone;
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${OUT}`);
  if (!has('keep-open')) await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
