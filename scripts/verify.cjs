// 离线校验：在 headless Chromium 里用 OfflineAudioContext 渲染全部音效和循环并断言。
// 运行：NODE_PATH=/opt/node-tools/node_modules node scripts/verify.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.route('http://sfx.test/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    const file = path.join(root, p === '/' ? 'index.html' : p);
    if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ body: fs.readFileSync(file), contentType: MIME[path.extname(file)] || 'text/plain' });
  });
  await page.goto('http://sfx.test/');

  const results = await page.evaluate(async () => {
    const m = await import('/sfx/index.js');
    const stats = (buf) => {
      let peak = 0, sum = 0, sq = 0, nan = false;
      const d = buf.getChannelData(0), n = d.length;
      for (let i = 0; i < n; i++) { const v = d[i]; if (v !== v) nan = true; peak = Math.max(peak, Math.abs(v)); sum += v; sq += v * v; }
      const tailN = Math.floor(0.05 * buf.sampleRate);
      let tail = 0; for (let i = n - tailN; i < n; i++) tail = Math.max(tail, Math.abs(d[i]));
      return { peak, rms: Math.sqrt(sq / n), dc: Math.abs(sum / n), nan, tail, length: n, first: d[0], last: d[n - 1], sr: buf.sampleRate };
    };
    const out = [];
    const run = async (key, loop) => {
      const buf = await m.render(key);
      const again = await m.render(key);
      const a = buf.getChannelData(0), b = again.getChannelData(0);
      // 相同种子两次渲染的相对 RMS 误差；浏览器渲染有浮点抖动（实测 <1%），种子不同时误差会接近 100%
      let err = 0, ref = 0;
      for (let i = 0; i < a.length; i++) { err += (a[i] - b[i]) ** 2; ref += a[i] ** 2; }
      const same = Math.sqrt(err / ref) < 0.02;
      out.push({ key, loop, same, ...stats(buf) });
    };
    for (const n of m.SFX_NAMES) await run(n, false);
    for (const t of m.TRACKS) await run(t.id, t);
    return out;
  });

  let fail = 0;
  const check = (name, ok, msg) => { if (!ok) { fail++; console.log(`  FAIL ${name}: ${msg}`); } };
  for (const r of results) {
    const name = String(r.key);
    check(name, !r.nan, 'NaN');
    check(name, r.peak > 0.05 && r.peak <= 1.0, `peak ${r.peak.toFixed(3)}`);
    check(name, r.rms > 0.005, `rms ${r.rms.toFixed(4)}`);
    check(name, r.dc < 0.01, `dc ${r.dc.toFixed(4)}`);
    check(name, r.same, 'not reproducible');
    if (r.loop) {
      const exp = Math.round((r.loop.bars * 4 * 60 / r.loop.bpm) * r.sr);
      check(name, Math.abs(r.length - exp) <= 1, `length ${r.length} != ${exp}`);
      check(name, Math.abs(r.first - r.last) < 0.05, `seam ${r.first} vs ${r.last}`);
    } else {
      check(name, r.tail < 0.01, `tail ${r.tail.toFixed(4)}`);
    }
    console.log(`${name.padEnd(28)} peak ${r.peak.toFixed(2)} rms ${r.rms.toFixed(3)} len ${(r.length / r.sr).toFixed(2)}s`);
  }

  // 试听页：点击按钮不应有控制台报错
  const html = await browser.newPage();
  html.on('pageerror', (e) => errors.push(e.message));
  html.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await html.route('http://sfx.test/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    const file = path.join(root, p === '/' ? 'index.html' : p);
    route.fulfill({ body: fs.readFileSync(file), contentType: MIME[path.extname(file)] || 'text/plain' });
  });
  await html.goto('http://sfx.test/');
  await html.click('#sfx button >> nth=0');
  await html.click('#loops button >> nth=0');
  await html.waitForTimeout(4000);
  await html.click('#stop');
  check('page', errors.length === 0, errors.join('; '));

  await browser.close();
  console.log(fail ? `\n${fail} failure(s)` : '\nall passed');
  process.exit(fail ? 1 : 0);
})();
