#!/usr/bin/env node
/* 桌宠探针：在真实浏览器里驱动引擎，输出数值或截图，用于定位问题（qa_pet.js 只判断过 / 不过）。
 * 依赖引擎暴露的 window.__pet（见 references/engine.md 第 9 节）。页面没有 <!doctype> 时自动补上。
 *
 * 子命令：
 *   jitter  <页面> [角色,...] [状态,...]   各稳定状态下锚点逐帧二阶差分的最大值，按管线分段（拟合 / 圆角守护 / 凸性守护 / 贴地）。
 *                                          守护后的值明显大于拟合值 ⇒ 守护在阈值附近来回跳，是「抽动」的来源。
 *   params  <页面> <角色> <状态> [毫秒]     逐帧打印姿态参数（rot、ext、m、d…）和状态名，确认「真的转了 / 依次升起了」。
 *   film    <页面> <角色> <状态> [帧数] [间隔ms] [输出目录]   连续截图（宿主元素），用 contact_sheet.py 拼成胶片。
 *   curv    <页面> [角色,...]               各状态轮廓曲率变号次数与最小曲率半径（外凸角色应为 0）。
 *   agent   <页面> [角色]                   跑一次脚本化 Agent 会话，打印状态序列。
 *
 * 例：node pet_probe.js jitter ip-pet/index.html orange,berry thinking,error
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [cmd, src, ...args] = process.argv.slice(2);
if (!cmd || !src) { console.error(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const html = fs.readFileSync(src, 'utf8');
  const tmp = path.join(path.dirname(path.resolve(src)), '.probe-' + path.basename(src));
  fs.writeFileSync(tmp, /^\s*<!doctype/i.test(html) ? html : '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html);
  const b = await chromium.launch(); const errs = [];
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto('file://' + tmp); await sleep(1200);
    await p.$eval('#stage', e => e.scrollIntoView({ block: 'center' }));
    const chars = (args[0] || '').split(',').filter(Boolean);
    const allChars = await p.evaluate(() => Object.keys(window.__pet.CHARS));

    if (cmd === 'jitter') {
      const states = (args[1] || 'idle,thinking,working-typing,error').split(',');
      for (const k of chars.length ? chars : allChars) for (const st of states) {
        const r = await p.evaluate(async ([k, st]) => {
          const P = window.__pet; P.debug = true; P.mount(k); await new Promise(r => setTimeout(r, 2800)); P.setState(st);
          const H = {}, W = { fit: 0, guard: 0, convex: 0, snap: 0, dy: 0 }; const dys = []; const t0 = performance.now();
          while (performance.now() - t0 < 1500) {
            await new Promise(r => requestAnimationFrame(r)); const s = P.pet._stages; if (!s) continue;
            for (const n of ['fit', 'guard', 'convex', 'snap']) {
              (H[n] = H[n] || []).push(s[n]); if (H[n].length > 3) H[n].shift();
              if (H[n].length === 3) { let m = 0; for (let i = 0; i < s[n].length; i++) { const a = H[n][0][i], b2 = H[n][1][i], c = H[n][2][i]; m = Math.max(m, Math.hypot(a[0] - 2 * b2[0] + c[0], a[1] - 2 * b2[1] + c[1])); } W[n] = Math.max(W[n], m); }
            }
            dys.push(s.dy); if (dys.length > 3) dys.shift(); if (dys.length === 3) W.dy = Math.max(W.dy, Math.abs(dys[0] - 2 * dys[1] + dys[2]));
          }
          P.debug = false; return W;
        }, [k, st]);
        console.log(`${k.padEnd(8)} ${st.padEnd(16)} ` + Object.entries(r).map(([a, v]) => `${a} ${v.toFixed(2)}`).join(' | '));
      }
    } else if (cmd === 'params') {
      const [k, st, ms = '2400'] = args;
      const rows = await p.evaluate(async ([k, st, ms]) => {
        const P = window.__pet; P.mount(k); if (st !== 'intro') { await new Promise(r => setTimeout(r, 2800)); P.setState(st); }
        const out = []; const t0 = performance.now(); let f = 0;
        while (performance.now() - t0 < ms) { await new Promise(r => requestAnimationFrame(r));
          if (f++ % 6) continue; const v = P.pet.vals();
          out.push(`${String(Math.round(performance.now() - t0)).padStart(5)}ms  ${P.state.padEnd(15)} ` + Object.entries(v).map(([n, x]) => `${n}=${Array.isArray(x) ? x.map(y => y.toFixed(2)).join('/') : x.toFixed(2)}`).join(' ') + `  y=${Math.round(P.phys.y)}`); }
        return out;
      }, [k, st, +ms]);
      rows.forEach(r => console.log(r));
    } else if (cmd === 'film') {
      const [k, st, n = '10', gap = '100', out = 'film-out'] = args; fs.mkdirSync(out, { recursive: true });
      await p.evaluate(k => window.__pet.mount(k), k); await sleep(st === 'intro' ? 0 : 2800);
      if (st !== 'intro') await p.evaluate(s => window.__pet.setState(s), st);
      const host = await p.$('#pet-host');
      for (let i = 0; i < +n; i++) { await host.screenshot({ path: path.join(out, `${k}-${st}-${String(i).padStart(2, '0')}.png`) }); await sleep(+gap); }
      console.log('frames ->', out);
    } else if (cmd === 'curv') {
      const states = ['intro', 'idle', 'thinking', 'working-typing', 'error', 'notification', 'happy', 'react-poke', 'idle-dozing', 'sleeping', 'wake'];
      for (const k of chars.length ? chars : allChars) {
        const res = [];
        for (const st of states) res.push(st + ' ' + await p.evaluate(async ([k, st]) => {
          const P = window.__pet; P.mount(k); if (st !== 'intro') { await new Promise(r => setTimeout(r, 2600)); P.setState(st); }
          let worst = 0, minR = 1e9; const t0 = performance.now();
          while (performance.now() - t0 < 1800) { await new Promise(r => requestAnimationFrame(r));
            const C = P.curvePts(P.pet.body, 16), n = C.length, ks = [];
            for (let i = 0; i < n; i++) { const a = C[(i - 1 + n) % n], b = C[i], c = C[(i + 1) % n], cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), l = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) * Math.hypot(c[0] - a[0], c[1] - a[1]); ks.push(2 * cr / l); }
            let sc = 0; for (let i = 0; i < n; i++) if (Math.sign(ks[i]) !== Math.sign(ks[(i + 1) % n])) sc++;
            worst = Math.max(worst, sc); minR = Math.min(minR, ...ks.map(x => 1 / Math.abs(x))); }
          return `变号${worst}/半径${minR.toFixed(1)}`;
        }, [k, st]));
        console.log(k + ': ' + res.join('  '));
      }
    } else if (cmd === 'agent') {
      const k = args[0] || allChars[0];
      const seq = await p.evaluate(async k => {
        const P = window.__pet; P.mount(k); await new Promise(r => setTimeout(r, 2800));
        document.getElementById('agent-run').click(); const out = []; let last = '';
        const t0 = performance.now(); while (performance.now() - t0 < 17000) { await new Promise(r => setTimeout(r, 100)); if (P.state !== last) { last = P.state; out.push(`${Math.round(performance.now() - t0)}ms ${last}`); } }
        return out;
      }, k);
      console.log(seq.join('\n'));
    } else { console.error('未知子命令', cmd); process.exitCode = 2; }
  } finally { await b.close(); fs.unlinkSync(tmp); }
  if (errs.length) { console.log('页面报错：', errs.join(' | ')); process.exitCode = 1; }
})();
