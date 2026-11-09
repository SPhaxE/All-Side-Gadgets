#!/usr/bin/env python3
"""用「曲率半径随法向角的分布 ρ(θ)」设计外凸 G2 形状（小橙水滴就是这么做的），并检查参数极值。

原理：凸闭曲线可以由 ρ(θ)（法向角为 θ 处的曲率半径）唯一确定。
  - ρ > 0 处处成立 ⇒ 处处外凸；ρ 光滑 ⇒ 曲率连续（G2）；
  - 去掉 ρ 的一阶谐波（cos θ、sin θ 分量）⇒ 曲线精确闭合；
  - 直边 = 在该法向角上的「长度脉冲」（用窄高斯代替 δ 函数），圆角 = 一段常数 ρ。
默认参数还原教程水滴：圆 r=60，右上角 r=9，上边、右边各长 51。

用法：
  python3 -I rho_shape.py                      # 默认形 + 若干变体的数值报告
  python3 -I rho_shape.py --png out.png        # 同时画出轮廓与曲率梳
  python3 -I rho_shape.py --rc 6 --m 1.25 --d -.4   # 检查某组参数（rc 角半径、m 角的量、d 两边长差）
输出：最小 ρ（必须 > 0）、闭合误差、外接框。最小 ρ 接近 0 说明该参数组合会出尖点，应在引擎里夹住。
"""
import argparse
import numpy as np


def drop(N=720, R=60, rc=9, L=51, m=1.0, d=0.0, thc=-np.pi / 4, sw=np.radians(6), sg=np.radians(5)):
    p = (np.arange(N) + .5) / N
    phi = 2 * np.pi * (p - .5)                       # 以角为中心的法向角偏移
    th = thc + phi
    dth = 2 * np.pi / N
    win = .5 * (np.tanh((phi + np.pi / 4) / sw) - np.tanh((phi - np.pi / 4) / sw))
    G = lambda x: np.exp(-.5 * (x / sg) ** 2) / (sg * np.sqrt(2 * np.pi))
    rho = R - (R - rc) * min(m, 1) * win + m * (L * (1 + d) * G(phi + np.pi / 4) + L * (1 - d) * G(phi - np.pi / 4))
    c = (rho * np.cos(th)).sum() * dth / np.pi
    s = (rho * np.sin(th)).sum() * dth / np.pi
    rho = rho - c * np.cos(th) - s * np.sin(th)       # 去一阶谐波 ⇒ 闭合
    t = np.c_[-np.sin(th), np.cos(th)]
    X = np.cumsum(rho[:, None] * t * dth, axis=0)
    X = np.r_[[[0, 0]], X[:-1]]
    gap = (X[-1] + rho[-1] * t[-1] * dth) - X[0]
    ctr = X[0] - rho[0] * np.array([np.cos(th[0]), np.sin(th[0])])
    return X - ctr + 100, rho, gap


def report(name, **kw):
    X, rho, gap = drop(**kw)
    print(f'{name:28s} min ρ {rho.min():7.2f}   闭合误差 {np.abs(gap).max():.1e}   外接框 x {X[:, 0].min():.1f}–{X[:, 0].max():.1f}  y {X[:, 1].min():.1f}–{X[:, 1].max():.1f}')
    return X, rho


ap = argparse.ArgumentParser()
for k, v in dict(R=60, rc=9, L=51, m=1.0, d=0.0).items():
    ap.add_argument('--' + k, type=float, default=v)
ap.add_argument('--png')
a = ap.parse_args()
base = dict(R=a.R, rc=a.rc, L=a.L, m=a.m, d=a.d)
shapes = [('当前参数', base), ('圆水滴 m=0', {**base, 'm': 0}), ('耷拉 d=+.4', {**base, 'd': .4}), ('翘起 d=-.4', {**base, 'd': -.4}),
          ('尖 rc=6 m=1.25', {**base, 'rc': 6, 'm': 1.25}), ('钝 rc=16 m=.7', {**base, 'rc': 16, 'm': .7})]
res = [(n, *report(n, **k)) for n, k in shapes]
if a.png:
    from PIL import Image, ImageDraw
    W = 230
    im = Image.new('RGB', (W * len(res), 260), 'white')
    dr = ImageDraw.Draw(im)
    for i, (n, X, rho) in enumerate(res):
        ox = i * W + 15
        dr.polygon([(x + ox - 25, y + 20) for x, y in X], outline=(0, 0, 0))
        n_ = len(X)
        for j in range(0, n_, 6):                    # 曲率梳：梳齿长度 ∝ 曲率 1/ρ，全部朝外 ⇒ 外凸
            a_, c_ = X[j - 1], X[(j + 1) % n_]
            tx, ty = c_[0] - a_[0], c_[1] - a_[1]
            L_ = np.hypot(tx, ty) or 1
            k = 1 / max(rho[j], 1e-6) * 300
            x, y = X[j]
            dr.line([(x + ox - 25, y + 20), (x + ox - 25 + ty / L_ * k, y + 20 - tx / L_ * k)], fill=(220, 60, 60))
        dr.text((ox, 235), n.encode('ascii', 'ignore').decode() or f'#{i}', fill=(0, 0, 0))
    im.save(a.png)
    print('wrote', a.png)
