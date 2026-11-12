"""Build the shot-01 voiceover and its timing table.

Each line of src/voice_script.json is synthesised separately with edge-tts (trial voice:
zh-CN-YunxiNeural), edge silence is trimmed, and lines are joined with fixed gaps. The
measured start/end of every line is written to src/timing.json, which drives subtitles and
every animation anchor in the shot. Output audio: public/voice/shot01.mp3 (not in git).

Network: needs speech.platform.bing.com. Behind a TLS-inspecting proxy set
EDGE_TTS_CA_BUNDLE to the proxy CA bundle.
"""
import asyncio
import json
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = json.loads((ROOT / 'src' / 'voice_script.json').read_text())
SR = 48_000

if os.environ.get('EDGE_TTS_CA_BUNDLE'):
    import certifi
    certifi.where = lambda: os.environ['EDGE_TTS_CA_BUNDLE']
import edge_tts  # noqa: E402


async def synth(text: str, out: Path) -> None:
    c = edge_tts.Communicate(text, SCRIPT['voice'], rate=SCRIPT['rate'],
                             proxy=os.environ.get('HTTPS_PROXY'))
    await c.save(str(out))


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
    out_dir = ROOT / 'public' / 'voice'
    out_dir.mkdir(parents=True, exist_ok=True)
    parts, lines = [np.zeros(int(SCRIPT['lead_in_s'] * SR))], []
    t = SCRIPT['lead_in_s']
    with tempfile.TemporaryDirectory() as tmp:
        paras = SCRIPT['paragraphs']
        for pi, para in enumerate(paras):
            for li, line in enumerate(para):
                mp3 = Path(tmp) / f"{line['id']}.mp3"
                asyncio.run(synth(line['tts'], mp3))
                x = trim(decode(mp3))
                dur = len(x) / SR
                lines.append({'id': line['id'], 'sub': line['sub'],
                              'start': round(t, 3), 'end': round(t + dur, 3)})
                parts.append(x)
                t += dur
                last = li == len(para) - 1
                if not (last and pi == len(paras) - 1):
                    gap = SCRIPT['paragraph_gap_s'] if last else SCRIPT['line_gap_s']
                    parts.append(np.zeros(int(gap * SR)))
                    t += gap
    parts.append(np.zeros(int(0.4 * SR)))
    y = np.concatenate(parts)
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1',
                    '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k',
                    str(out_dir / 'shot01.mp3')], input=pcm, check=True)
    timing = {'voice': SCRIPT['voice'], 'duration': round(len(y) / SR, 3), 'lines': lines}
    (ROOT / 'src' / 'timing.json').write_text(json.dumps(timing, ensure_ascii=False, indent=2) + '\n')
    for ln in lines:
        print(f"{ln['start']:6.2f}–{ln['end']:6.2f}  {ln['sub']}")
    print(f"total {timing['duration']:.2f}s")


if __name__ == '__main__':
    main()
