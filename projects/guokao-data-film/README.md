# VIDEO-001 · 国考宇宙 / Guokao Data Film

**状态：数据基础已建 / 逐岗位详情、目录、条件、历年统计及 2026 逐岗位面试线已入库 / 待制作**  
**类型：** 国考知识可视化 × Cinematic Data Film × AI Coding / Remotion  
**所属仓库：** self-media（多个视频项目中的一个，不代表仓库整体主题）  
**计划主片：** 80–90 秒，16:9，1920×1080 / 30fps；后续可扩展 4K、9:16 和系列化自动生成。

## 接手入口

- [DATA_HANDOFF.md](DATA_HANDOFF.md)：数据层、加载器、岗位与专业关系、来源及适用范围。
- [OPUS_HANDOFF.md](OPUS_HANDOFF.md)：交给 Claude Code / Opus 的制作任务书。
- [data/README.md](data/README.md)：数据文件索引与复核说明。

## 当前数据

| 数据层 | 已有内容 | 入口 |
| --- | --- | --- |
| 2027 逐岗位明细 | **19,426 岗 / 35,691 个计划名额**；完整保留原表 27 字段、复合 ID、原始工作表与行号 | [岗位 manifest](data/positions_2027/manifest.json) |
| 专业原文与引用 | **734 个显式代码词元**，覆盖 **3,357 岗 / 4,599 个名额**；保存专业原文、学历上下文及目录引用 | [专业 manifest](data/majors_2027/manifest.json) |
| 本科专业目录 | 教育部 2026 年目录，**883 个本科专业** | [本科目录](data/catalogs/major_bachelor_2026_official_parsed.json) |
| 研究生学科专业目录 | 2022 年目录，**117 个一级学科、67 个专业学位类别** | [研究生目录](data/catalogs/major_graduate_2022_official_parsed.json) |
| 税务招录专业目录 | 2027 年税务招录使用的 **53 个专业类别**及其成员条目 | [税务目录](data/catalogs/major_tax_2027_official_parsed.json) |
| 岗位条件 | 学历、学位、政治面貌、基层工作年限等原字段统计及已计算的联合分布 | [条件统计](data/position_conditions_2027.json) |
| 历年招录 | 2024–2027 年全国、31 省、部门、学历、机构层级与考试类别统计 | [历史统计](data/histories_2024_2027.json) |
| 2026 逐岗位面试线 | 首批 **20,227 岗**的最低面试分数；**35 岗**已与官方附件对照 | [面试线 manifest](data/interview_cutoffs_2026/manifest.json) |

岗位详情以 `2027:六位部门代码:十二位职位代码` 标识，可通过 [load_positions.mjs](scripts/load_positions.mjs) 读取，并与 [load_majors.mjs](scripts/load_majors.mjs) 的专业原文关系联用。逐岗位来源定位和完整条件文本已经具备；代码词元出现、目录成员关系以及专业名称引用都保留各自语义，不直接输出个人报考资格结论。

## 来源与核验范围

全国 2027 主表已与**官方招考简章工作簿**完成全表逐格核验：19,426 岗、35,691 个名额、27 原字段、**524,502 个单元格，内容差异 0**，工作表与行号差异也为 0。来源 URL、哈希、工作表和行号保存在岗位数据层中，见 [OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json](research/OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json)。

此前对招录机关附件的子集核验（**805 岗、1,501 个名额、21,713 个可比较单元格**，0 内容差异）保留为独立证据，但相同字段的覆盖已由全国工作簿取代。审计记录见 [OFFICIAL_ROW_CROSSCHECK_20261017.json](research/OFFICIAL_ROW_CROSSCHECK_20261017.json)。

2024–2026 年历史招录统计使用固定哈希的第三方清洗表，并保留统计字段原文。2026 年首批面试线来自全国公开镜像，官方附件对照范围见其 [逐岗位比较记录](data/interview_cutoffs_2026/official-audit-comparison.json)；最低面试分数按发布口径保留，不当作实际面试成绩或全国统一合格线。

## 项目定位与文档

让一份国考招录数据从 35,691 个微小的名额点，演变为可探索、会响应、可连续变形的数据宇宙。既讲清招录结构，也展示程序化动画与 AI Coding 的审美、技术水平。

| 文件 | 用途 |
| --- | --- |
| [CREATIVE_BRIEF.md](CREATIVE_BRIEF.md) | 创作意图、叙事与镜头方向 |
| [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) | 里程碑、交付物与验收 |
| [research/VIDEO_READINESS_AUDIT_20261018.md](research/VIDEO_READINESS_AUDIT_20261018.md) | 首片当前可引用数字、场景数据来源与实际制作缺口 |
| [research/DATA_SOURCES_AND_CHECKS.md](research/DATA_SOURCES_AND_CHECKS.md) | 数据来源和核验记录 |
| [research/MAJOR_CODE_MATCHING.md](research/MAJOR_CODE_MATCHING.md) | 专业目录与原文关系的处理规则 |
| [content/knowledge_challenge_2027.json](content/knowledge_challenge_2027.json) | 已归档的程序化知识挑战内容 |
| [reference/2027国考_招录观测台_交互修复完整版.html](reference/2027国考_招录观测台_交互修复完整版.html) | 用户提供的完整离线参考 HTML，原样保留 |

## 原始 HTML 的位置

参考 HTML 是此前会话形成的系统级汇总快照，包含 28 个系统及归集类别，以及旭日图、树图、点阵、排名、散点和筛选交互。HTML 本身没有逐岗位、专业、地区或学历明细；本次新增的完整岗位层独立存放于 `data/`。参考文件继续保持原样，其旧分类与第三方系统分析标签分别保留来源。

**数据基础已建；尚未建立 Remotion 工程，也未渲染或交付成片。**

