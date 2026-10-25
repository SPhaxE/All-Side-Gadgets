"""Compare rendered WAVs with the reference-video audio: spectrogram + RMS envelope side by side, plus band-share metrics."""
import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from analyze_ref import *

BANDS = [(0, 100), (100, 200), (200, 500), (500, 1000), (1000, 4000), (4000, 11025)]

def band_share(x, sr):
    n = 1 << int(np.ceil(np.log2(max(len(x), 1024))))
    F = np.abs(np.fft.rfft(x * np.hanning(len(x)), n)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    tot = F.sum() + 1e-12
    return [float(F[(f >= a) & (f < b)].sum() / tot) for a, b in BANDS]

def env_norm(x, sr, nbins=80):
    e, h = rms_env(x, sr, 5)
    e = np.interp(np.linspace(0, len(e) - 1, nbins), np.arange(len(e)), e)
    return e / (e.max() + 1e-9)

def resample(x, sr_from, sr_to):
    if sr_from == sr_to: return x
    n = int(len(x) * sr_to / sr_from)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)

def compare(ref_wav, items, mine_dir, out_png, fmax=8000, ncols=2):
    rx, rsr = load(ref_wav)
    rows = (len(items) + ncols - 1) // ncols
    fig, axs = plt.subplots(rows * 3, ncols, figsize=(8 * ncols, 3.4 * rows * 3 / 1.15),
                            gridspec_kw={'height_ratios': [0.8, 1.6, 1.6] * rows}, squeeze=False)
    for k, (id_, name, t0, t1) in enumerate(items):
        r, c = divmod(k, ncols)
        seg = rx[int(t0 * rsr):int(t1 * rsr)]
        mx, msr = load(os.path.join(mine_dir, id_ + '.wav'))
        mx = resample(mx, msr, rsr)
        e1 = env_norm(seg, rsr); e2 = env_norm(mx, rsr)
        corr = max(float(np.corrcoef(np.roll(e1, l), e2)[0, 1]) for l in range(-2, 3))
        b1 = band_share(seg, rsr); b2 = band_share(mx, rsr)
        print(f"{id_:12s} dur ref {t1 - t0:.2f}s mine {len(mx) / rsr:.2f}s  env-corr {corr:+.2f}")
        print("   ref bands", [round(v, 2) for v in b1])
        print("  mine bands", [round(v, 2) for v in b2])
        a0 = axs[r * 3, c]; a0.plot(np.linspace(0, 1, len(e1)), e1, label='ref'); a0.plot(np.linspace(0, 1, len(e2)), e2, label='mine'); a0.set_title(f"{name}  env-corr {corr:+.2f}"); a0.legend(loc='upper right')
        for j, (x, lab) in enumerate([(seg, 'ref'), (mx, 'mine')]):
            f, hop = spec(x, rsr, n=512, hop=96)
            S = 20 * np.log10(f.T + 1e-6)
            ax = axs[r * 3 + 1 + j, c]
            ax.imshow(S, origin='lower', aspect='auto', extent=[0, len(x) / rsr, 0, rsr / 2], vmin=S.max() - 70, cmap='magma')
            ax.set_ylim(0, fmax); ax.set_ylabel(lab)
    plt.tight_layout(); plt.savefig(out_png, dpi=55); plt.close()

if __name__ == '__main__':
    ref, mine, out = sys.argv[1], sys.argv[2], sys.argv[3]
    items = json.loads(sys.argv[4])
    compare(ref, items, mine, out, int(sys.argv[5]) if len(sys.argv) > 5 else 8000)
