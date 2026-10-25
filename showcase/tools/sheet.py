#!/usr/bin/env python3
# usage: sheet.py out.png cols img1 img2 ...   (contact sheet, thumbnails scaled to 640 wide)
import sys
from PIL import Image
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
tw = 640; th = round(ims[0].size[1] * tw / ims[0].size[0])
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (tw * cols, th * rows))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
sheet.save(out); print(out, sheet.size)
