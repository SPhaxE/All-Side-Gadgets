import json,glob,os,colorsys,collections
import numpy as np
from PIL import Image
def hx(c): return '#%02X%02X%02X'%tuple(int(x) for x in c)
out={}
for f in sorted(glob.glob('crops/*.jpg')):
    im=Image.open(f).convert('RGB');im.thumbnail((400,400))
    a=np.asarray(im).reshape(-1,3).astype(float)/255;n=len(a)
    mx=a.max(1);mn=a.min(1);s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
    hsv=np.array([colorsys.rgb_to_hsv(*p) for p in a[::1]])
    h=hsv[:,0]
    strong=(s>=0.30)&(mx>=0.15); tint=(s>=0.045)&(s<0.30)&(mx>=0.78)
    def groups(mask):
        res=[]
        if mask.sum()<n*0.003: return res
        hb=(h[mask]*12).astype(int)%12
        for b,c in collections.Counter(hb).most_common(3):
            if c<n*0.003: break
            px=a[mask][hb==b];res.append({'hex':hx(np.median(px,axis=0)*255),'area':round(c/n*100,1)})
        return res
    out[os.path.basename(f)[:-4]]={'strong':groups(strong),'tint':groups(tint),
       'strong_area':round(strong.mean()*100,1),'tint_area':round(tint.mean()*100,1),
       'white_area':round(((mn>=0.96)).mean()*100,1)}
json.dump(out,open('palette.json','w'))
import statistics
print('median strong',statistics.median(v['strong_area'] for v in out.values()),'tint',statistics.median(v['tint_area'] for v in out.values()),'white',statistics.median(v['white_area'] for v in out.values()))
for k in ('1029-6a28-01-2','0113-a878-01-1'):
    print(k,out.get(k))
