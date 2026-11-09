// Concatenates src/*.js into dist/engine.js (usable from Node tests) and dist/index.html (the test page).
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const parts = ['src/ref-env.js', 'src/dsp.js', 'src/sfx.js', 'src/loops.js', 'src/loops_extra.js'].filter((p) => fs.existsSync(path.join(root, p)));
const engine = parts.map(read).join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const exportsLine = `\nif (typeof module !== 'undefined') module.exports = { SR, edgeScore, LOOP_TUNE, SFX_LAG, SFX, ${fs.existsSync(path.join(root, 'src/loops.js')) ? 'LOOPS, LOOPS_EXTRA,' : ''} peakOf };\n`;
fs.writeFileSync(path.join(root, 'dist/engine.js'), engine + exportsLine);
if (fs.existsSync(path.join(root, 'src/page.html'))) {
  const refEnv = fs.existsSync(path.join(root, 'src/ref-env.js')) ? read('src/ref-env.js') : '';
  const ui = fs.existsSync(path.join(root, 'src/ui.js')) ? read('src/ui.js') : '';
  const html = read('src/page.html').replace('/*ENGINE*/', () => engine).replace('/*REFENV*/', () => '').replace('/*UI*/', () => ui);
  fs.writeFileSync(path.join(root, 'dist/index.html'), html);
  fs.writeFileSync(path.join(root, 'dist/preview.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>');
}
console.log('built', parts.join(', '));
