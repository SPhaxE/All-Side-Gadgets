import json,sys,glob,collections,os
import numpy as np
from PIL import Image,ImageDraw
import seg
S=os.path.dirname(os.path.abspath(__file__))+'/'
def split_white(a,box,minh=140):
    x0,y0,x1,y1=box
    sub=a[y0:y1,x0:x1]
    white=(sub.min(axis=2)>=246)
    roww=white.mean(axis=1)>=0.995
    segs=[];y=0;H=y1-y0
    while y<H:
        if roww[y]: y+=1;continue
        s=y
        while y<H and not roww[y]: y+=1
        segs.append([s,y])
    m=[]
    for p in segs:
        if m and p[0]-m[-1][1]<14: m[-1][1]=p[1]
        else: m.append(p)
    out=[]
    for s,e in m:
        if e-s<minh: continue
        colw=white[s:e].mean(axis=0)>=0.995
        xs=np.where(~colw)[0]
        out.append((x0+int(xs[0]),y0+s,x0+int(xs[-1])+1,y0+e))
    return out
def run():
    res=json.load(open(S+'seg.json'));out={};h=collections.Counter()
    for rel,v in res.items():
        im=Image.open(f'{seg.ROOT}/{rel}').convert('RGB');a=np.asarray(im).astype(int)
        panels=[tuple(p) for p in v['panels']]
        if v['bg'][0]<230:   # teal frame: split inner white sheet
            pp=[]
            for p in panels: pp+=split_white(a,p) or [p]
            panels=pp
        out[rel]=panels;h[len(panels)]+=1
    json.dump(out,open(S+'seg2.json','w'));print(h,sum(len(p) for p in out.values()))
    return out
if __name__=='__main__':
    out=run()
    # overlay previews: 12 images per sheet
    rels=sorted(out);os.makedirs(S+'prev',exist_ok=True)
    for si in range(0,len(rels),15):
        sheet=Image.new('RGB',(5*300,3*520),'#333')
        for j,rel in enumerate(rels[si:si+15]):
            im=Image.open(f'{seg.ROOT}/{rel}').convert('RGB');d=ImageDraw.Draw(im)
            for n,(x0,y0,x1,y1) in enumerate(out[rel]):
                d.rectangle((x0,y0,x1-1,y1-1),outline=(255,0,0),width=6);d.text((x0+10,y0+10),str(n+1),fill=(255,0,0))
            im.thumbnail((296,512));sheet.paste(im,((j%5)*300,(j//5)*520))
        sheet.save(S+f'prev/sheet{si//15:02d}.jpg',quality=80)
