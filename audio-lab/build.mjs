// Concatenates src/*.js into dist/engine.js (usable from Node tests) and dist/index.html (the test page).
import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const parts = ['src/dsp.js', 'src/sfx.js', 'src/loops.js'].filter((p) => fs.existsSync(path.join(root, p)));
const engine = parts.map(read).join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const exportsLine = `\nif (typeof module !== 'undefined') module.exports = { SR, SFX, ${fs.existsSync(path.join(root, 'src/loops.js')) ? 'LOOPS,' : ''} peakOf };\n`;
fs.writeFileSync(path.join(root, 'dist/engine.js'), engine + exportsLine);
if (fs.existsSync(path.join(root, 'src/page.html'))) {
  const refEnv = fs.existsSync(path.join(root, 'src/ref-env.js')) ? read('src/ref-env.js') : '';
  const ui = fs.existsSync(path.join(root, 'src/ui.js')) ? read('src/ui.js') : '';
  const html = read('src/page.html').replace('/*ENGINE*/', () => engine).replace('/*REFENV*/', () => refEnv).replace('/*UI*/', () => ui);
  fs.writeFileSync(path.join(root, 'dist/index.html'), html);
}
console.log('built', parts.join(', '));
