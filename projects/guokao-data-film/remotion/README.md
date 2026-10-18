# 席位之间 · 35,691｜Remotion 工程

**项目定位与 V2 数据口径：** [VIDEO-001 项目章程](../PROJECT_CHARTER.md)。这里是**本片独立的源码与渲染入口**，不是整个 `self-media` 仓库的构建系统。

## 版本

| 版本 | 提交 | 内容 | 成片 |
|---|---|---|---|
| **V1** | `28a6667` | 六幕，2 分 57 秒，1080p，初版配乐 | `npm run render`（检出该提交） |
| **V2（当前）** | `93153d9` 及之后 | 序幕 + 七幕（新增「冷思考」）+ 尾声，5 分 27 秒，4K，悲伤配乐，交叉溶解转场，税务纳入镜头巡游 | `npx remotion render GuokaoUniverse out/guokao_universe_4k.mp4 --scale=2 --audio-codec=aac` |

**按完整仓库版本回放，不要仅把 `remotion/` 目录从旧 commit 覆盖到当前数据：**

```bash
# 在本仓独立工作树或一次性检出环境中，检出完整的输入版本
git switch --detach 28a6667b2746ed2343637064b2cd5b358e877ec0   # V1
# 或：
git switch --detach 93153d97ef0a6eb001c72041f142e193cdcf100e    # V2
```

源代码与所依赖的数据必须来自兼容的提交；**V2 此后仅提交了 README 更新（`dbb1060`），没有新的视频渲染源码**。V2 4K 成片文件较大、用户反馈约 259 MB（不同编码版本可能有差异），不提交 Git。用户/执行端曾报告成功渲染，但本次文档整理没有重新实际渲染或做全片视觉 QA。

## V2 结构（当前源码）

由 `src/timeline.json` 与 `src/Film.tsx` 共同定义：**序幕 → 越来越挤 → 谁在招 → 一年巨变 → 门槛与画像 → 分数 → 冷思考 → 一个座位 → 尾声**。30fps、总长约 5:27。交叉溶解的时长由同一个时间轴文件和配乐脚本使用；个别章节的画面“06”编号尚需发布前 QA。

V2 增加 `Act7Thinking.tsx` 和 `Bookends.tsx`，其中“冷思考”的就业、财政资料有独立二手数据文件，不能混为 2027 职位表的官方原文。完整统计原字段与后续证据分支之间的关系，见 [项目章程](../PROJECT_CHARTER.md)。

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
# 从仓库根目录检出目标版本（建议用独立 worktree），再进入本工程
cd projects/guokao-data-film/remotion

npm ci                              # 使用已提交的 package-lock.json
npm run data                        # 重建已存的 film_data / cutoffs JSON
npm test                            # 与原始表重新计数核验
python3 -m pip install numpy        # 如运行环境尚未具备 NumPy；建议在受控虚拟环境执行
npm run score                       # 生成被 .gitignore 排除的 public/score.wav

npm run studio                      # 预览
npx remotion render GuokaoUniverse out/guokao_universe_4k.mp4 --scale=2 --audio-codec=aac
```

**环境依赖：** Node.js / npm、Python3 + NumPy、Chromium、FFmpeg 与适合 4K 的可用 RAM/磁盘。仓库保存 npm lockfile 及字体，但尚未容器化锁定操作系统、Python/NumPy、Chromium、FFmpeg 的完整版本；**可从源码重新渲染 ≠ 不同设备能得到字节完全相同的 MP4**。若使用本机预装 Chromium，设置 `REMOTION_BROWSER` 为实际可执行文件路径；下面历史路径只适用于当时的容器。

本容器使用预装 Chromium：`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/*/headless_shell`。

## 设计约定

- **一个点 = 一个名额**（第五幕明确切换为「一个点 = 一个岗位（2026）」）。点的身份在幕内各图形之间保持不变，计数器由画面中实际到位的点数出。
- **数据只来自 `scripts/` 生成的 JSON**；每个数字附来源字段与规则（`facts.*.source`）。
- 系统分类只依据原表「部门名称」，规则写在 `scripts/build_film_data.mjs` 的 `FAMILIES`；边检系统与国家移民管理局公告（29 个单位、1,089 人）对账一致。
- 口径红线：专业代码 / 关键词「提到」≠ 可报资格；竞争比 ≠ 录取概率；2026 进面分不与 2027 岗位混用、不跨计分口径比较；省份为第三方注记；2024–2026 历史统计为第三方清洗表。
- 动画全部由帧号确定（无随机、无实时数据），任意帧可单独渲染。
