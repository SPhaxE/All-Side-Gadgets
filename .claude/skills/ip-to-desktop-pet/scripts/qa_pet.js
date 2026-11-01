#!/usr/bin/env node
/* 桌宠验收脚本（依赖引擎暴露的 window.__pet，见 references/engine.md 第 9 节）
 *
 * 用法：node qa_pet.js <页面.html> [截图输出目录]
 *  - 页面若没有 <!doctype>（Artifact 写法），脚本会在临时副本前补上，按标准模式测试；
 *  - 依赖预装的 playwright（require('playwright')）。
 *
 * 检查项（任一不过则退出码 1）：
 *  1. 控制台 / 页面零报错
 *  2. 所有身体关键形、五官拟合 G2（拼接点切向角差、曲率差 < 1e-6）
 *  3. 所有眼睛表情最低点 = 下眼睑（偏差 < 0.3）
 *  4. 遍历全部状态 + 拖拽 + 抛落：身体最小曲率半径 ≥ 5.9，五官 ≥ 1.3；五官始终在身体轮廓内
 *  5. 抛落逐帧：有中间高度、≥ 1 次回弹、出现压扁、最终 y = 0
 *  6. 375px 宽无横向滚动
 *  7. 4× CPU 降速下 rAF 中位数（仅报告）
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const [src, outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-qa-'))] = process.argv.slice(2);
if (!src) { console.error('用法：node qa_pet.js <页面.html> [截图输出目录]'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const html = fs.readFileSync(src, 'utf8');
  const tmp = path.join(path.dirname(path.resolve(src)), '.qa-' + path.basename(src));
  fs.writeFileSync(tmp, /^\s*<!doctype/i.test(html) ? html : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html);
  const url = 'file://' + tmp, fails = [], errs = [];
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(url); await sleep(1500);

    // 2 + 3：静态形状
    const st = await p.evaluate(() => {
      const P = window.__pet, out = { g2: 0, base: 0 };
      for (const ch of Object.values(P.CHARS)) {
        for (const f of Object.values(ch.fit)) { const g = P.g2(f); out.g2 = Math.max(out.g2, g.maxAngle, g.maxCurvDiff); }
        for (const e of ['open', 'wide', 'half', 'blink', 'closed', 'happy', 'wince', 'sad', 'angry']) for (const s of [-1, 1]) {
          const lo = Math.max(...P.curvePts(P.eyeFit(ch, e, s)).map(q => q[1])); out.base = Math.max(out.base, Math.abs(lo)); }
      }
      return out; });
    console.log('G2 最大偏差', st.g2.toExponential(2), '| 下眼睑最大偏差', st.base.toExponential(2));
    if (st.g2 > 1e-6) fails.push('G2'); if (st.base > .3) fails.push('下眼睑基线');

    // 4：运行时曲率与五官包含
    await p.evaluate(() => {
      const bsR = (a, b, c, e, t) => { const d1 = [0, 1].map(k => .5 * ((c[k] - a[k]) + 2 * t * (a[k] - 2 * b[k] + c[k]) + t * t * (-a[k] + 3 * b[k] - 3 * c[k] + e[k])));
        const d2 = [0, 1].map(k => (a[k] - 2 * b[k] + c[k]) + t * (-a[k] + 3 * b[k] - 3 * c[k] + e[k])); const cr = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]); return cr < 1e-9 ? Infinity : Math.hypot(...d1) ** 3 / cr; };
      const minR = P => { let r = Infinity; const n = P.length; for (let i = 0; i < n; i++) for (const t of [0, .25, .5, .75]) r = Math.min(r, bsR(P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n], t)); return r; };
      window.__qa = { body: Infinity, face: Infinity, outside: 0, where: '' };
      const tick = () => { const pet = window.__pet.pet, P = window.__pet;
        if (pet && pet.body && pet.lastFace) {
          const rb = minR(pet.body); if (rb < __qa.body) { __qa.body = rb; __qa.where = P.state + '/' + pet.ch.name; }
          for (const f of pet.lastFace) __qa.face = Math.min(__qa.face, minR(f));
          const poly = P.curvePts(pet.body, 8), inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
          for (const f of pet.lastFace) for (const q of P.curvePts(f, 3)) if (!inside(q[0], q[1])) __qa.outside++;
        }
        requestAnimationFrame(tick); };
      tick(); });
    await p.$eval('#stage', e => e.scrollIntoView({ block: 'center' })); await sleep(500);
    const host = await p.$('#pet-host');
    const states = await p.evaluate(() => Object.keys(window.__pet.CHARS));
    for (const k of states) {
      await p.evaluate(k => window.__pet.mount(k), k); await sleep(1300);
      await host.screenshot({ path: path.join(outDir, `${k}-idle.png`) });
      for (const s of ['idle', 'happy', 'react-poke', 'idle-yawn', 'idle-dozing', 'sleeping', 'wake', 'thinking', 'working-typing', 'error', 'notification', 'idle-look']) {
        await p.evaluate(s => window.__pet.setState(s), s); await sleep(s === 'sleeping' ? 1500 : 1200);
        await host.screenshot({ path: path.join(outDir, `${k}-${s}.png`) });
      }
      // 5：拖拽 + 抛落
      const hb = await host.boundingBox(), cx = hb.x + hb.width / 2, cy = hb.y + hb.height * .6;
      await p.mouse.move(cx, cy); await p.mouse.down();
      for (let i = 1; i <= 12; i++) { await p.mouse.move(cx + 18 * i, cy - 16 * i); await sleep(16); }
      await p.mouse.up();
      const tr = await p.evaluate(async () => { const s = [], t0 = performance.now(); while (performance.now() - t0 < 2000) { await new Promise(r => requestAnimationFrame(r)); s.push([Math.round(window.__pet.phys.y), window.__pet.pet.w.sq.x]); } return s; });
      const ys = tr.map(v => v[0]); let bounces = 0; for (let i = 1; i < ys.length - 1; i++) if (ys[i] === 0 && ys[i + 1] > 0) bounces++;
      const squash = Math.max(...tr.map(v => v[1]));
      console.log(`${k} 抛落：中间高度 ${new Set(ys).size} 种，回弹 ${bounces} 次，最大压扁权重 ${squash.toFixed(2)}，终点 y=${ys.at(-1)}`);
      if (new Set(ys).size < 10 || bounces < 1 || squash <= 0 || ys.at(-1) !== 0) fails.push(k + ' 抛落');
      await sleep(600);
    }
    const q = await p.evaluate(() => window.__qa);
    console.log(`最小曲率半径：身体 ${q.body.toFixed(2)}（${q.where}），五官 ${q.face.toFixed(2)}；五官出界采样 ${q.outside}`);
    if (q.body < 5.9) fails.push('身体尖角'); if (q.face < 1.3) fails.push('五官尖角'); if (q.outside) fails.push('五官出界');

    // 7：性能
    const cdp = await p.context().newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const perf = await p.evaluate(async () => { const d = []; let l = performance.now(); const t0 = l; while (performance.now() - t0 < 3000) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); d.push(n - l); l = n; } d.sort((a, b) => a - b); return [d[d.length >> 1], d[Math.floor(d.length * .95)]]; });
    console.log(`4× 降速 rAF：中位 ${perf[0].toFixed(1)}ms，p95 ${perf[1].toFixed(1)}ms`);

    // 6：手机宽度
    const m = await b.newPage({ viewport: { width: 375, height: 800 }, colorScheme: 'dark' }); m.on('pageerror', e => errs.push(String(e)));
    await m.goto(url); await sleep(1200);
    const sw = await m.evaluate(() => document.documentElement.scrollWidth); if (sw > 375) fails.push('375px 横向滚动');
    await m.screenshot({ path: path.join(outDir, 'mobile-dark.png'), fullPage: true });
  } finally { await b.close(); fs.unlinkSync(tmp); }
  if (errs.length) fails.push('报错：' + errs.join(' | '));
  console.log('截图目录', outDir);
  console.log(fails.length ? '未通过：' + fails.join('；') : '全部通过');
  process.exit(fails.length ? 1 : 0);
})();
