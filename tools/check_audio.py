"""Sanity checks on rendered WAVs: clipping, DC, edge clicks, loop seam, and a 'fart' screen
(low-band energy share, low-band noisiness, downward low pitch glides)."""
import sys, os, glob, wave
import numpy as np

def load(p):
    with wave.open(p) as w:
        sr = w.getframerate()
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768, sr

def low_stats(x, sr):
    n = 1 << int(np.ceil(np.log2(len(x))))
    F = np.abs(np.fft.rfft(x * np.hanning(len(x)), n)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    share = float(F[f < 150].sum() / (F.sum() + 1e-12))
    m = (f >= 40) & (f <= 250)
    P = F[m] + 1e-18
    flat = float(np.exp(np.log(P).mean()) / P.mean())
    return share, flat

def glide(x, sr):
    """largest drop (in %) of the dominant 40-250 Hz partial across consecutive 100 ms frames that are loud enough"""
    w = int(0.1 * sr); peaks = []
    for i in range(0, len(x) - w, w // 2):
        s = x[i:i + w] * np.hanning(w)
        n = 1 << 15
        F = np.abs(np.fft.rfft(s, n)); f = np.fft.rfftfreq(n, 1 / sr)
        m = (f >= 40) & (f <= 250)
        e = float((F[m] ** 2).sum()); tot = float((F ** 2).sum()) + 1e-12
        peaks.append((f[m][np.argmax(F[m])], e / tot, float(np.sqrt((s ** 2).mean()))))
    mx = max(p[2] for p in peaks) + 1e-9
    worst = 0.0
    run = 0
    for a, b in zip(peaks, peaks[1:]):
        if a[1] > 0.4 and b[1] > 0.4 and a[2] > 0.1 * mx and b[2] > 0.1 * mx and b[0] < a[0] * 0.98:
            run += 1; worst = max(worst, (1 - b[0] / a[0]) * 100)
        else:
            run = 0
    return worst

if __name__ == '__main__':
    bad = 0
    print(f"{'file':14s} {'peak':>5s} {'dc':>6s} {'edge0':>6s} {'edgeN':>6s} {'<150Hz':>7s} {'lowflat':>8s} {'glide%':>7s}  flags")
    for d, loop in ((sys.argv[1], False), (sys.argv[2], True)):
        for p in sorted(glob.glob(os.path.join(d, '*.wav'))):
            x, sr = load(p)
            peak = float(np.abs(x).max()); dc = float(x.mean())
            e0, eN = abs(float(x[0])), abs(float(x[-1]))
            share, flat = low_stats(x, sr)
            gl = 0.0 if loop else glide(x, sr)   # loops hold fixed note pitches; only one-shots can glide
            flags = []
            if peak > 0.97: flags.append('CLIP')
            if abs(dc) > 0.01: flags.append('DC')
            if loop:
                seam = abs(float(x[0] - x[-1])); step = float(np.abs(np.diff(x)).mean()) * 8 + 0.02
                if seam > step: flags.append(f'SEAM {seam:.3f}')
                # largest sample jump within +-2 ms of the wrap point vs the loop's own 99.9th percentile jump
                xx = np.concatenate([x, x]); w = int(0.002 * sr); d = np.abs(np.diff(xx))
                if d[len(x) - w:len(x) + w].max() > 3 * np.percentile(d, 99.9) + 0.01: flags.append('SEAM-JUMP')
                if abs(float(x[0])) > 0.05: flags.append('FIRST!=0 (needs fade-in on playback)')
            else:
                if e0 > 0.01 or eN > 0.01: flags.append('EDGE')
            if share > 0.3 and flat > 0.25: flags.append('NOISY-LOW')   # lots of low energy that is noise rather than a tone
            if gl > 12: flags.append('LOW-GLIDE-DOWN')
            bad += bool([f for f in flags if not f.startswith('FIRST')])
            print(f"{os.path.basename(p):14s} {peak:5.2f} {dc:6.3f} {e0:6.3f} {eN:6.3f} {share:7.2f} {flat:8.2f} {gl:7.1f}  {' '.join(flags)}")
    print('flagged:', bad)
