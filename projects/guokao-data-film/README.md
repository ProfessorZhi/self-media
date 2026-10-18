# VIDEO-001｜席位之间 · 35,691｜2027 国考数据电影

> **状态：REVIEW · V2 候选成片 / V2 源码与专业证据已合入 `main`，待发布级事实审查和实际重渲染验收**  
> **项目类型：** 基于真实国考数据的电影化可视化 / Remotion × AI Coding × Motion Design  
> **独立项目路径：** `projects/guokao-data-film/`；此项目不是整个 `self-media` 仓库的主题。

**一句话主旨：把全国 35,691 个国考计划招录名额，从宏观分布拍到一个具体岗位，最后回到数字背后的人。** 内容要有洞察，动画要有连续性，所有重要数字必须可追溯。

[完整主旨、受众和编辑红线 → PROJECT_CHARTER.md](PROJECT_CHARTER.md)

## 当前作品与版本

| 版本 | 源码锚点 | 已有作品 / 现状 |
| --- | --- | --- |
| **V1** | [`28a6667`](https://github.com/ProfessorZhi/self-media/commit/28a6667b2746ed2343637064b2cd5b358e877ec0) | 六幕、2 分 57 秒、1080p；历史版本 |
| **V2** | [`93153d9`](https://github.com/ProfessorZhi/self-media/commit/93153d97ef0a6eb001c72041f142e193cdcf100e) | 序幕 + 七幕 + 尾声、约 5 分 27 秒、4K；历史工作名《国考宇宙》 |
| **V2 工程文档** | [`dbb1060`](https://github.com/ProfessorZhi/self-media/commit/dbb106002078783c8197d2819eff44ba8b2bbc74) | 只补历史版本表 |
| **V2.1（待新 MP4 验收）** | 更名 PR 提交，合并后固定 SHA | 片尾更名《席位之间》，修复末幕章节编号 07；尚未重渲染验证 |

**当前完整代码与数据：** [主分支 `main`](https://github.com/ProfessorZhi/self-media/tree/main/projects/guokao-data-film)。历史开发来源分别为 [V2 分支 `claude/sharp-pascal-uq4ccz`](https://github.com/ProfessorZhi/self-media/tree/claude/sharp-pascal-uq4ccz) 与 [专业证据 PR #2](https://github.com/ProfessorZhi/self-media/pull/2)；两者已按项目约定集成到 `main`，历史提交继续保留为版本记录。

用户已反馈存在本地渲染的 V2 4K MP4（约 259 MB）；**影片文件不在 GitHub，且本次 GitHub 文档审核并未独立重渲或完整审片**。源码、逐幕 React 组件、Noto Sans SC 字体、数据 JSON、`package-lock.json` 和原创配乐生成器都已在 `remotion/`。完整取回与渲染命令见 [remotion/README.md](remotion/README.md)。

早期创意曾提出 **80–90 秒主片**，属历史候选，不应再冒充 V2 的现行时长；短切版可以日后作为同一项目的衍生交付。

## 最新主旨与叙事

**规模、结构、人：**

- **规模：** 过审人数、岗位数与计划名额如何不同；数万个名额点如何聚成全国。
- **结构：** 税务占比、机构与考试类别、部门变化、学历与基层要求、2026 首批进面分。
- **人：** 有出处的社会背景与明确标记的作者思考；最终锁定一个带来源行号的真实岗位。

V2 的实际顺序为**序幕 → 越来越挤 → 谁在招 → 一年巨变 → 门槛与画像 → 分数 → 冷思考 → 一个座位 → 尾声**，先呈现大尺度、再让信息归于具体。不是七张图的幻灯片，也不是向用户推销报考资格。

## 数据与证据：现已统一在 `main`，但来源等级不能混淆

| 组件 | 当前 GitHub 位置 | 必须明确的边界 |
| --- | --- | --- |
| 2027 原始岗位 | `data/positions_2027/`：19,426 岗、35,691 名额、27 字段，23 个职位分片 | 视频源版本与专业证据分支的 **23 分片 SHA-256 完全一致**；现行 `main` 已保存官方核验声明和来源指纹 |
| 全国官方核验 + 专业证据 | [已合并 PR #2](https://github.com/ProfessorZhi/self-media/pull/2) · `research/CURRENT_SNAPSHOT.json` | 官方工作簿 **524,502 单元格、0 差异**（既存实测报告）；保守目录候选 18,694、推定 5、无候选 727。源码和报告已在 `main`；本次合并后尚未在独立运行环境重跑全部检测 |
| 影片剧情事实 | `remotion/scripts/build_film_data.mjs`、`remotion/public/film_data.json` | 2027 由逐岗位原始字段算出；11 个“系统”是**部门名称正则分析分组**，不能称官方系统类别 |
| 历史/进面分数 | `data/histories_2024_2027.json`、`data/interview_cutoffs_2026/` | 2024–2026 部分统计和 2026 首批面试线取自第三方整理/镜像，分数计分口径不同 |
| 冷思考二手数据 | `data/context_2026_research.json` | 公开报道及第三方摘要，必须核原出处；观点与事实分开，不能推断具体工资、录取概率或报考资格 |

**例：** 税务按部门原始名称可复算为 11,232 岗、24,013 名额，约占全国计划名额 **67.3%**。`030101K` 在专业栏被**提及**的岗位与名额，是关键词/代码字面命中，**不是该专业实际能报考的岗位全集**。

## 文件导航

| 入口 | 职责 |
| --- | --- |
| [PROJECT_CHARTER.md](PROJECT_CHARTER.md) | 项目主旨、受众、编辑承诺、边界和完成定义（优先读） |
| [BRANDING.md](BRANDING.md) | 正式片名《席位之间》、英文题签、V1/V2 历史别名与渲染兼容约定 |
| [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) | 主分支开源状态、来源与素材授权、V2 实际重渲染及最终审片清单 |
| [remotion/README.md](remotion/README.md) | V1/V2 版本表、源码、安装与渲染命令 |
| [HIGHLIGHTS.md](HIGHLIGHTS.md) | 镜头可用统计候选；最终入镜数字须从当前来源重算 |
| [DATA_HANDOFF.md](DATA_HANDOFF.md) / [OPUS_HANDOFF.md](OPUS_HANDOFF.md) | 当前 `main` 的数据字段、来源、专业风险及制作接手入口 |
| [CREATIVE_BRIEF.md](CREATIVE_BRIEF.md) | 历史 90 秒叙事探索、美学方向与备选镜头 |
| [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) | 历史 M0–M5 制作规划及验收原则 |
| `reference/`, `content/`, `research/`, `data/` | 参考、文案、研究凭据和版本化数据；按素材许可/来源分级使用 |

## 下一阶段验收（不等于尚未制作）

当前要做的是**V2.1 发布级复核**：实际播放抽检每一幕，确认源码已修复的“冷思考 06 / 一个座位 07”在新 MP4 中正确显示、逐句校验专业代码和“官方/分析分类”文案、核实二手财经/就业数据与授权、基于现已集成的 `main` 重跑数据脚本与 4K 渲染、记录最终 MP4 与审片结果。

**不得直接改历史 V1/V2 commit，不得因为代码已推 GitHub 就宣称已公开发布，也不得绕过显式授权合并 `main`。**

## 设备与权限

本项目代码、数据、媒体处理和渲染仅应在经用户授权的 **Dell A6000** 隔离工作区进行。**不在东京服务器创建/保留此项目 Session、源码、数据缓存、工作树或视频资产；本项目不经东京 Fleet 网关执行。** GitHub 文档和 PR 审核可在这里直接完成。
