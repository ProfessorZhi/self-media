"""Original procedural score for the film (no samples, no third-party audio).

Pads + soft arpeggio follow a fixed chord plan; sound effects are placed on the
film's own frame cues (30 fps, global frame numbers from src/Film.tsx offsets).
Output: public/score.wav (48 kHz, 16-bit stereo).
"""
import wave
from pathlib import Path

import numpy as np

SR = 48_000
FPS = 30
TOTAL_FRAMES = 5306  # src/Film.tsx FILM_LENGTH
DUR = TOTAL_FRAMES / FPS
N = int(DUR * SR) + SR
rng = np.random.default_rng(2027)
t_all = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)

# act offsets (frames) — keep in sync with src/Film.tsx
ACT = [0, 780, 1796, 2756, 3806, 4586]


def f2s(frame):
    return frame / FPS


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start_s, gain=1.0, pan=0.0):
    i0 = int(start_s * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0]
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[i0 : i0 + len(sig)] += sig * gl
    R[i0 : i0 + len(sig)] += sig * gr


def env_ar(n, attack, release):
    e = np.ones(n)
    a = min(n, int(attack * SR))
    r = min(n, int(release * SR))
    if a:
        e[:a] = np.linspace(0, 1, a) ** 1.5
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e


def pad_voice(freq, dur, detune=0.003):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for d in (-detune, 0.0, detune):
        f = freq * (1 + d)
        for h in range(1, 7):
            s += np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28)) / (h * h)
    return s / 3


def pluck(freq, dur=1.2, bright=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + bright * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 9)
    return s * np.exp(-t * 4.5) * env_ar(n, 0.004, 0.05)


def bell(freq, dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, decay in ((1, 1, 1.6), (2.76, 0.45, 2.6), (5.4, 0.25, 4.0), (8.93, 0.12, 6.0)):
        s += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t * decay)
    return s * env_ar(n, 0.002, 0.2)


def smooth(x, k):
    k = max(1, int(k))
    c = np.cumsum(np.concatenate([[0], x]))
    y = (c[k:] - c[:-k]) / k
    return np.concatenate([y, np.full(k - 1, y[-1])])


def whoosh(dur=2.2, up=True):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    a = smooth(noise, 40)
    b = smooth(noise, 8)
    mix = (t if up else 1 - t)
    s = a * (1 - mix) + b * mix * 0.6
    shape = np.sin(np.pi * t) ** 2
    return s * shape * 0.9


def riser(dur=3.0):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    s = smooth(rng.standard_normal(n), 10) * t**2
    s += 0.3 * np.sin(2 * np.pi * (220 + 660 * t**2) * np.arange(n) / SR) * t**2
    return s * env_ar(n, 0.01, 0.08)


def impact(dur=2.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 70 * np.exp(-t * 2.5) + 38
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.8)
    s += smooth(rng.standard_normal(n), 30) * np.exp(-t * 7) * 0.6
    return s


def tick(freq=2400, dur=0.06):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 90)


# ---------------------------------------------------------------- chord plan
A3, C4, D4, E4, F3, G3 = 57, 60, 62, 64, 53, 55
CH = {
    'Am9': [45, 57, 60, 64, 71],
    'Fmaj7': [41, 53, 57, 60, 64],
    'C': [48, 55, 60, 64, 67],
    'Gsus': [43, 55, 60, 62, 67],
    'Dm9': [38, 53, 57, 62, 64],
    'Em7': [40, 55, 59, 62, 67],
    'Cmaj9': [36, 55, 59, 62, 64],
}
BAR = 3.2  # 75 bpm, 4/4
plan = []
seq_main = ['Am9', 'Fmaj7', 'C', 'Gsus']
seq_scores = ['Dm9', 'Am9', 'Dm9', 'Em7']
seq_end = ['Fmaj7', 'Gsus', 'Am9', 'Cmaj9']
t = 0.0
while t < DUR:
    if t < f2s(ACT[4]):
        name = seq_main[int(t / (2 * BAR)) % 4]
    elif t < f2s(ACT[5]):
        name = seq_scores[int((t - f2s(ACT[4])) / (2 * BAR)) % 4]
    else:
        k = int((t - f2s(ACT[5])) / (2 * BAR))
        name = seq_end[min(k, 3)]
    plan.append((t, name))
    t += 2 * BAR

# intensity curve per act (0..1): quiet hook, fuller middle, resolved ending
def intensity(ts):
    pts = [
        (0, 0.0), (3, 0.35), (f2s(196), 0.55), (f2s(ACT[1]), 0.7), (f2s(ACT[2]) - 1, 0.8),
        (f2s(ACT[2]), 0.55), (f2s(ACT[3]), 0.7), (f2s(ACT[4]) - 1, 0.85), (f2s(ACT[4]), 0.5),
        (f2s(ACT[5]) - 1, 0.7), (f2s(ACT[5]), 0.5), (f2s(5186), 0.9), (DUR - 2.5, 0.8), (DUR, 0.0),
    ]
    xs, ys = zip(*pts)
    return np.interp(ts, xs, ys)


inten = intensity(t_all)

# pads
for start, name in plan:
    dur = 2 * BAR + 2.0
    for i, m in enumerate(CH[name]):
        v = pad_voice(midi(m), dur) * env_ar(int(dur * SR), 1.6, 2.2)
        gain = 0.05 if i == 0 else 0.032
        add(v, start, gain, pan=(-0.5 + i * 0.25))
    # sub
    n = int(dur * SR)
    sub = np.sin(2 * np.pi * midi(CH[name][0] - 12 + 12) * np.arange(n) / SR) * env_ar(n, 1.0, 2.0)
    add(sub, start, 0.05)

# arpeggio in busy sections (acts II and IV, and the closing)
arp_zones = [(f2s(ACT[1]) + 2, f2s(ACT[2]) - 1), (f2s(ACT[3]) + 1, f2s(ACT[4]) - 1), (f2s(5186), DUR - 3)]
step = BAR / 8
for z0, z1 in arp_zones:
    tt = z0
    k = 0
    while tt < z1:
        name = [c for s, c in plan if s <= tt][-1]
        notes = CH[name][1:] + [CH[name][2] + 12]
        pat = [0, 2, 1, 3, 4, 3, 1, 2]
        m = notes[pat[k % 8] % len(notes)] + 12
        fade_in = min(1, (tt - z0) / 3, (z1 - tt) / 2)
        add(pluck(midi(m)), tt, 0.035 * fade_in, pan=0.35 if k % 2 else -0.35)
        tt += step
        k += 1

# apply intensity to music bed
L *= inten
R *= inten

# ---------------------------------------------------------------- sound effects on cues
G = lambda act, frame: f2s(ACT[act] + frame)
add(bell(midi(81), 3), G(0, 4), 0.08)                      # one seat appears
add(whoosh(3.6, up=False), G(0, 24), 0.12)                 # applicants swirl in
for i in range(3):
    add(bell(midi([76, 79, 83][i]), 2.5), G(0, 420 + i * 18), 0.06, pan=-0.3 + 0.3 * i)  # ratio badges
add(riser(4.0), G(0, 600), 0.07)                           # 2027 field fills
add(impact(), G(1, 0), 0.22)                               # into Act II
add(whoosh(3.0), G(1, 18), 0.14)                           # spiral into sunburst
add(whoosh(3.0), G(1, 196), 0.14)                          # unroll to treemap
for k in range(4):
    add(bell(midi([69, 72, 76, 74][k]), 2.2), G(1, 406 + k * 100), 0.05, pan=0.4 - 0.25 * k)  # tour stops
add(bell(midi(88), 3.5), G(1, 606), 0.06)                  # 边检 reconciles ✓
add(whoosh(3.0, up=False), G(1, 816), 0.12)                # Pareto
for k in range(10):
    add(tick(1800 + 90 * k), G(2, 70 + k * 9), 0.05, pan=-0.6 + 0.12 * k)  # dumbbells
add(whoosh(2.0), G(2, 330), 0.08)
for k in range(31):
    add(tick(2600 + (k % 5) * 120, 0.04), G(2, 660 + k * 3), 0.03, pan=-0.5 + k / 31)  # tiles
add(whoosh(2.5), G(3, 0), 0.1)
add(whoosh(4.5), G(3, 80), 0.1)                            # Sankey flows
add(whoosh(4.5), G(3, 220), 0.1)
add(impact(), G(3, 440), 0.12)                             # 1-person positions
add(riser(4.5), G(3, 700), 0.08)                           # words assemble
add(bell(midi(84), 4), G(3, 840), 0.07)
for k in range(24):
    add(tick(1500 + rng.uniform(0, 1500), 0.05), G(4, 60 + k * 7), 0.025, pan=rng.uniform(-0.7, 0.7))  # scores rain
add(impact(), G(4, 340), 0.2)                              # spotlight 153.7
add(bell(midi(91), 3.5), G(4, 344), 0.05)
for k in range(7):
    add(tick(3200, 0.03), G(5, 66 + k * 8), 0.07)          # typing 030101K
s = bell(midi(62), 5.0)
add(s, G(5, 140), 0.12)                                    # sonar ripple
add(riser(4.0), G(5, 330), 0.08)                           # dive
add(bell(midi(76), 4), G(5, 450), 0.06)                    # the row opens
add(bell(midi(72), 6), G(5, 630), 0.07)                    # closing chord accent

# ---------------------------------------------------------------- master
st = np.stack([L, R], axis=1)[: int(DUR * SR)]
# tiny stereo widening: Haas delay on the right channel
d = int(0.012 * SR)
st[d:, 1] = 0.85 * st[d:, 1] + 0.15 * st[:-d, 0]
st = np.tanh(st * 1.6) / np.tanh(1.6)
st /= max(1e-9, np.abs(st).max()) / 0.89
rms = np.sqrt((st**2).mean())
fade = int(2.5 * SR)
st[-fade:] *= np.linspace(1, 0, fade)[:, None]
out = Path(__file__).resolve().parent.parent / 'public' / 'score.wav'
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'wrote {out} · {DUR:.1f}s · peak {np.abs(st).max():.2f} · rms {20 * np.log10(rms):.1f} dBFS')
