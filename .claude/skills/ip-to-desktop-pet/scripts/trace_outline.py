#!/usr/bin/env python3
"""在原图指定区域里描出白色（或指定颜色）特征的外轮廓，输出 SVG 单位坐标。

用法：
  python3 -I trace_outline.py <图片> --box X0 Y0 X1 Y1 \\
      --origin-px PX PY --origin-unit UX UY --px-per-unit S [--fg 255,255,255] [--n 64]

- 阈值取「前景色与区域背景色的半强度中点」（自动从区域四角估计背景），避免偏白阈值把形状量细；
- 只取最大连通块，Moore 邻域追踪边界，轻度滑动平均去像素台阶，按弧长重采样 n 点；
- 坐标换算：unit = (px - origin_px) / px_per_unit + origin_unit。
输出 JSON：{bbox:[x0,x1,y0,y1], points:[[x,y]...]}。
描边结果用来「量尺寸」，最终形状建议按量到的几何解析重建（见 references/replication.md）。
"""
import argparse, json
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('image'); ap.add_argument('--box', nargs=4, type=int, required=True)
ap.add_argument('--origin-px', nargs=2, type=float, required=True); ap.add_argument('--origin-unit', nargs=2, type=float, required=True)
ap.add_argument('--px-per-unit', type=float, required=True)
ap.add_argument('--fg', default='255,255,255'); ap.add_argument('--n', type=int, default=64)
a = ap.parse_args()

x1, y1, x2, y2 = a.box
sub = np.asarray(Image.open(a.image).convert('RGB')).astype(float)[y1:y2, x1:x2]
fg = np.array([float(v) for v in a.fg.split(',')])
bg = np.mean([sub[0, 0], sub[0, -1], sub[-1, 0], sub[-1, -1]], axis=0)
# 投影到「背景→前景」方向，> 0.5 即半强度以上
t = ((sub - bg) @ (fg - bg)) / max(1e-6, (fg - bg) @ (fg - bg))
m = t > .5

H, W = m.shape; lab = np.zeros((H, W), int); best, cur = (0, 0), 0
for y in range(H):
    for x in range(W):
        if m[y, x] and not lab[y, x]:
            cur += 1; st = [(y, x)]; lab[y, x] = cur; n = 0
            while st:
                p, q = st.pop(); n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    c, d = p + dy, q + dx
                    if 0 <= c < H and 0 <= d < W and m[c, d] and not lab[c, d]: lab[c, d] = cur; st.append((c, d))
            if n > best[1]: best = (cur, n)
m = lab == best[0]
ys, xs = np.nonzero(m); i = np.argmin(ys * 100000 + xs); start = (ys[i], xs[i])
nb = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
pts = [start]; c0 = start; d = 6
for _ in range(100000):
    for k in range(8):
        dd = (d + k) % 8; c = (c0[0] + nb[dd][0], c0[1] + nb[dd][1])
        if 0 <= c[0] < H and 0 <= c[1] < W and m[c]: c0 = c; d = (dd + 5) % 8; break
    if c0 == start: break
    pts.append(c0)
ox, oy = a.origin_px; ux, uy = a.origin_unit; s = a.px_per_unit
P = np.array([((x1 + p[1] + .5 - ox) / s + ux, (y1 + p[0] + .5 - oy) / s + uy) for p in pts])
k = 4; P = np.array([P[(np.arange(-k, k + 1) + j) % len(P)].mean(0) for j in range(len(P))])
L = np.r_[0, np.cumsum(np.hypot(*np.diff(np.r_[P, P[:1]], axis=0).T))]
sv = np.linspace(0, L[-1], a.n, endpoint=False)
Q = np.c_[np.interp(sv, L, np.r_[P[:, 0], P[0, 0]]), np.interp(sv, L, np.r_[P[:, 1], P[0, 1]])]
print(json.dumps({'bbox': [round(float(v), 2) for v in (Q[:, 0].min(), Q[:, 0].max(), Q[:, 1].min(), Q[:, 1].max())],
                  'points': [[round(float(x), 2), round(float(y), 2)] for x, y in Q]}))
