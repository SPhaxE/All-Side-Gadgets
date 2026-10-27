#!/usr/bin/env python3
# Person masks for the dancer footage (rembg / u2net_human_seg). Output: assets/build/dancer/mask/%03d.png (grayscale).
# usage: python3 tools/build-masks.py      (needs: pip install "rembg[cpu]"; first run downloads the model)
import glob, os
from PIL import Image
from rembg import new_session, remove
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sorted(glob.glob(os.path.join(ROOT, 'assets/build/dancer/rgb/*.jpg')))
out = os.path.join(ROOT, 'assets/build/dancer/mask'); os.makedirs(out, exist_ok=True)
sess = new_session('u2net_human_seg')
for i, f in enumerate(src):
    dst = os.path.join(out, os.path.basename(f).replace('.jpg', '.png'))
    if os.path.exists(dst): continue
    remove(Image.open(f), session=sess, only_mask=True).convert('L').save(dst)
    if i % 25 == 0: print(i, '/', len(src), flush=True)
print('done', len(src))
