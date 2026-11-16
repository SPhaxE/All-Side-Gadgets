import json,numpy as np,os
from PIL import Image,ImageDraw
import seg
bad=json.load(open('badsrc.json'));res=json.load(open('seg.json'));o=json.load(open('seg3.json'))
def runs(mask,gap):
    out=[];y=0;H=len(mask)
    while y<H:
        if mask[y]: y+=1;continue
        s=y
        while y<H and not mask[y]: y+=1
        out.append([s,y])
    m=[]
    for p in out:
        if m and p[0]-m[-1][1]<gap: m[-1][1]=p[1]
        else: m.append(p)
    return m
new={}
for rel in bad:
    im=Image.open(f'{seg.ROOT}/{rel}').convert('RGB');a=np.asarray(im).astype(int);H,W,_=a.shape
    bg=np.array(res[rel]['bg'])
    if bg[0]<230:
        x0,y0,x1,y1=res[rel]['panels'][0];sub=a[y0:y1,x0:x1];gut=(sub.min(axis=2)>=246)
    else:
        x0,y0,x1,y1=0,0,W,H;sub=a;gut=(np.abs(sub-bg).max(axis=2)<=7)
    rr=runs(gut.mean(axis=1)>=0.99,10)
    # merge short runs (headers) into the following run
    m=[];pend=None
    for s,e in rr:
        if pend is not None: s=pend;pend=None
        if e-s<200: pend=s;continue
        m.append([s,e])
    ps=[]
    for s,e in m:
        cols=np.where(~(gut[s:e].mean(axis=0)>=0.995))[0]
        ps.append((x0+int(cols[0]),y0+s,x0+int(cols[-1])+1,y0+e))
    new[rel]=ps
json.dump(new,open('recut.json','w'))
import collections
ar=[round((p[2]-p[0])/(p[3]-p[1]),1) for v in new.values() for p in v];print(collections.Counter(ar).most_common(),sum(len(v) for v in new.values()))
for si in range(0,len(bad),21):
    sheet=Image.new('RGB',(21*143,250),'#333')
    for j,rel in enumerate(bad[si:si+21]):
        im=Image.open(f'{seg.ROOT}/{rel}').convert('RGB');d=ImageDraw.Draw(im)
        for (p,q,r,s) in new[rel]: d.rectangle((p,q,r-1,s-1),outline=(255,0,0),width=8)
        im.thumbnail((141,246));sheet.paste(im,(j*143,0))
    sheet.save(f'prev2/re{si//21}.jpg',quality=80)
