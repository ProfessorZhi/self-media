"""Procedural music + sound design for the shot-01 trial (NumPy only, no samples).

Reads the same timing sources as the animation (src/beats.json + src/timing.json), so
every hit lands on its visual beat. The voice is a separate track (public/voice/shot01.mp3);
this bed is ducked under it. Output: public/audio/bed.wav (48 kHz, 16-bit stereo, not in git).
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / 'src' / 'beats.json').read_text())
TIM = json.loads((ROOT / 'src' / 'timing.json').read_text())
SR = 48_000
SHOT0 = CFG['card']['dur'] - CFG['card']['overlap']  # global start of the shot
DUR = SHOT0 + TIM['duration'] + CFG['shotTail']
N = int(DUR * SR) + SR
rng = np.random.default_rng(2)
L = np.zeros(N)
R = np.zeros(N)
LINES = {ln['id']: ln for ln in TIM['lines']}


def beat(name):
    b = CFG['beats'][name]
    t0 = LINES[b['ref']][b['edge']] + b['off']
    return SHOT0 + t0, SHOT0 + t0 + b['dur']


def tt(n):
    return np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start, gain=1.0, pan=0.0):
    i0 = int(max(0, start) * SR)
    sig = sig[: max(0, N - i0)]
    L[i0: i0 + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i0: i0 + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def env(n, a, r, curve=3.0):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na) ** 2
    if nr:
        e[n - nr:] *= np.linspace(1, 0, nr) ** curve
    return e


def band_noise(dur, lo, hi):
    n = int(dur * SR)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= ((f > lo) & (f < hi)).astype(float)
    x = np.fft.irfft(spec, n)
    return x / (np.abs(x).max() + 1e-9)


def swept_noise(dur, f0, f1, q=0.35):
    """Noise through a moving band (frame-wise FFT filter) – a soft 'draw' / whoosh."""
    n = int(dur * SR)
    hop = 1024
    out = np.zeros(n + hop * 2)
    win = np.hanning(hop * 2)
    for k, i in enumerate(range(0, n, hop)):
        fc = f0 * (f1 / f0) ** (i / max(1, n))
        seg = rng.standard_normal(hop * 2) * win
        spec = np.fft.rfft(seg)
        f = np.fft.rfftfreq(hop * 2, 1 / SR)
        spec *= np.exp(-0.5 * ((f - fc) / (fc * q)) ** 2)
        out[i: i + hop * 2] += np.fft.irfft(spec, hop * 2)
    out = out[:n]
    return out / (np.abs(out).max() + 1e-9)


def bell(freq, dur=1.2, bright=0.35):
    t = tt(int(dur * SR))
    x = np.sin(2 * np.pi * freq * t) + bright * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 9)
    return x * np.exp(-t * 4.2) * env(len(t), 0.002, 0.05)


def thump(freq=62, dur=0.7):
    t = tt(int(dur * SR))
    f = freq * (1 + 1.4 * np.exp(-t * 30))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6.5) * env(len(t), 0.003, 0.1)


def tick(freq=1500, dur=0.09):
    t = tt(int(dur * SR))
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 60)


def pad_chord(notes, dur, gain=1.0):
    n = int(dur * SR)
    t = tt(n)
    x = np.zeros(n)
    for i, m in enumerate(notes):
        f = midi(m)
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12 / 4)
            x += np.sin(2 * np.pi * ff * t + i) * (1 + 0.25 * np.sin(2 * np.pi * 0.17 * t + i))
            x += 0.18 * np.sin(2 * np.pi * 2 * ff * t)
    return x / len(notes) * env(n, 1.4, 1.8, 2.0) * gain


# ---------------- music: three warm chords, ducked under the voice ----------------
music = np.zeros(N)
chords = [
    (0.0, SHOT0 + 0.6, [50, 57, 62, 66, 69]),  # Dmaj (card)
    (SHOT0 + 0.2, beat('formula')[0] - SHOT0 + 1.0, [47, 54, 59, 62, 66, 69]),  # Bm9
    (beat('formula')[0] - 0.6, beat('sweep')[0] - beat('formula')[0] + 0.9, [43, 50, 55, 59, 62, 66]),  # Gmaj7
    (beat('sweep')[0] - 0.3, DUR - beat('sweep')[0] + 0.3, [45, 52, 57, 59, 64, 71]),  # Asus2 – unresolved question
]
for start, dur, notes in chords:
    seg = pad_chord(notes, dur + 1.8)
    i0 = int(start * SR)
    music[i0: i0 + len(seg)] += seg[: N - i0]
duck = np.ones(N)
for ln in TIM['lines']:
    a, b = int((SHOT0 + ln['start'] - 0.15) * SR), int((SHOT0 + ln['end'] + 0.25) * SR)
    duck[a:b] = 0.5
k = int(0.25 * SR)
duck = np.convolve(duck, np.ones(k) / k, mode='same')
music *= duck * 0.16
fade = np.ones(N)
fend = int((DUR - 1.2) * SR)
fade[fend:] = np.linspace(1, 0, N - fend) ** 2
add(music * fade, 0, 1.0)

# ---------------- chapter card (global time = card time) ----------------
add(swept_noise(0.45, 1800, 5200), 0.10, 0.06, -0.3)            # black rule wipes in
add(thump(58, 0.9), 0.22, 0.30)                                  # red circle lands
add(bell(midi(74), 1.6, 0.2), 0.24, 0.07, 0.2)
add(swept_noise(0.5, 600, 2400), 0.35, 0.05, 0.3)               # triangle slides up
add(tick(880, 0.12), 0.58, 0.12, -0.2)                           # blue square
add(swept_noise(0.45, 900, 4000), 0.75, 0.05, 0.1)              # diameter draws
for i in range(7):                                               # title characters
    add(tick(2200 + 90 * i, 0.05), 0.5 + i * 0.06, 0.035, -0.4 + 0.12 * i)
sw0 = CFG['card']['dur'] - CFG['card']['overlap']
add(swept_noise(CFG['card']['overlap'] + 0.2, 300, 3800) * env(int((CFG['card']['overlap'] + 0.2) * SR), 0.5, 0.15), sw0 - 0.1, 0.10)
add(thump(46, 1.4), CFG['card']['dur'] - 0.12, 0.22)            # into the night

# ---------------- shot 01 ----------------
def draw(name, f0=700, f1=2600, g=0.05, pan=0.0):
    a, b = beat(name)
    d = max(0.25, b - a)
    add(swept_noise(d, f0, f1) * env(int(d * SR), 0.08, 0.12), a, g, pan)

add(bell(midi(81), 1.4), beat('A_pop')[0], 0.06)
draw('AB_draw', 600, 2400, 0.05, 0.3)
add(bell(midi(88), 1.0), beat('AB_draw')[1], 0.05, 0.4)
draw('AC_draw', 500, 3000, 0.05, -0.1)
add(bell(midi(86), 1.0), beat('AC_draw')[1], 0.04, -0.1)
add(tick(1200, 0.1), beat('right_angle')[0], 0.08)
add(bell(midi(76), 1.6, 0.15), beat('D_pop')[0], 0.07, -0.3)
draw('AD_draw', 700, 2200, 0.045, -0.2)
draw('CD_draw', 900, 2000, 0.03, -0.3)
draw('proj_shadow', 300, 900, 0.06, -0.2)
add(thump(90, 0.4), beat('proj_shadow')[1], 0.08)
draw('dist_draw', 300, 1100, 0.05, -0.2)
fa = beat('formula')[0]
for m, dt in ((81, 0.0), (88, 0.07)):
    add(bell(midi(m), 2.0, 0.1), fa + dt, 0.045, 0.4)
add(swept_noise(0.6, 2500, 7000), beat('formula_morph')[0], 0.035, 0.4)
add(bell(midi(83), 1.6, 0.1), beat('formula_morph')[1] - 0.1, 0.05, 0.4)
s0, s1 = beat('sweep')
n = int((s1 - s0) * SR)
t = tt(n)
f = midi(69) * 2 ** (np.linspace(0, 5, n) / 12)  # slow rising glide while D slides left
glide = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.6, 0.6) * 0.5
add(glide + 0.3 * swept_noise(s1 - s0, 400, 1400), s0, 0.05, -0.3)
q0 = beat('question')[0]
add(bell(midi(83), 2.2, 0.2), q0, 0.06, -0.5)
add(bell(midi(88), 2.2, 0.2), q0 + 0.18, 0.05, -0.5)

# ---------------- master ----------------
st = np.stack([L, R], axis=1)[: int(DUR * SR)]
peak = np.abs(st).max()
st = st / peak * 10 ** (-6 / 20) if peak > 10 ** (-6 / 20) else st
out = ROOT / 'public' / 'audio'
out.mkdir(parents=True, exist_ok=True)
with wave.open(str(out / 'bed.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype('<i2').tobytes())
print(f'bed.wav {DUR:.2f}s peak {20 * np.log10(np.abs(st).max()):.1f} dBFS')
