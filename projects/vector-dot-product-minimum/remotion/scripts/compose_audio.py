"""Procedural music + sound design for the full film (NumPy only, no samples).

Reads the same timing sources as the animation: src/timing.json (segments + voice lines),
src/cards.json (card shapes and their entry times) and src/beats/<shot>.json (every beat
tagged with an "sfx"). Music: a warm pad that moves chapter by chapter plus a soft pluck
pulse, ducked under the voice. Output: public/audio/bed.wav (48 kHz, 16-bit stereo, not in git).
"""
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
TIM = json.loads((ROOT / 'src' / 'timing.json').read_text())
CARDS = json.loads((ROOT / 'src' / 'cards.json').read_text())
SR = 48_000
DUR = TIM['duration']
N = int(DUR * SR) + SR
rng = np.random.default_rng(2)
L = np.zeros(N)
R = np.zeros(N)
LINES = {ln['id']: ln for s in TIM['segments'] for ln in s.get('lines', [])}
CARD = TIM['card']


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


def swept_noise(dur, f0, f1, q=0.35):
    n = max(1, int(dur * SR))
    hop = 1024
    out = np.zeros(n + hop * 2)
    win = np.hanning(hop * 2)
    f = np.fft.rfftfreq(hop * 2, 1 / SR)
    for i in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (i / n)
        spec = np.fft.rfft(rng.standard_normal(hop * 2) * win)
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
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5) * env(len(t), 0.003, 0.1)


def tick(freq=1500, dur=0.09):
    t = tt(int(dur * SR))
    return np.sin(2 * np.pi * freq * t) * np.exp(-t * 60)


def pluck(freq, dur=0.9):
    t = tt(int(dur * SR))
    x = sum((0.6 ** k) * np.sin(2 * np.pi * freq * (k + 1) * t) * np.exp(-t * (3 + 2.5 * k)) for k in range(4))
    return x * env(len(t), 0.004, 0.2)


def pad_chord(notes, dur):
    n = int(dur * SR)
    t = tt(n)
    x = np.zeros(n)
    for i, m in enumerate(notes):
        f = midi(m)
        for det in (-0.1, 0.1):
            ff = f * 2 ** (det / 48)
            x += np.sin(2 * np.pi * ff * t + i) * (1 + 0.25 * np.sin(2 * np.pi * 0.17 * t + i))
            x += 0.16 * np.sin(2 * np.pi * 2 * ff * t)
    return x / len(notes) * env(n, 1.6, 2.0, 2.0)


def glide(dur, m0=69, semis=5):
    n = int(dur * SR)
    f = midi(m0) * 2 ** (np.linspace(0, semis, n) / 12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.5, 0.5) * 0.5 + 0.25 * swept_noise(dur, 400, 1400)


def sfx(kind, t0, dur, pan=0.0):
    if kind == 'draw':
        d = max(0.25, dur)
        add(swept_noise(d, 600, 2600) * env(int(d * SR), 0.08, 0.12), t0, 0.05, pan)
    elif kind.startswith('bell:'):
        add(bell(midi(int(kind[5:])), 1.5, 0.2), t0, 0.06, pan)
    elif kind == 'tick':
        add(tick(1250, 0.1), t0, 0.08, pan)
    elif kind == 'pop':
        add(tick(900, 0.12), t0, 0.1, pan)
        add(bell(midi(84), 0.8, 0.1), t0, 0.03, pan)
    elif kind == 'thump':
        add(thump(80, 0.5), t0, 0.12, pan)
    elif kind == 'chime':
        add(bell(midi(81), 2.0, 0.1), t0, 0.05, pan)
        add(bell(midi(88), 2.0, 0.1), t0 + 0.08, 0.045, pan)
    elif kind == 'whoosh':
        d = max(0.4, dur)
        add(swept_noise(d, 2000, 6500) * env(int(d * SR), 0.15, 0.2), t0, 0.04, pan)
    elif kind == 'glide':
        add(glide(max(0.8, dur)), t0, 0.05, pan)
    elif kind == 'stamp':
        add(thump(110, 0.35), t0, 0.1, pan)
        add(bell(midi(86), 1.6, 0.25), t0, 0.05, pan)
    elif kind == 'boom':
        add(thump(52, 1.4), t0, 0.22)
        add(bell(midi(74), 2.6, 0.2), t0, 0.05, -0.2)
        add(bell(midi(81), 2.6, 0.2), t0 + 0.05, 0.04, 0.2)
    elif kind.startswith('ticks'):
        k = int(kind[5:])
        for i in range(k):
            add(tick(1500 + 120 * i, 0.08), t0 + i * min(0.22, dur / k), 0.07, -0.5 + i / max(1, k - 1))


# ---------------- music ----------------
CHORDS = {
    'hook': [47, 54, 59, 62, 66, 69], 'title': [50, 57, 62, 66, 69, 74], 'c1': [43, 50, 55, 59, 62, 66],
    'c2': [40, 47, 52, 55, 59, 62], 'c3': [45, 52, 57, 61, 64, 69], 'c4': [42, 49, 54, 57, 61, 66],
    'c5': [43, 50, 55, 59, 62, 66], 'c6': [40, 47, 52, 55, 59, 62], 'c7': [38, 45, 50, 54, 57, 62, 66],
    'end': [38, 45, 50, 54, 57, 64, 66],
}
music = np.zeros(N)
segs = TIM['segments']
for i, s in enumerate(segs):
    chord = CHORDS[s['id'].replace('card', '')]
    start = max(0, s['start'] - 0.8)
    length = s['end'] - start + 2.2
    seg = pad_chord(chord, length)
    i0 = int(start * SR)
    music[i0: i0 + len(seg)] += seg[: N - i0]
    if s['kind'] == 'shot':  # soft pluck pulse, 92 bpm eighths, chord tones up an octave
        step = 60 / 92 / 2
        k = 0
        tcur = s['start'] + 0.6
        while tcur < s['end'] - 0.4:
            m = chord[(k * 3) % len(chord)] + 12
            p = pluck(midi(m))
            j = int(tcur * SR)
            music[j: j + len(p)] += p[: N - j] * (0.55 if k % 4 == 0 else 0.35)
            tcur += step
            k += 1
duck = np.ones(N)
for ln in LINES.values():
    a, b = int((ln['start'] - 0.15) * SR), int((ln['end'] + 0.25) * SR)
    duck[a:b] = 0.5
k = int(0.25 * SR)
duck = np.convolve(duck, np.ones(k) / k, mode='same')
fade = np.ones(N)
fend = int((DUR - 1.4) * SR)
fade[fend:] = np.linspace(1, 0, N - fend) ** 2
fade[: int(1.0 * SR)] = np.linspace(0, 1, int(1.0 * SR))
add(music * duck * fade * 0.14, 0)

# ---------------- cards ----------------
SHAPE_SFX = {'circle': 'circle', 'ring': 'whoosh', 'rect': 'tick', 'tri': 'draw', 'line': 'draw', 'arrow': 'draw', 'wave': 'glide', 'grid': 'ticks4'}
for s in segs:
    if s['kind'] != 'card':
        continue
    c = CARDS[s['id']]
    t0 = s['start']
    add(swept_noise(CARD['wipe'] + 0.1, 900, 5000) * env(int((CARD['wipe'] + 0.1) * SR), 0.1, 0.15), t0, 0.06, -0.4)
    add(swept_noise(0.45, 1800, 5200), t0 + 0.1, 0.05, -0.3)
    if c.get('swell'):
        add(thump(58, 0.9), t0 + 0.22, 0.26)
        add(bell(midi(74), 1.6, 0.2), t0 + 0.24, 0.06, 0.2)
    for sh in c['shapes']:
        kind = SHAPE_SFX.get(sh['type'], 'tick')
        if kind == 'circle':
            add(thump(64, 0.8), t0 + sh['at'], 0.2)
            add(bell(midi(76), 1.4, 0.2), t0 + sh['at'], 0.05)
        else:
            sfx(kind, t0 + sh['at'], 0.45, 0.2)
    nchar = sum(len(x) for x in c['title'])
    for i in range(min(nchar, 12)):
        add(tick(2200 + 70 * i, 0.05), t0 + 0.5 + i * 0.05, 0.03, -0.4 + 0.07 * i)
    if c.get('swell'):
        ex = t0 + s['dur'] - CARD['overlap']
        d = CARD['overlap'] + 0.2
        add(swept_noise(d, 300, 3800) * env(int(d * SR), 0.5, 0.15), ex - 0.1, 0.09)
        add(thump(46, 1.4), t0 + s['dur'] - 0.12, 0.2)
    if c.get('final'):
        add(bell(midi(62), 4.0, 0.15), t0 + 0.4, 0.07)
        add(bell(midi(69), 4.0, 0.15), t0 + 0.55, 0.05)
        add(bell(midi(74), 4.0, 0.15), t0 + 0.7, 0.05)

# ---------------- shots ----------------
for s in segs:
    if s['kind'] != 'shot':
        continue
    beats = json.loads((ROOT / 'src' / 'beats' / f"{s['id']}.json").read_text())
    for name, b in beats.items():
        if 'sfx' not in b:
            continue
        ln = LINES[b['ref']]
        t0 = ln[b['edge']] + b['off']
        sfx(b['sfx'], t0, b['dur'], pan=-0.2 if 'draw' in b['sfx'] else 0.1)

# ---------------- master ----------------
st = np.stack([L, R], axis=1)[: int(DUR * SR)]
peak = np.abs(st).max()
if peak > 10 ** (-3 / 20):
    st = st / peak * 10 ** (-3 / 20)
out = ROOT / 'public' / 'audio'
out.mkdir(parents=True, exist_ok=True)
with wave.open(str(out / 'bed.wav'), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype('<i2').tobytes())
print(f'bed.wav {DUR:.2f}s peak {20 * np.log10(np.abs(st).max() + 1e-12):.1f} dBFS')
