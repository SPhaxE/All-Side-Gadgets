// Minimal static file server for the reel (same-origin, so the page can POST frames back).
const http = require('http'); const path = require('path'); const fs = require('fs');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.bin': 'application/octet-stream' };
// onPost(pathname, buffer) -> Promise; resolves when the body has been consumed
function createServer(root, onPost) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && onPost) {
      const chunks = []; let len = 0;
      req.on('data', c => { chunks.push(c); len += c.length; });
      req.on('end', async () => {
        try { await onPost(url.pathname, Buffer.concat(chunks, len)); res.writeHead(204); res.end(); }
        catch (e) { res.writeHead(500); res.end(String(e)); }
      });
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}
// Chrome flags that keep WebGL on the GPU and stop background throttling. mode: auto|d3d11|vulkan|gl|metal|swiftshader
function gpuArgs(mode = 'auto') {
  const a = ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization', '--enable-zero-copy', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-device-scale-factor=1'];
  if (mode === 'd3d11') a.push('--use-angle=d3d11');
  else if (mode === 'vulkan') a.push('--use-angle=vulkan', '--enable-features=Vulkan');
  else if (mode === 'gl') a.push('--use-angle=gl');
  else if (mode === 'metal') a.push('--use-angle=metal');
  else if (mode === 'swiftshader') a.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  return a;
}
module.exports = { createServer, gpuArgs };
