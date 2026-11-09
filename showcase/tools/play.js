#!/usr/bin/env node
// Realtime preview on the GPU: opens a Chrome window playing the reel at the chosen fps.
//   node tools/play.js [--fps 60] [--mb 1] [--gl auto|d3d11|vulkan|gl|metal] [--chrome]
// Keys: space pause · ←/→ previous/next effect · ,/. step one frame · F fullscreen
const { chromium } = require('playwright'); const path = require('path');
const { createServer, gpuArgs } = require('./lib-server');
const argv = process.argv.slice(2), has = k => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const server = createServer(path.resolve(__dirname, '..'));
server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/index.html?play&fps=${arg('fps', 60)}&mb=${arg('mb', 1)}`;
  console.log('playing:', url, '\n(close the window or press Ctrl+C to quit)');
  const browser = await chromium.launch({ headless: false, channel: has('chrome') ? 'chrome' : undefined, args: [...gpuArgs(arg('gl', 'auto')), '--start-maximized'] });
  const page = await browser.newPage({ viewport: null });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.goto(url);
  browser.on('disconnected', () => process.exit(0));
});
