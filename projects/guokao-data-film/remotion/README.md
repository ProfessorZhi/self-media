# 国考宇宙 · Remotion 工程

## 版本

| 版本 | 提交 | 内容 | 成片 |
|---|---|---|---|
| **V1** | `28a6667` | 六幕，2 分 57 秒，1080p，初版配乐 | `npm run render`（检出该提交） |
| **V2（当前）** | `93153d9` 及之后 | 序幕 + 七幕（新增「冷思考」）+ 尾声，5 分 27 秒，4K，悲伤配乐，交叉溶解转场，税务纳入镜头巡游 | `npx remotion render GuokaoUniverse out/guokao_universe_4k.mp4 --scale=2 --audio-codec=aac` |

取回某个版本：`git checkout 28a6667 -- projects/guokao-data-film/remotion`（V1）。成片视频体积大（V2 4K 约 270–600 MB），不提交 Git。

## V1 结构（历史）

全片约 2 分 57 秒（5,306 帧，1920×1080，30fps），六幕：

| 幕 | 合成 | 帧数 | 内容 |
|---|---|---:|---|
| 一 越来越挤 | `Act1-Crowded` | 780 | 1 个名额 vs 约 98 名过审者 → 剪刀差（过审人数 ↑ / 计划名额 ↓）→ 2027 年 35,691 点阵 |
| 二 谁在招 | `Act2-WhoHires` | 1,016 | 机构层级旭日图（按 11 个系统着色）→ 系统树图 → 巡游海关 / 金融监管 / 边检 / 中央及其他 → 589 个部门的帕累托曲线 |
| 三 一年巨变 | `Act3-Change` | 960 | 部门涨跌哑铃图 → 四年层级指数 → 31 地区涨跌方块图 |
| 四 门槛与画像 | `Act4-Profile` | 1,050 | 粒子桑基（学历→政治面貌→基层经历）→ 岗位大小分组 → 粒子拼出专业热词 |
| 五 分数 | `Act5-Scores` | 780 | 2026 年 17,377 岗进面分点阵直方图、中位数、最高 153.7 / 最低 90.1；2,850 岗不同口径单列 |
| 六 一个座位 | `Act6-OneSeat` | 720 | 输入 030101K → 信号点亮 329 岗 / 399 名额 → 推近一个点，展开原表一行 → 收尾 |

完整影片：`GuokaoUniverse`（`src/Film.tsx`），含原创合成配乐。

## 复现

```bash
npm install
npm run data      # 从已哈希校验的职位表、面试线等生成 public/film_data.json 与 public/cutoffs_2026.json
npm run score     # 生成原创配乐 public/score.wav（numpy 合成，无采样、无第三方音频）
npx remotion studio                       # 预览
npx remotion render GuokaoUniverse out/guokao_universe.mp4 --audio-codec=aac
```

本容器使用预装 Chromium：`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/*/headless_shell`。

## 设计约定

- **一个点 = 一个名额**（第五幕明确切换为「一个点 = 一个岗位（2026）」）。点的身份在幕内各图形之间保持不变，计数器由画面中实际到位的点数出。
- **数据只来自 `scripts/` 生成的 JSON**；每个数字附来源字段与规则（`facts.*.source`）。
- 系统分类只依据原表「部门名称」，规则写在 `scripts/build_film_data.mjs` 的 `FAMILIES`；边检系统与国家移民管理局公告（29 个单位、1,089 人）对账一致。
- 口径红线：专业代码 / 关键词「提到」≠ 可报资格；竞争比 ≠ 录取概率；2026 进面分不与 2027 岗位混用、不跨计分口径比较；省份为第三方注记；2024–2026 历史统计为第三方清洗表。
- 动画全部由帧号确定（无随机、无实时数据），任意帧可单独渲染。
