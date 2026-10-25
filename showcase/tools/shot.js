// usage: node tools/shot.js out.png scene:5:2.0 frame:1234 ...   (w option: --w 960)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const items = process.argv.slice(2).filter((a, i, arr) => !a.startsWith('--') && !(i > 0 && arr[i - 1].startsWith('--'))); const outDir = path.resolve(items.shift());
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scale = +arg('scale', 1); const hud = arg('hud', '1');
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: Math.round(1920 * scale), height: Math.round(1080 * scale) } });
  p.on('pageerror', e => console.error('pageerror', e.message)); p.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + `?scale=${scale}&hud=${hud}`);
  await p.waitForFunction('window.__ready===true||window.__error', null, { timeout: 120000 });
  const err = await p.evaluate('window.__error'); if (err) { console.error('INIT ERROR', err); process.exit(1); }
  for (const it of items) {
    const [kind, a, c] = it.split(':'); const t0 = Date.now();
    if (kind === 'scene') await p.evaluate(([k, s]) => window.renderScene(k, s), [+a, +c]); else await p.evaluate(f => window.renderFrame(f), +a);
    const name = kind === 'scene' ? `scene${String(a).padStart(2, '0')}_${(+c).toFixed(2)}` : `frame${String(a).padStart(5, '0')}`;
    await p.screenshot({ path: path.join(outDir, name + '.png') });
    console.log(name, Date.now() - t0, 'ms');
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
