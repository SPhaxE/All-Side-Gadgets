#!/usr/bin/env python3
"""为一条稠密闭合轮廓挑选「最少锚点、无多余拐点」的 B 样条拟合设置（K、曲率权重 c、二阶差分正则 λ）。

引擎的做法：参数 u 按「弧长 ×（1 + c·曲率）」分配，M =（AᵀA + λ·DᵀD）⁻¹Aᵀ 是常矩阵。
锚点太少时拟合长直边会振铃出拐点；本脚本网格搜索，列出曲率变号次数等于目标值的组合，
按 K 升序、误差升序排序，同时给出最大偏差和最紧处的曲率半径（看角是否被磨圆）。

用法：
  python3 -I fit_search.py --rho                       # 用 rho_shape.py 的默认水滴
  python3 -I fit_search.py --points outline.json --signs 10   # 自己的轮廓（[[x,y],...] 稠密、闭合、按顺序），设计拐点数 10
  python3 -I fit_search.py --rho --K 12-20 --c 0,1,2,4 --lam 0,.002,.02,.1
本项目结果：小橙 K=16、c=4、λ=0.02（变号 0、误差 0.66、角半径 10.3）；噼啪 K=15、c=2、λ=0.002（变号 10）。
"""
import argparse, json, importlib.util, sys
from pathlib import Path
import numpy as np


def basis(t):
    return np.array([(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t ** 2 + 4) / 6, (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6, t ** 3 / 6])


def curv_u(S, K, c):
    d = np.roll(S, -1, 0) - S
    seg = np.hypot(*d.T)
    ang = np.arctan2(d[:, 1], d[:, 0])
    turn = np.abs((np.roll(ang, -1) - ang + np.pi) % (2 * np.pi) - np.pi)
    kap = turn / np.maximum(seg, 1e-9)
    kap = np.convolve(np.r_[kap[-10:], kap, kap[:10]], np.ones(21) / 21, 'valid')
    w = seg * (1 + c * kap)
    return K * np.r_[0, np.cumsum(w)][:-1] / w.sum()


def fit(S, us, K, lam):
    A = np.zeros((len(S), K))
    for j, u in enumerate(us):
        i = int(np.floor(u)); w = basis(u - i)
        for a in range(4):
            A[j, (i - 1 + a) % K] += w[a]
    D = np.zeros((K, K))
    for i in range(K):
        D[i, (i - 1) % K] += 1; D[i, i] -= 2; D[i, (i + 1) % K] += 1
    return np.linalg.solve(A.T @ A + lam * D.T @ D, A.T @ S)


def curve(P, m=24):
    K = len(P)
    return np.array([sum(basis(s / m)[a] * P[(i - 1 + a) % K] for a in range(4)) for i in range(K) for s in range(m)])


def signs_and_minr(C):
    a, c = np.roll(C, 1, 0), np.roll(C, -1, 0)
    cr = (C[:, 0] - a[:, 0]) * (c[:, 1] - C[:, 1]) - (C[:, 1] - a[:, 1]) * (c[:, 0] - C[:, 0])
    l = np.hypot(*(C - a).T) * np.hypot(*(c - C).T) * np.hypot(*(c - a).T)
    k = 2 * cr / l
    s = np.sign(k)
    return int((s != np.roll(s, -1)).sum()), 1 / np.abs(k).max()


def rng(text, cast=float):
    if '-' in text and ',' not in text and cast is int:
        a, b = text.split('-'); return list(range(int(a), int(b) + 1))
    return [cast(x) for x in text.split(',')]


ap = argparse.ArgumentParser()
g = ap.add_mutually_exclusive_group(required=True)
g.add_argument('--rho', action='store_true', help='用 rho_shape.py 默认水滴')
g.add_argument('--points', help='JSON 文件：稠密闭合轮廓 [[x,y],...]')
ap.add_argument('--signs', type=int, default=0, help='设计的曲率变号次数（外凸 = 0，五角星 = 10）')
ap.add_argument('--K', default='12-20'); ap.add_argument('--c', default='0,1,2,4'); ap.add_argument('--lam', default='0,.002,.02,.1')
ap.add_argument('--top', type=int, default=10)
a = ap.parse_args()
if a.rho:
    spec = importlib.util.spec_from_file_location('rho_shape', Path(__file__).with_name('rho_shape.py'))
    sys.argv = [sys.argv[0]]; mod = importlib.util.module_from_spec(spec)
    import contextlib, io
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    X = mod.drop(N=180)[0]
else:
    X = np.array(json.load(open(a.points)), float)
rows = []
for K in rng(a.K, int):
    for c in rng(a.c):
        for lam in rng(a.lam):
            C = curve(fit(X, curv_u(X, K, c), K, lam))
            sg, mr = signs_and_minr(C)
            err = max(np.min(np.hypot(*(C - q).T)) for q in X)
            rows.append((sg, K, c, lam, err, mr))
ok = sorted([r for r in rows if r[0] == a.signs], key=lambda r: (r[1], r[4]))
print(f'曲率变号 = {a.signs} 的组合（按 K、误差排序）：')
for sg, K, c, lam, err, mr in ok[:a.top]:
    print(f'  K={K:2d}  c={c:<4}  λ={lam:<6}  最大偏差 {err:.2f}  最紧曲率半径 {mr:.1f}')
if not ok:
    print('  没有满足的组合：放宽 λ、加大 K，或检查轮廓本身是否就有多余拐点')
