# VIDEO-002 · Remotion 工程（镜头 01 试片）

**状态：BUILDING · 试片 v0.1（2026-11-12）**。只有第 1 镜「点积 → 投影」（分镜 00:20–00:45）加上包豪斯章节卡，不是成片。

## 风格组合

| 层 | 风格 | 参考 |
| --- | --- | --- |
| 正片镜头 | 暗场发光线条、一笔画、移动的亮点笔头 | mg-styles-15 `线条动画` |
| 章节卡 | 包豪斯几何构成：黄色直角三角形对应 ABC、蓝方块对应直角、红圆对应后面要用的圆、黑线对应直径 BC | mg-styles-15 `几何构成 · 包豪斯` |
| 转场 / 公式 | 红圆膨胀后冷却成夜色；系数 `|AB|·` 模糊形变为 `2` | mg-styles-15 `形变动画` |
| 方法 | 字幕句边界即时间锚点；一个节拍只有一个主角；字幕整句硬现、不加标点；极缓推镜 1.00→1.06；静止不超过 3 秒 | video-talkcraft / anything2explainer 的规则 |

上游 skill 只借鉴方法和风格，**没有复制它们的代码或素材**（talkcraft 与 explainer 是非商用许可）。

## 单一事实来源

- `src/lib/geometry.js`：精确几何。D 只能落在合法弧上（圆心 O(1,√3)、半径 2、弧角 120°–240°），越界会直接抛错。
- `src/voice_script.json` → `scripts/build_voice.py` → `src/timing.json`：逐句配音，并记录实测起止时间。
- `src/beats.json`：每个动画节拍都锚定到某一句配音。画面（`src/lib/beats.ts`）和音频（`scripts/compose_audio.py`）读的是同一张表。

## 复现

```bash
npm ci
EDGE_TTS_CA_BUNDLE=/path/to/proxy-ca.crt npm run voice   # 需要 pip install edge-tts；不在代理后面时省略这个变量
npm run audio      # NumPy 程序化配乐和音效 → public/audio/bed.wav
npm test           # 几何与节拍检查
REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render:trial   # 渲染 + 响度母带（-16 LUFS）
```

输出文件 `out/video002_shot01_trial_master.mp4` 不进 git。配音 mp3 和 bed.wav 也不进 git，由上面的命令重新生成。

## 已知局限

- 配音是试用 TTS（edge-tts，`zh-CN-YunxiNeural`），只用来确定节奏。正式版建议真人录音或换用已确认授权的 TTS；换配音后重跑 `npm run voice`，全片会自动重新对齐。
- 只做了 16:9 1080p，竖版还没做。
