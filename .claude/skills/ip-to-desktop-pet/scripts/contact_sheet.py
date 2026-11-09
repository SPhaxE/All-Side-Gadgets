#!/usr/bin/env python3
"""把多张截图拼成一张对照图，供读图验收。

用法：
  python3 -I contact_sheet.py out.png a.png b.png c.png ... [--cols 8] [--cell 140]
      拼成网格（胶片、状态网格、剪影并排）。
  python3 -I contact_sheet.py out.png --overlay 原图.jpg 复刻.png [--size 400x360]
      三联：原图 | 复刻 | 50% 混合（复刻对照用；两张图需是同一取景框）。
"""
import argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('images', nargs='*')
ap.add_argument('--cols', type=int, default=8); ap.add_argument('--cell', type=int, default=140)
ap.add_argument('--overlay', nargs=2, metavar=('REF', 'MINE')); ap.add_argument('--size', default='400x360')
a = ap.parse_args()

if a.overlay:
    w, h = map(int, a.size.split('x'))
    ref, mine = (Image.open(f).convert('RGB').resize((w, h)) for f in a.overlay)
    o = Image.new('RGB', (w * 3, h), 'white')
    for i, im in enumerate((ref, mine, Image.blend(ref, mine, .5))):
        o.paste(im, (i * w, 0))
else:
    if not a.images:
        ap.error('需要至少一张图，或使用 --overlay')
    c = a.cell; cols = min(a.cols, len(a.images)); rows = -(-len(a.images) // cols)
    o = Image.new('RGB', (cols * c, rows * c), 'white')
    for i, f in enumerate(a.images):
        im = Image.open(f).convert('RGB'); im.thumbnail((c, c))
        o.paste(im, ((i % cols) * c + (c - im.width) // 2, (i // cols) * c + (c - im.height) // 2))
o.save(a.out)
print('wrote', a.out, o.size)
