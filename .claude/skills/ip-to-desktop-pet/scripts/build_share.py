#!/usr/bin/env python3
"""从完整验收页 index.html 生成精简分享页 share.html。

引擎只有一份（index.html 里的 <script>），分享页复用同一段脚本和同一套颜色令牌，
只换一个只含「角色切换 + 舞台」的外壳。引擎用 $() 取元素，缺失的控件会变成游离占位，
所以分享页里没有的按钮、日志、状态表都不会报错。

用法：python3 build_share.py <index.html> [share.html]（默认输出到同目录 share.html）
"""
import re
import sys
from pathlib import Path

if len(sys.argv) < 2:
    sys.exit(__doc__)
src = Path(sys.argv[1])
dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_name('share.html')
html = src.read_text(encoding='utf-8')

fonts = re.search(r'<link rel="preconnect".*?\n<link rel="stylesheet"[^>]*>', html, re.S).group(0)
base_css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)          # 令牌 + 全部组件样式
script = html[html.index('<script>'):html.rindex('</script>') + len('</script>')]

share_css = """
/* 分享页：手机优先，整屏就是舞台；角色切换只用缩略图，放在地面那一条里。文字一律不上屏。 */
html, body { height: 100%; overflow: hidden; }
body { display: grid; place-items: center; background: var(--bg); }
.share { position: relative; width: 100%; height: 100%; max-width: 440px; }
.share .stage { position: absolute; inset: 0; height: auto; border: 0; border-radius: 0; }
@media (min-width: 600px) and (min-height: 700px) {
  .share { height: min(880px, calc(100% - 48px)); }
  .share .stage { border-radius: 28px; border: 1px solid var(--line); }
}
.share .cast { position: absolute; left: 0; right: 0; bottom: max(14px, env(safe-area-inset-bottom, 0px));
  display: flex; justify-content: center; gap: 14px; z-index: 2; }
.share .who { display: block; width: 58px; height: 58px; padding: 6px; border-radius: 50%; border: 0;
  background: color-mix(in srgb, var(--surface) 70%, transparent); box-shadow: none; transition: transform .25s, background .25s; }
.share .who[aria-pressed="true"] { background: var(--surface); transform: translateY(-4px); box-shadow: 0 6px 18px rgb(0 0 0 / .12); }
.share .who .thumb, .share .who svg { display: block; width: 46px; height: 46px; }
.share .who > span:last-child { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fx-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.pet-svg { shape-rendering: geometricPrecision; }
"""

page = f"""<title>暖橙水滴和朋友们</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>{base_css}</style>
<style>{share_css}</style>

<main class="share">
  <div class="stage" id="stage" aria-label="桌宠舞台：拖动、点击、连点或静置">
    <div class="shadow" id="shadow"></div>
    <div class="pet-host" id="pet-host" tabindex="0" role="img" aria-label="桌宠"></div>
    <svg class="fx-layer" id="fx-layer" aria-hidden="true"></svg>
  </div>
  <div class="cast" id="cast" role="group" aria-label="选择角色"></div>
</main>

{script}
"""
dst.write_text(page, encoding='utf-8')
print(f'wrote {dst} ({len(page) // 1024} KB)')
