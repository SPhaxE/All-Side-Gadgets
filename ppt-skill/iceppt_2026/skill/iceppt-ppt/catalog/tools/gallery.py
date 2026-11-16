import json,re
OUT='/home/user/All-Side-Gadgets/ppt-skill/iceppt_2026/skill/iceppt-ppt/catalog/'
import build
ents=json.load(open(OUT+'index.json'));ZH=build.ZH
slim=[{k:e[k] for k in('tid','kind','system','role','main','charts','layout','accent','score','gist','title','page_no','src','file')}|{'pal':[x['hex'] for x in e['palette']['strong'][:2]]+[x['hex'] for x in e['palette']['tint'][:2]]} for e in ents]
html='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>iceppt 图表图库</title>
<style>
:root{--bg:#f4f4f2;--card:#fff;--ink:#1a1a1a;--g:#777;--line:#ddd;--acc:#0b2a4a}
@media(prefers-color-scheme:dark){:root{--bg:#161718;--card:#222325;--ink:#eee;--g:#9a9a9a;--line:#3a3b3d;--acc:#8fb4dd}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px}
h1{font-size:18px;margin:0 0 8px}.row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;align-items:center}
.row b{font-size:12px;color:var(--g);width:44px;flex:none}
button.c{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:14px;padding:3px 10px;font-size:13px;cursor:pointer}
button.c.on{background:var(--acc);border-color:var(--acc);color:#fff}@media(prefers-color-scheme:dark){button.c.on{color:#111}}
button.c small{color:var(--g);margin-left:4px}button.c.on small{color:inherit;opacity:.7}
input{flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:14px}
#n{color:var(--g);font-size:13px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;padding:16px}
.it{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;cursor:zoom-in}
.it img{width:100%;display:block;background:#fff;aspect-ratio:16/9;object-fit:contain}
.m{padding:8px 10px}.m .g{font-weight:600}.m .t{color:var(--g);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.tg span{font-size:11px;border:1px solid var(--line);border-radius:9px;padding:0 6px;color:var(--g)}
.tg span.mn{color:var(--acc);border-color:var(--acc)}.sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);vertical-align:-2px;margin-right:2px}
#lb{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;z-index:9;padding:16px;overflow:auto;cursor:zoom-out}
#lb img{max-width:100%;display:block;margin:0 auto;background:#fff}#lb p{color:#ddd;max-width:1080px;margin:10px auto;font-size:13px;word-break:break-all}
#lb code{background:#333;padding:1px 5px;border-radius:4px;color:#fff}
</style></head><body><header><h1>iceppt 图表图库 · __N__ 页</h1>
<div class="row"><input id="q" placeholder="搜索：标题 / 画了什么 / 页码 / tid"><span id="n"></span></div>
<div class="row" id="fc"><b>图形</b></div><div class="row" id="fs"><b>体系</b></div><div class="row" id="fr"><b>页型</b></div><div class="row" id="fl"><b>版式</b></div></header>
<main id="g"></main><div id="lb"><img><p></p></div>
<script>
const D=__DATA__,ZH=__ZH__;
const SYS={green:'绿',wine:'酒红',blue:'蓝',mono:'黑白灰',other:'其他'},ROLE={concept:'概念页',case:'案例页',report:'汇报数据页',template:'占位模板页'},KIND={done_before:'Done 反例'};
const st={c:null,s:null,r:null,l:null,q:''};const $=s=>document.querySelector(s);
function cnt(f){const m={};D.forEach(e=>[].concat(f(e)).forEach(v=>m[v]=(m[v]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function chips(id,key,items,lab){const el=$(id);items.forEach(([v,n])=>{const b=document.createElement('button');b.className='c';b.innerHTML=(lab[v]||v)+'<small>'+n+'</small>';b.onclick=()=>{st[key]=st[key]===v?null:v;[...el.querySelectorAll('.c')].forEach(x=>x.classList.toggle('on',x===b&&st[key]===v));draw()};el.appendChild(b)})}
chips('#fc','c',cnt(e=>e.charts),ZH);chips('#fs','s',cnt(e=>e.system),SYS);chips('#fr','r',cnt(e=>e.kind==='done_before'?'done_before':e.role),{...ROLE,...KIND});chips('#fl','l',cnt(e=>e.layout),{});
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function draw(){const q=st.q.toLowerCase();const L=D.filter(e=>(!st.c||e.charts.includes(st.c))&&(!st.s||e.system===st.s)&&(!st.r||(st.r==='done_before'?e.kind==='done_before':e.kind!=='done_before'&&e.role===st.r))&&(!st.l||e.layout===st.l)&&(!q||(e.title+' '+e.gist+' '+e.tid+' '+(e.page_no||'')+' '+e.accent).toLowerCase().includes(q)))
 .sort((a,b)=>(st.c?((b.main===st.c)-(a.main===st.c)):0)||b.score-a.score||a.tid.localeCompare(b.tid));
 $('#n').textContent=L.length+' 页';
 $('#g').innerHTML=L.map(e=>'<div class="it" data-t="'+e.tid+'"><img loading="lazy" src="'+e.file+'" alt="'+esc(e.gist)+'"><div class="m"><div class="g">'+esc(e.gist)+'　<span style="color:var(--g);font-weight:400">'+'★'.repeat(e.score)+'</span></div><div class="t">'+esc(e.title||'（无标题）')+'</div><div class="tg">'+e.charts.map((c,i)=>'<span class="'+(c===e.main?'mn':'')+'">'+(ZH[c]||c)+'</span>').join('')+'<span>'+e.layout+'</span><span>'+e.pal.map(h=>'<i class="sw" style="background:'+h+'"></i>').join('')+esc(e.pal[0]||'')+'</span></div></div></div>').join('')}
$('#q').oninput=e=>{st.q=e.target.value;draw()};
$('#g').onclick=ev=>{const it=ev.target.closest('.it');if(!it)return;const e=D.find(x=>x.tid===it.dataset.t);$('#lb img').src=e.file;$('#lb p').innerHTML='<code>'+e.file+'</code>　来源 <code>'+esc(e.src)+'</code><br>'+esc(e.title||'')+'<br>强调落点：'+esc(e.accent)+'　实测色：'+e.pal.map(h=>'<i class="sw" style="background:'+h+'"></i>'+h).join(' ');$('#lb').style.display='block'};
$('#lb').onclick=()=>$('#lb').style.display='none';draw();
</script></body></html>'''
html=html.replace('__N__',str(len(slim))).replace('__DATA__',json.dumps(slim,ensure_ascii=False).replace('</','<\\/')).replace('__ZH__',json.dumps(ZH,ensure_ascii=False))
open(OUT+'index.html','w').write(html);print(len(html))
