import json,glob,os,sys,collections
import numpy as np
from PIL import Image
ROOT='/home/user/All-Side-Gadgets/ppt-skill/iceppt_2026'
def unique_images():
    c=json.load(open(f'{ROOT}/dedupe/clusters.json'))
    dup=set()
    folders=sorted(glob.glob(f'{ROOT}/2026-*'))
    # members refs "idx:NN" -> need folder index mapping; use owner/worst + scan: mark all members except owner
    allj=sorted(glob.glob(f'{ROOT}/2026-*/*.jpg'))
    return c,allj
def segment(im,tol=7,minh=140):
    a=np.asarray(im.convert('RGB')).astype(int)
    H,W,_=a.shape
    frame=np.concatenate([a[:6].reshape(-1,3),a[-6:].reshape(-1,3),a[:,:6].reshape(-1,3),a[:,-6:].reshape(-1,3)])
    bg=np.median(frame,axis=0)
    isbg=(np.abs(a-bg).max(axis=2)<=tol)
    rowbg=isbg.mean(axis=1)>=0.985
    panels=[];y=0
    while y<H:
        if rowbg[y]: y+=1;continue
        y0=y
        while y<H and not rowbg[y]: y+=1
        # merge small gaps handled later
        panels.append([y0,y])
    # merge segments separated by <10px gutter
    m=[]
    for p in panels:
        if m and p[0]-m[-1][1]<10: m[-1][1]=p[1]
        else: m.append(p)
    out=[]
    for y0,y1 in m:
        if y1-y0<minh: continue
        colbg=isbg[y0:y1].mean(axis=0)>=0.985
        xs=np.where(~colbg)[0]
        if len(xs)==0: continue
        out.append((int(xs[0]),y0,int(xs[-1])+1,y1))
    return out,tuple(int(v) for v in bg)
if __name__=='__main__':
    c,allj=unique_images()
    # ref index: figure mapping by checking owner_ref
    ref2path={}
    for x in c:
        ref2path[x['owner_ref']]=x['owner']
    idx2folder={}
    for r,p in ref2path.items(): idx2folder[r.split(':')[0]]=p.split('/')[0]
    dups=set()
    unk=0
    for x in c:
        for m in x['members']:
            if m==x['owner_ref']: continue
            i,n=m.split(':')
            if i in idx2folder: dups.add(f"{idx2folder[i]}/{n}.jpg")
            else: unk+=1
    print('dups',len(dups),'unknown',unk)
    res={}
    hist=collections.Counter()
    for f in allj:
        rel=f[len(ROOT)+1:]
        im=Image.open(f)
        if im.size==(750,1000): continue
        if rel in dups: continue
        ps,bg=segment(im)
        res[rel]={'size':im.size,'bg':bg,'panels':ps}
        hist[len(ps)]+=1
    print(len(res),hist)
    json.dump(res,open('seg.json','w'))
    json.dump(sorted(dups),open('dups.json','w'))
