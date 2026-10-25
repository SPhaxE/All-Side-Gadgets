#!/usr/bin/env python3
"""把 sfx/ 模块、WebAudioFont 播放器和乐器采样内联成单个 HTML，用于发布试听页。
用法：python3 scripts/build-page.py <输出路径>"""
import os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(root, *p), encoding='utf-8').read()

mods = []
for name in ['core', 'sounds', 'instruments', 'loops', 'index']:
    t = read('sfx', f'{name}.js')
    t = re.sub(r'^import .*;\n', '', t, flags=re.M)
    t = re.sub(r'^export \{.*\};\n', '', t, flags=re.M)
    t = re.sub(r'^export (?=\w)', '', t, flags=re.M)
    mods.append(t)
bundle = '\n'.join(mods)

inst_dir = os.path.join(root, 'sfx', 'vendor', 'instruments')
instruments = '\n'.join(
    '<script>\n' + open(os.path.join(inst_dir, f), encoding='utf-8').read() + '\n</script>'
    for f in sorted(os.listdir(inst_dir)))

html = read('scripts', 'page.template.html')
html = html.replace('/*PLAYER*/', read('sfx', 'vendor', 'WebAudioFontPlayer.js'))
html = html.replace('/*INSTRUMENTS*/', instruments)
html = html.replace('/*BUNDLE*/', bundle)
open(sys.argv[1], 'w', encoding='utf-8').write(html)
print(f'{sys.argv[1]}: {len(html) / 1e6:.1f} MB')
