#!/usr/bin/env python3
# Bundle the fonts the reel uses so it renders identically on any machine (no system-font dependency).
# Latin families are converted to woff2 (Latin + punctuation subset); CJK families are subset to exactly
# the non-ASCII characters that appear in src/**/*.js. Re-run after adding new CJK text.
# usage: python3 tools/build-fonts.py   (needs: pip install fonttools brotli)
import glob, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont, TTCollection

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'fonts')
os.makedirs(OUT, exist_ok=True)
INTER = '/usr/share/fonts/opentype/inter'
JBM = '/usr/share/fonts/truetype/jetbrains-mono'
WEIGHTS = {100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'}
LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-21FF,U+2212,U+2215,U+25A0-25FF,U+FF01-FF5E'

text = ''.join(open(f, encoding='utf8').read() for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.js'), recursive=True))
cjk = ''.join(sorted(set(ch for ch in text if ord(ch) > 0x2E7F))) + '０１２３４５６７８９'

def run(src, dst, unicodes=None, chars=None, font_number=0):
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
    font = subset.load_font(src, opts, dontLoadGlyphNames=False, ) if not src.endswith('.ttc') else TTCollection(src).fonts[font_number]
    s = subset.Subsetter(opts)
    if unicodes: s.populate(unicodes=subset.parse_unicodes(unicodes))
    if chars: s.populate(text=chars)
    s.subset(font)
    subset.save_font(font, os.path.join(OUT, dst), opts)
    return dst

css = []
def face(family, file, weight=400):
    css.append(f"@font-face{{font-family:'{family}';src:url('{file}') format('woff2');font-weight:{weight};font-style:normal;font-display:block}}")

for w, n in WEIGHTS.items():
    face('Inter', run(f'{INTER}/Inter-{n}.otf', f'Inter-{n}.woff2', unicodes=LATIN), w)
for w in (700, 800, 900):
    n = WEIGHTS[w]; face('Inter Display', run(f'{INTER}/InterDisplay-{n}.otf', f'InterDisplay-{n}.woff2', unicodes=LATIN), w)
for w in (400, 500, 600, 700, 800):
    n = WEIGHTS[w]; face('JetBrains Mono', run(f'{JBM}/JetBrainsMono-{n}.ttf', f'JetBrainsMono-{n}.woff2', unicodes=LATIN), w)
face('WenQuanYi Zen Hei', run('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 'WQYZenHei-subset.woff2', chars=cjk + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .:-·'))
face('IPAGothic', run('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf', 'IPAGothic-subset.woff2', chars=cjk + 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ .·'))
open(os.path.join(OUT, 'fonts.css'), 'w').write('\n'.join(css) + '\n')
print(len(css), 'faces;', len(cjk), 'CJK chars ->', OUT)
