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
/* 分享页：手机优先。信息用版式分层而不是靠说明文字：
   名字（大）+ 性格标签 + 实时心情 → 舞台 → 地面上的角色切换（缩略图 + 名字）→ 一行手势提示 */
html, body { height: 100%; }
body { background: var(--bg); overflow: hidden; }
.share { height: 100%; max-width: 460px; margin: 0 auto; display: grid; grid-template-rows: auto minmax(0, 1fr) auto;
  padding-left: max(0px, env(safe-area-inset-left, 0px)); padding-right: max(0px, env(safe-area-inset-right, 0px)); }
.share .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 22px 20px 12px; }
.share .who-now { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.share .who-now h1 { font-size: clamp(34px, 11vw, 46px); line-height: 1; }
.share .who-now p { color: var(--muted); font-size: 13px; letter-spacing: .08em; }
.share .mood { flex: none; font: 600 12px var(--f-body); padding: 6px 12px; border-radius: 999px; background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); transition: background .3s; }
.share .stage { position: relative; height: auto; border: 0; border-radius: 0; }
.share .cast { position: absolute; left: 0; right: 0; bottom: 14px; display: flex; justify-content: center; gap: 22px; z-index: 2; }
.share .who { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0; border: 0; background: none; box-shadow: none; }
.share .who .thumb { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; background: color-mix(in srgb, var(--surface) 65%, transparent); transition: transform .25s, background .25s; }
.share .who svg { width: 48px; height: 48px; }
.share .who[aria-pressed="true"] .thumb { background: var(--surface); transform: translateY(-4px); box-shadow: 0 6px 18px rgb(0 0 0 / .12); }
.share .who > span:last-child { display: block; }
.share .who > span:last-child b { font-family: var(--f-body); font-weight: 600; font-size: 12px; }
.share .who > span:last-child small, .share .who .sw { display: none; }
.share .who[aria-pressed="false"] > span:last-child b { color: var(--muted); font-weight: 400; }
.share .hints { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px 16px; padding: 12px 16px max(16px, env(safe-area-inset-bottom, 0px));
  font-size: 12px; color: var(--muted); }
.share .hints b { color: var(--ink); font-weight: 600; margin-right: 3px; }
@media (min-width: 600px) and (min-height: 760px) {
  body { display: grid; place-items: center; }
  .share { height: min(900px, calc(100% - 40px)); width: 100%; border-radius: 28px; overflow: hidden; border: 1px solid var(--line); background: var(--bg); }
}
.fx-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.pet-svg { shape-rendering: geometricPrecision; }
"""

page = f"""<title>暖橙水滴和朋友</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>{base_css}</style>
<style>{share_css}</style>

<main class="share">
  <header class="top">
    <div class="who-now"><h1 id="pet-name">小橙</h1><p id="pet-tag">元气 · 好奇</p></div>
    <span class="mood" id="pet-mood" aria-live="polite">登场</span>
  </header>
  <div class="stage" id="stage" aria-label="桌宠舞台">
    <div class="shadow" id="shadow"></div>
    <div class="pet-host" id="pet-host" tabindex="0" role="img" aria-label="桌宠"></div>
    <svg class="fx-layer" id="fx-layer" aria-hidden="true"></svg>
    <div class="cast" id="cast" role="group" aria-label="选择角色"></div>
  </div>
  <footer class="hints"><span><b>拖</b>拎起来</span><span><b>甩</b>抛出去</span><span><b>点</b>戳一下</span><span><b>连点三下</b>开心</span><span><b>不理它</b>会睡着</span></footer>
</main>

{script}
"""
dst.write_text(page, encoding='utf-8')
print(f'wrote {dst} ({len(page) // 1024} KB)')
