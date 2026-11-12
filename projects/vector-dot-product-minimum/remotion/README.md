# VIDEO-002 · Remotion 工程（完整片 v1）

**状态：REVIEW 候选 · 完整片 v1（2026-11-12）**。完整片约 4 分 11 秒，16:9 1080p。配音是试用 TTS；还没有正式发布。

## 渲染记录

| 版本 | 文件 | 规格 | SHA-256 |
| --- | --- | --- | --- |
| v1（源码 `85cdfd7`） | `video002_vector_minimum_master.mp4`，23,959,683 字节 | 1920×1080 · 30fps · 4:11.5 · H.264 + AAC · −16.4 LUFS | `63c02ea5a9ce33e1995e3c5d036e2400c019e0dbdb8a17902bb7814c52b3a05a` |

成片不进 git。计划作为 GitHub Release 附件交付（待上传）。

## 结构

章节顺序与 [`latex/analysis.tex`](../latex/analysis.tex) 的六种解法编号一一对应。

| 时间 | 段落 | 内容 |
| --- | --- | --- |
| 0:00–0:21 | 开场 | 题目逐条成形；硬算向量被打叉；六种解法计数，收束成“投影”两个字 |
| 0:21 | 片头卡 | 包豪斯构成：一道向量最值题，藏着多少种解法？ |
| 0:26–0:43 | 01 点积 → 投影 | 坐标摆放、有向投影、`AD·AB = 2x_D`；D 沿合法弧向左滑，答案暂不揭晓 |
| 0:46–1:25 | 02 解法一 · 面积 | 余弦定理 + 基本不等式得 ab ≤ 4；面积算两遍得 h ≤ 1；D 滑到等号点，揭晓 −2，并验证 a = b = 2 |
| 1:28–2:03 | 03 解法二 · 直径圆 | 先限定 D、B 异侧；60° + 120° = 180°，四点共圆；BC 为直径，R = 2；最左点 x = −1 |
| 2:06–2:27 | 04 解法三 · 外接圆 | R = AC/(2 sin120°) = 2；OM = 1；最远距离 R − OM = 1 |
| 2:29–2:57 | 05 解法四 · 三角函数 | 图形和 θ 函数图由同一个 θ 驱动；2 − 4cos(2θ − 60°) 在 θ = 30° 取到 −2 |
| 3:00–3:30 | 06 解法五、六 | 坐标法让圆方程“冒出来”，得 x ≥ −1；向量配方中 \|z\| = 2，z 旋转，柯西不等式给出 ≥ −2 |
| 3:33–4:07 | 07 一个本质 | 六宫格：四种解法亮金（圆），两种亮红（投影），合并成一张图；凸性提醒（同侧反例 D′）；答案 −2，选 D |
| 4:07 | 片尾卡 | 最小值 −2 · 选 D |

## 风格组合

| 层 | 风格 | 参考 |
| --- | --- | --- |
| 正片镜头 | 暗场发光线条、一笔画、移动的亮点笔头 | mg-styles-15 `线条动画` |
| 章节卡 | 包豪斯几何构成，每章一套贴合内容的图形（`src/cards.json`）；入场是带黑色前沿的擦除 | mg-styles-15 `几何构成 · 包豪斯` |
| 转场 / 公式 | 红圆膨胀后冷却成夜色；公式系数模糊形变 | mg-styles-15 `形变动画` |
| 方法 | 字幕句边界即时间锚点；一个节拍只有一个主角；字幕整句硬现、不加标点；极缓推镜；关键结论加金框 | video-talkcraft / anything2explainer 的规则 |

上游 skill 只借鉴方法和风格，**没有复制它们的代码或素材**（talkcraft 与 explainer 是非商用许可）。

## 单一事实来源

- `src/lib/geometry.js`：精确几何。D 只能落在合法弧上（越界会抛错）；三角法的参数化 `dFromTheta` 与圆一致。
- `src/script.json`：全片口播与字幕。`scripts/build_voice.py` 逐句合成配音，把实测时间写进 `src/timing.json`（各段起止和每句起止）。
- `src/beats/<镜头>.json`：每个动画节拍锚定到某一句口播，并标注音效类型。画面（`useScene`）和声音（`scripts/compose_audio.py`）读的是同一份文件。
- `src/cards.json`：章节卡的图形、入场时间和膨胀圆。音频按同一份文件给每个图形配上击打声。
- `npm test` 检查：整段合法弧上 ∠ADC = 120°（误差 < 1e-11°）、三角参数化与恒等式、等号点、第 01 镜不提前泄露答案，以及 132 个节拍都落在自己镜头的时间内。

## 复现

```bash
npm ci
pip install edge-tts numpy
EDGE_TTS_CA_BUNDLE=/path/to/proxy-ca.crt npm run voice   # 不在代理后面时省略这个变量；TTS 结果缓存在 .cache/tts/
npm run audio      # NumPy 程序化配乐和音效 → public/audio/bed.wav
npm test
REMOTION_BROWSER=/path/to/chrome-headless-shell npm run render   # 1080p + 响度母带（-16 LUFS）
npm run preview    # 半分辨率无声预览，用来快速审片
```

输出文件 `out/video002_vector_minimum_master.mp4` 不进 git。配音、bed.wav 和 TTS 缓存也不进 git。

## 改稿流程

改口播只需要改 `src/script.json`，然后依次运行 `npm run voice`、`npm run audio`、`npm run render`。所有画面和音效都锚定在句子上，会自动重新对齐。换成真人录音时，把 `build_voice.py` 的合成部分换成逐句切好的录音文件即可。

## 已知局限

- 配音是试用 TTS（edge-tts，`zh-CN-YunxiNeural`），正式版建议真人录音或换用已确认授权的 TTS。
- 只做了 16:9 主版，9:16 竖版还没做。
