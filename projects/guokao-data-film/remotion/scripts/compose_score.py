"""Original procedural score — melancholic version (no samples, no third-party audio).

Slow minor progression (i–VI–iv–V), warm pads, a soft piano-like arpeggio that keeps the
film's pulse, a cello-like melody with vibrato for the quiet moments, and a long reverb.
Sound effects sit on the film's own cues. Timing comes from src/timeline.json, the same
file src/Film.tsx checks itself against.
Output: public/score.wav (48 kHz, 16-bit stereo).
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'src' / 'timeline.json').read_text())
SR = 48_000
FPS = TL['fps']
K = TL['slow']

# global start frame and length of each block, in film frames
OFF, LEN = {}, {}
cur = 0
for i, name in enumerate(TL['order']):
    n = TL[name] if name in ('prologue', 'epilogue') else round(TL['actLocal'][name] * K)
    if i and name not in TL['seamless']:
        cur -= TL['crossfade']  # cross-dissolve overlap, as in src/Film.tsx
    OFF[name], LEN[name] = cur, n
    cur += n
TOTAL_FRAMES = cur
DUR = TOTAL_FRAMES / FPS
N = int(DUR * SR) + SR
rng = np.random.default_rng(2027)
L = np.zeros(N)
R = np.zeros(N)


def at(block, local_frame=0):
    """Seconds for a local frame inside a block (acts are slowed by K)."""
    k = 1 if block in ('prologue', 'epilogue') else K
    return (OFF[block] + local_frame * k) / FPS


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start_s, gain=1.0, pan=0.0):
    i0 = int(start_s * SR)
    if i0 >= N or gain == 0:
        return
    sig = sig[: N - i0]
    L[i0 : i0 + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i0 : i0 + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def env_ar(n, attack, release):
    e = np.ones(n)
    a, r = min(n, int(attack * SR)), min(n, int(release * SR))
    if a:
        e[:a] = np.linspace(0, 1, a) ** 1.6
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 1.6
    return e


def pad_voice(freq, dur, detune=0.0025):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for d in (-detune, 0.0, detune):
        for h in range(1, 6):
            s += np.sin(2 * np.pi * freq * (1 + d) * h * t + rng.uniform(0, 6.28)) / h**2.5
    return s / 3


def piano(freq, dur=2.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 6)
         + 0.08 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t * 10))
    return s * np.exp(-t * 2.2) * env_ar(n, 0.006, 0.3)


def cello(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.8, 0, 1)
    phase = 2 * np.pi * freq * np.cumsum(vib) / SR
    s = sum(np.sin(h * phase) / h**1.4 for h in range(1, 8))
    return s * env_ar(n, 0.45, min(1.2, dur * 0.4)) * 0.6


def felt(freq, dur=3.5):
    """Low, soft struck tone (replaces bright bells)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) * np.exp(-t * 1.2) + 0.3 * np.sin(2 * np.pi * 2.01 * freq * t) * np.exp(-t * 2.5)
    return s * env_ar(n, 0.01, 0.4)


def smooth(x, k):
    k = max(1, int(k))
    c = np.cumsum(np.concatenate([[0], x]))
    y = (c[k:] - c[:-k]) / k
    return np.concatenate([y, np.full(k - 1, y[-1])])


def swell(dur=3.0, up=True):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    s = smooth(rng.standard_normal(n), 60) * np.sin(np.pi * t) ** 2
    return s * 1.4


def impact(dur=4.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 55 * np.exp(-t * 1.5) + 34
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.1) * env_ar(n, 0.02, 0.5)


def tick(freq=900, dur=0.08):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 60)


# ---------------------------------------------------------------- harmony plan
CH = {
    'Am': [45, 57, 60, 64, 71],
    'F': [41, 53, 57, 60, 64],
    'Dm': [38, 53, 57, 62, 65],
    'E': [40, 52, 56, 59, 64],
    'Esus': [40, 52, 57, 59, 64],
    'C': [36, 52, 55, 60, 64],
    'G': [43, 50, 55, 59, 62],
    'Am9': [33, 57, 60, 64, 71],
}
# melody: two notes per chord (one per bar), in A minor
MEL = {'Am': [76, 72], 'F': [69, 72], 'Dm': [74, 77], 'E': [71, 68], 'Esus': [71, 69], 'C': [67, 64], 'G': [71, 74], 'Am9': [69, 69]}
BAR = 4 * 60 / 63
SPAN = 2 * BAR
main = ['Am', 'F', 'Dm', 'E']
dark = ['Dm', 'Am', 'F', 'E']
ending = ['F', 'G', 'Am', 'Esus', 'F', 'G', 'Am9', 'Am9']
dark_from, dark_to = at('act5'), at('act7') + LEN['act7'] / FPS
end_from = at('act6', 600)

plan = []
t = 0.0
while t < DUR:
    if t >= end_from:
        name = ending[min(int((t - end_from) / SPAN), len(ending) - 1)]
    elif dark_from <= t < dark_to:
        name = dark[int((t - dark_from) / SPAN) % 4]
    else:
        name = main[int(t / SPAN) % 4]
    plan.append((t, name))
    t += SPAN


def chord_at(ts):
    return [c for s, c in plan if s <= ts][-1]


# intensity of the bed through the film (0..1)
def intensity(ts):
    pts = [
        (0, 0.0), (2, 0.25), (at('act1'), 0.35), (at('act1', 250), 0.55), (at('act2'), 0.7),
        (at('act3') - 1, 0.75), (at('act3'), 0.5), (at('act4'), 0.65), (at('act5') - 1, 0.75),
        (at('act5'), 0.45), (at('act7'), 0.4), (at('act6'), 0.5), (at('act6', 600), 0.85),
        (at('epilogue', 200), 0.6), (DUR - 4, 0.45), (DUR, 0.0),
    ]
    xs, ys = zip(*pts)
    return np.interp(ts, xs, ys)


for start, name in plan:
    dur = SPAN + 3.0
    for i, m in enumerate(CH[name]):
        add(pad_voice(midi(m), dur) * env_ar(int(dur * SR), 2.2, 3.0), start, 0.055 if i == 0 else 0.03, pan=-0.45 + i * 0.22)

# piano arpeggio keeps the pulse (eighth notes), softer and sparser in quiet blocks
zones = [
    (at('act1', 200), at('act2') + LEN['act2'] / FPS - 1, 1.0),
    (at('act3'), at('act4') + LEN['act4'] / FPS - 1, 0.8),
    (at('act5'), at('act7') + LEN['act7'] / FPS - 1, 0.55),
    (at('act6'), DUR - 6, 0.75),
]
step = BAR / 8
pat = [0, 2, 3, 1, 4, 3, 2, 1]
for z0, z1, g in zones:
    tt, k = z0, 0
    while tt < z1:
        notes = CH[chord_at(tt)][1:]
        m = notes[pat[k % 8] % len(notes)] + 12
        fade_in = min(1, (tt - z0) / 4, (z1 - tt) / 3)
        accent = 1.0 if k % 8 == 0 else 0.75
        add(piano(midi(m)), tt, 0.04 * g * fade_in * accent, pan=0.3 if k % 2 else -0.3)
        tt += step
        k += 1

# cello melody for the quiet, human moments
mel_zones = [(0.8, at('act1', 200)), (at('act7', 700), at('act7') + LEN['act7'] / FPS), (at('act6', 560), DUR - 2)]
for z0, z1 in mel_zones:
    for start, name in plan:
        for j, m in enumerate(MEL[name]):
            s0 = start + j * BAR
            if s0 < z0 - 0.01 or s0 + 0.5 > z1:
                continue
            add(cello(midi(m - 12), BAR * 1.05), s0, 0.05, pan=0.1)

# shape the bed
bed = intensity(np.arange(N) / SR)
L *= bed
R *= bed

# ---------------------------------------------------------------- effects on cues (soft, low)
add(felt(midi(57)), at('act1', 4), 0.12)
add(swell(4.5), at('act1', 24), 0.05)
for i in range(3):
    add(felt(midi([57, 55, 52][i])), at('act1', 420 + i * 18), 0.08, pan=-0.3 + 0.3 * i)
add(swell(5.0), at('act1', 600), 0.05)
add(impact(), at('act2'), 0.22)
add(swell(4.0), at('act2', 18), 0.05)
add(swell(4.0), at('act2', 196), 0.05)
for k in range(7):
    add(felt(midi([52, 50, 48, 50, 47, 45, 43][k])), at('act2', 436 + k * 140), 0.07, pan=0.45 - 0.15 * k)
add(swell(4.0), at('act2', 1446), 0.05)
for k in range(10):
    add(tick(700 + 30 * k), at('act3', 70 + k * 9), 0.035, pan=-0.6 + 0.12 * k)
add(swell(3.0), at('act3', 330), 0.04)
for k in range(31):
    add(tick(800 + (k % 5) * 40, 0.06), at('act3', 660 + k * 3), 0.02, pan=-0.5 + k / 31)
add(swell(5.0), at('act4', 80), 0.05)
add(swell(5.0), at('act4', 220), 0.05)
add(impact(), at('act4', 440), 0.12)
add(swell(6.0), at('act4', 700), 0.05)
add(felt(midi(45), 5), at('act4', 840), 0.1)
add(impact(), at('act5', 340), 0.2)
add(felt(midi(40), 5), at('act5', 344), 0.08)
add(swell(4.0), at('act7', 340), 0.04)
for k in range(7):
    add(tick(1100, 0.05), at('act6', 66 + k * 8), 0.05)
add(felt(midi(38), 6), at('act6', 140), 0.14)
add(swell(5.0), at('act6', 330), 0.05)
add(felt(midi(45), 5), at('act6', 450), 0.08)

# ---------------------------------------------------------------- long reverb + master
st = np.stack([L, R], axis=1)[: int(DUR * SR)]
ir_len = int(3.2 * SR)
tt = np.arange(ir_len) / SR
wet = np.zeros_like(st)
size = 1 << int(np.ceil(np.log2(len(st) + ir_len)))
for ch in range(2):
    ir = smooth(rng.standard_normal(ir_len), 6) * np.exp(-tt * 2.1)
    ir[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    ir /= np.sqrt((ir**2).sum())
    wet[:, ch] = np.fft.irfft(np.fft.rfft(st[:, ch], size) * np.fft.rfft(ir, size), size)[: len(st)]
st = 0.72 * st + 0.42 * wet
st /= np.abs(st).max()
st = np.tanh(st * 2.6) / np.tanh(2.6)
st /= max(1e-9, np.abs(st).max()) / 0.89
fade = int(4 * SR)
st[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
rms = np.sqrt((st**2).mean())
out = ROOT / 'public' / 'score.wav'
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print(f'wrote {out} · {DUR:.1f}s ({TOTAL_FRAMES} frames) · peak {np.abs(st).max():.2f} · rms {20 * np.log10(rms):.1f} dBFS')
