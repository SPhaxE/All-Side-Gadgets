"""Segment and describe a reference-video audio track (RMS envelope, centroid, spectrogram)."""
import sys, json, wave
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def load(path):
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x, sr

def rms_env(x, sr, hop_ms=10):
    h = int(sr * hop_ms / 1000)
    n = len(x) // h
    return np.sqrt((x[: n * h].reshape(n, h) ** 2).mean(1)), h

def spec(x, sr, n=1024, hop=256):
    w = np.hanning(n)
    f = np.array([np.abs(np.fft.rfft(x[i:i + n] * w)) for i in range(0, len(x) - n, hop)])
    return f, hop

if __name__ == "__main__":
    path, out = sys.argv[1], sys.argv[2]
    x, sr = load(path)
    env, h = rms_env(x, sr)
    f, hop = spec(x, sr)
    fig, ax = plt.subplots(2, 1, figsize=(18, 8), sharex=True)
    t = np.arange(len(env)) * h / sr
    ax[0].plot(t, env); ax[0].set_ylabel("rms"); ax[0].grid(True)
    ax[0].set_xticks(np.arange(0, t[-1], 1))
    S = 20 * np.log10(f.T + 1e-6)
    ax[1].imshow(S, origin="lower", aspect="auto", extent=[0, len(x) / sr, 0, sr / 2], vmin=S.max() - 80, cmap="magma")
    ax[1].set_ylim(0, 8000); ax[1].set_ylabel("Hz")
    plt.tight_layout(); plt.savefig(out, dpi=70)
    print("dur", len(x) / sr, "rms max", env.max())
