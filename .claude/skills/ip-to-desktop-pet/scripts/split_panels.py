#!/usr/bin/env python3
"""把横排的多步骤教程长图按白色画板切开。

用法：python3 -I split_panels.py <图片> <输出目录> [--row Y] [--min-width 300] [--ref-size 400x360]

- 取第 Y 行（默认图片中线），深灰底色（低饱和、偏暗）之间的连续区间即画板；
- 每块画板原尺寸存为 panelN.png，另存一份去掉底部标题区、缩放到 ref-size 的 stepN.jpg（供页面对照）；
- 打印每块画板的像素区间，后续量几何、读参数对话框都用这些坐标。
"""
import argparse
from pathlib import Path
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('image'); ap.add_argument('out')
ap.add_argument('--row', type=int); ap.add_argument('--min-width', type=int, default=300)
ap.add_argument('--ref-size', default='400x360'); ap.add_argument('--art-height', type=float, default=.6,
    help='画板上方用于对照的比例（去掉底部标题），默认 0.6')
a = ap.parse_args()

im = Image.open(a.image).convert('RGB'); W, H = im.size
y = a.row if a.row is not None else H // 2
def frame(px):                      # 画板之间的深灰底：低饱和、偏暗（作品本身是彩色或白色，不会被误判）
    r, g, b = px; return max(r, g, b) - min(r, g, b) < 14 and (r + g + b) / 3 < 110
isf = [frame(im.getpixel((x, y))) for x in range(W)]
spans, start = [], None
for x, f in enumerate(isf + [True]):
    if not f and start is None: start = x
    if f and start is not None:
        if x - start >= a.min_width: spans.append((start, x))
        start = None

out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
rw, rh = map(int, a.ref_size.split('x'))
for i, (x0, x1) in enumerate(spans, 1):
    # 画板上下边界：沿画板中线找亮区
    col = [not frame(im.getpixel((x0 + 5, yy))) for yy in range(H)]
    y0 = col.index(True); y1 = H - col[::-1].index(True)
    panel = im.crop((x0, y0, x1, y1)); panel.save(out / f'panel{i}.png')
    w, h = panel.size
    art = panel.crop((int(w * .08), int(h * .06), int(w * .92), int(h * (.06 + a.art_height))))
    art.resize((rw, rh), Image.LANCZOS).save(out / f'step{i}.jpg', quality=82)
    print(f'step{i}: x {x0}-{x1}  y {y0}-{y1}  ({x1 - x0}×{y1 - y0})')
