"""Find abrupt visual jumps in a rendered film.

Decodes the video at low resolution, measures the mean absolute difference between
consecutive frames, and reports frames whose change is far above the local median —
hard cuts, pops and flicker that a smooth film should not have.
Usage: python3 scripts/find_jumps.py out/preview_540.mp4
"""
import subprocess
import sys

import numpy as np

path = sys.argv[1]
W, H = 192, 108
raw = subprocess.run(
    ['ffmpeg', '-loglevel', 'error', '-i', path, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'],
    capture_output=True,
    check=True,
).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))  # d[i] = change from frame i to i+1
n = len(d)
win = 15
flags = []
for i in range(n):
    lo, hi = max(0, i - win), min(n, i + win + 1)
    neigh = np.concatenate([d[lo:i], d[i + 1 : hi]])
    base = np.median(neigh) if len(neigh) else 0
    if d[i] > 1.0 and d[i] > 4 * base + 0.5:
        flags.append((i + 1, d[i], base))
print(f'{len(frames)} frames · mean change {d.mean():.2f} · max {d.max():.2f} at frame {int(d.argmax()) + 1}')
for f, v, b in flags:
    print(f'jump at frame {f:5d} ({f / 30:6.2f}s): change {v:5.2f} vs local median {b:4.2f}')
if not flags:
    print('no abrupt jumps found')
