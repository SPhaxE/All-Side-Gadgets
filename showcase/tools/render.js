// Deterministic frame renderer: drives showcase/index.html via window.renderFrame(frameIndex)
// usage: node tools/render.js --from 0 --to 2700 --out frames [--workers 4] [--fmt png|jpg]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const from = +arg('from', 0), to = +arg('to', 1), out = path.resolve(arg('out', 'frames'));
const workers = +arg('workers', 4), fmt = arg('fmt', 'jpg'), query = arg('query', '');
const resume = process.argv.includes('--resume');
const scale = +arg('scale', 1);
const W = Math.round(1920 * scale), H = Math.round(1080 * scale);
const seq = process.argv.includes('--seq');   // name files by (frame - from) so wrapped ranges stay contiguous
if (!resume) fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync', '--force-device-scale-factor=1'];

async function worker(id, frames) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.error(`[w${id}] pageerror`, e.message));
  page.on('console', m => { if (m.type() === 'error') console.error(`[w${id}]`, m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html') + `?scale=${scale}` + (query ? '&' + query : ''));
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  let n = 0; const t0 = Date.now();
  for (const f of frames) {
    const file = path.join(out, `f${String(seq ? f - from : f).padStart(5, '0')}.${fmt}`);
    if (resume && fs.existsSync(file)) continue;
    await page.evaluate(i => window.renderFrame(i), f);
    await page.screenshot(fmt === 'png' ? { path: file, type: 'png' } : { path: file, type: 'jpeg', quality: 96 });
    if (++n % 25 === 0) console.log(`[w${id}] ${n}/${frames.length}  ${((Date.now() - t0) / n).toFixed(0)}ms/frame`);
  }
  await browser.close();
}

(async () => {
  // interleave frames across workers so slow scenes spread evenly
  const buckets = Array.from({ length: workers }, () => []);
  for (let f = from; f < to; f++) buckets[(f - from) % workers].push(f);
  await Promise.all(buckets.map((b, i) => worker(i, b)));
  console.log('done', from, to);
})().catch(e => { console.error(e); process.exit(1); });
