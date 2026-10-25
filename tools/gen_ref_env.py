"""Write audio-lab/src/ref-env.js: normalised RMS envelopes of the reference clips, drawn as a ghost line on the page."""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from analyze_ref import load, rms_env
import numpy as np
S1 = [("eightbit",0.11,2.47),("oldflash",2.69,3.5),("cinwoosh",4.19,6.47),("nightvision",6.73,8.3),("nextel",8.59,9.0),("digitaltext",9.07,9.69),("riser",9.7,13.4),("counter",14.07,14.95),("bicycle",15.1,15.7),("camera",16.4,17.0),("shine",17.49,17.89),("woosh",18.62,19.37)]
S2 = [("l01",0.13,2.797),("l02",2.797,6.797),("l03",6.797,12.13),("l04",12.13,17.463),("l07",17.463,22.797),("l09",22.797,25.463),("l11",25.463,28.13),("l12",28.13,30.797),("l17",30.797,36.13),("l22",36.13,41.463)]
out = {}
for wav, items in ((sys.argv[1], S1), (sys.argv[2], S2)):
    x, sr = load(wav)
    for id_, a, b in items:
        e, h = rms_env(x[int(a*sr):int(b*sr)], sr, 5)
        n = 160
        edges = np.linspace(0, len(e), n + 1).astype(int)
        e = np.array([e[a:max(b, a + 1)].mean() for a, b in zip(edges[:-1], edges[1:])])
        out[id_] = [round(float(v), 3) for v in e / (e.max() + 1e-9)]
open(sys.argv[3], 'w').write("const REF_ENV = " + json.dumps(out, separators=(',', ':')) + ";\n")
print(len(out), 'envelopes')
