import json,glob,os,re,shutil,collections,html
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__))+'/'
OUT='/home/user/All-Side-Gadgets/ppt-skill/iceppt_2026/skill/iceppt-ppt/catalog/'
ZH={'bar':'柱状图','stacked_bar':'堆叠柱 / Marimekko','grouped_bar':'分组柱','hbar':'横向条形','combo_bar_line':'柱线组合（双轴）','line':'折线图','area':'面积图','waterfall':'瀑布 / 桥图','step':'阶梯图 / 成本曲线','dumbbell':'哑铃图','slope':'斜率图','small_multiples':'小多图','heatmap':'热力表','cohort':'同期群热力','pareto':'帕累托','boxplot':'箱线图','butterfly':'蝴蝶图 / 力场','bubble':'气泡图','scatter':'散点图','radar':'雷达图','pie_donut':'环形 / 饼','funnel':'漏斗','pyramid':'金字塔','matrix_2x2':'2×2 矩阵','matrix_grid':'多格矩阵 / 风险矩阵','table':'表格 / 对照表','gantt':'甘特图','timeline':'时间轴','chevron_flow':'箭头流程（chevron）','box_flow':'方框流程','cycle':'循环 / 飞轮 / 辐射','tree':'树状拆解','venn':'韦恩图','sankey':'桑基图','map':'地图','concept_curve':'概念曲线（S 曲线 / Kano / 情绪）','kpi_cards':'大数字 KPI 卡','progress_bar':'进度条','gauge':'仪表 / 环形进度','icon_array':'图标阵列','journey_map':'旅程地图','layers':'分层 / 冰山 / 同心圆','swimlane':'泳道','formula':'公式拆解','cards_only':'纯卡片版式','text_only':'纯文字'}
panels={p['tid']:p for p in json.load(open(S+'panels2.json'))}
tags={}
for f in glob.glob(S+'tags/*.json'):
    for x in json.load(open(f)): tags[x['tid']]=x
pal=json.load(open(S+'palette.json'))
ents=[]
for tid,p in panels.items():
    t=tags.get(tid)
    if not t: continue
    if not t.get('crop_ok',True) or t['kind'] in('cover_toc','other'): continue
    t['charts']=[c for c in dict.fromkeys([t['main']]+t.get('charts',[])) if c in ZH]
    if t['main'] not in ZH: continue
    ents.append({**t,'src':p['src'],'bbox':p['bbox'],'w':p['w'],'h':p['h']})
# dedupe same slide: key on page_no + normalised title (green numbered pages) 
def key(e):
    ti=re.sub(r'[\s\W_]+','',(e.get('title') or '')).lower()
    return (e['kind'],e.get('page_no') or '',ti[:40]) if ti else ('u',e['tid'])
best={}
for e in ents:
    k=key(e)
    if k not in best or (e['score'],e['w']*e['h'])>(best[k]['score'],best[k]['w']*best[k]['h']): best[k]=e
ents=sorted(best.values(),key=lambda e:e['tid'])
shutil.rmtree(OUT,ignore_errors=True);os.makedirs(OUT+'slides');os.makedirs(OUT+'sheets');os.makedirs(OUT+'charts')
for e in ents:
    shutil.copy(S+f"crops/{e['tid']}.jpg",OUT+f"slides/{e['tid']}.jpg")
    pp=pal.get(e['tid'],{})
    e['palette']={'strong':pp.get('strong',[]),'tint':pp.get('tint',[]),'strong_area':float(pp.get('strong_area',0)),'tint_area':float(pp.get('tint_area',0)),'white_area':float(pp.get('white_area',0))}
    e['file']=f"slides/{e['tid']}.jpg"
json.dump(ents,open(OUT+'index.json','w'),ensure_ascii=False,indent=1)
by=collections.defaultdict(list)
for e in ents:
    if e['kind']!='slide': continue
    for c in e['charts']: by[c].append(e)
def rank(c,e): return (e['main']==c,e['score'],e['role']!='template',e['w'])
# contact sheets + per-chart md
for c,l in by.items():
    l.sort(key=lambda e:rank(c,e),reverse=True)
    top=[e for e in l if e['main']==c][:12] or l[:6]
    cols=3;tw=640;th=360;rows=-(-len(top)//cols)
    sheet=Image.new('RGB',(cols*tw,rows*th),'#888')
    for i,e in enumerate(top):
        im=Image.open(OUT+e['file']).convert('RGB');im.thumbnail((tw-6,th-6));sheet.paste(im,((i%cols)*tw+3,(i//cols)*th+3))
    sheet.save(OUT+f'sheets/{c}.jpg',quality=82)
    md=[f"# {ZH[c]}（`{c}`）",'',f"共 {len(l)} 页含此图形，其中 {sum(1 for e in l if e['main']==c)} 页以它为主图。总览图：[`../sheets/{c}.jpg`](../sheets/{c}.jpg)（按下表顺序，从左到右、从上到下，只含主图页的前 12 张）。",'','<!-- RECIPE -->','','## 范例页（按复刻价值排序）','','| # | 图 | 体系 | 页型 | 版式 | 强调落点 | 画了什么 | 实测强调色 | 来源 |','|---|---|---|---|---|---|---|---|---|']
    for i,e in enumerate(l,1):
        sw=' '.join(f"`{x['hex']}` {x['area']}%" for x in e['palette']['strong'][:2]) or '—'
        md.append(f"| {i} | [`{e['tid']}`](../{e['file']}) | {e['system']} | {e['role']} | {e['layout']} | {e['accent']} | {e['gist']}{'' if e['main']==c else '（配角）'} | {sw} | `{e['src']}` |")
    open(OUT+f'charts/{c}.md','w').write('\n'.join(md)+'\n')
print(len(ents),'entries;',len(by),'chart types');print({c:len(l) for c,l in sorted(by.items(),key=lambda x:-len(x[1]))})
json.dump({c:[e['tid'] for e in l] for c,l in by.items()},open(S+'by.json','w'))
