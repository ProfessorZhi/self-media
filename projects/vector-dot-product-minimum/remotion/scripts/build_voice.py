"""Build the film's voice track and global timeline from src/script.json.

Each voice line is synthesised separately with edge-tts (trial voice), edge silence is
trimmed and lines are joined with fixed gaps. Chapter cards occupy silent slots
(card.dur - card.overlap: the next shot starts under the card's exit). The measured global
start/end of every segment and line goes to src/timing.json, which drives subtitles,
scene placement, every animation beat and the sound design.

Outputs: public/voice/film.mp3 (not in git), src/timing.json.
TTS results are cached per line text in .cache/tts/ (not in git).
Network: needs speech.platform.bing.com. Behind a TLS-inspecting proxy set
EDGE_TTS_CA_BUNDLE to the proxy CA bundle.
"""
import asyncio
import hashlib
import json
import os
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = json.loads((ROOT / 'src' / 'script.json').read_text())
SR = 48_000
CACHE = ROOT / '.cache' / 'tts'

if os.environ.get('EDGE_TTS_CA_BUNDLE'):
    import certifi
    certifi.where = lambda: os.environ['EDGE_TTS_CA_BUNDLE']
import edge_tts  # noqa: E402


async def synth(text: str, out: Path) -> None:
    c = edge_tts.Communicate(text, SCRIPT['voice'], rate=SCRIPT['rate'],
                             proxy=os.environ.get('HTTPS_PROXY'))
    await c.save(str(out))


def tts_cached(text: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{SCRIPT['voice']}|{SCRIPT['rate']}|{text}".encode()).hexdigest()[:16]
    out = CACHE / f'{key}.mp3'
    if not out.exists() or out.stat().st_size == 0:
        for attempt in range(4):
            try:
                asyncio.run(synth(text, out))
                if out.stat().st_size > 0:
                    break
            except Exception as e:  # network hiccup: retry
                print(f'  retry {attempt + 1}: {e}')
    return out


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 's16le', '-ac', '1',
                          '-ar', str(SR), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


def trim(x: np.ndarray, thr=0.012, pad=0.03) -> np.ndarray:
    idx = np.flatnonzero(np.abs(x) > thr)
    if not len(idx):
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p): idx[-1] + p]


def main() -> None:
    card = SCRIPT['card']
    t = 0.0
    audio = []  # (start_s, samples)
    segments = []
    for seg in SCRIPT['segments']:
        start = t
        out = {'id': seg['id'], 'kind': seg['kind'], 'start': round(start, 3)}
        if seg['kind'] == 'card':
            dur = seg.get('dur', card['dur'])
            out['dur'] = dur
            t += dur if seg.get('final') else dur - card['overlap']
        else:
            t += SCRIPT['lead_in_s']
            lines = []
            paras = seg['paragraphs']
            for pi, para in enumerate(paras):
                for li, line in enumerate(para):
                    x = trim(decode(tts_cached(line['tts'])))
                    d = len(x) / SR
                    lines.append({'id': line['id'], 'sub': line['sub'],
                                  'start': round(t, 3), 'end': round(t + d, 3)})
                    audio.append((t, x))
                    t += d
                    last = li == len(para) - 1
                    if not (last and pi == len(paras) - 1):
                        t += SCRIPT['paragraph_gap_s'] if last else SCRIPT['line_gap_s']
            t += seg.get('tail', 1.0)
            out['lines'] = lines
            out['dur'] = round(t - start, 3)
        out['end'] = round(t, 3)
        segments.append(out)
        print(f"{seg['id']:7s} {start:7.2f} → {t:7.2f}  ({t - start:5.2f}s)")

    total = t
    y = np.zeros(int(total * SR) + SR)
    for s, x in audio:
        i = int(round(s * SR))
        y[i:i + len(x)] += x
    y = y[: int(total * SR)]
    (ROOT / 'public' / 'voice').mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1',
                    '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k',
                    str(ROOT / 'public' / 'voice' / 'film.mp3')], input=pcm, check=True)
    timing = {'voice': SCRIPT['voice'], 'card': card, 'duration': round(total, 3), 'segments': segments}
    (ROOT / 'src' / 'timing.json').write_text(json.dumps(timing, ensure_ascii=False, indent=1) + '\n')
    print(f'total {total:.2f}s  lines {sum(len(s.get("lines", [])) for s in segments)}')


if __name__ == '__main__':
    main()
