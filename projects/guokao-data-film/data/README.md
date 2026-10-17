# VIDEO-001 数据目录

当前数据交接入口：[DATA_HANDOFF.md](../DATA_HANDOFF.md)。更新：2026-10-17。

## 当前主数据

| 路径 | 内容 | 使用方式 |
| --- | --- | --- |
| `positions_2027/` | 19,426 岗、35,691 人、27 原字段；23 个分片 | `scripts/load_positions.mjs` |
| `majors_2027/` | 全岗位专业原文、4,090 组要求、734 显式词元及候选目录引用 | `scripts/load_majors.mjs` |
| `catalogs/major_bachelor_2026_official_parsed.json` | 883 本科专业、92 类、13 门类、明确迁码关系 | 原目录节点及父子关系 |
| `catalogs/major_graduate_2022_official_parsed.json` | 117 一级学科、67 专业学位类别、14 门类 | 保留独立研究生命名空间 |
| `catalogs/major_tax_2027_official_parsed.json` | 53 税务类别、849 成员关系 | 代码/学历未提供时为空值 |
| `position_conditions_2027.json` | 原条件维度、联合分布、备注文字线索 | 同时提供职位数和计划人数 |
| `histories_2024_2027.json` | 四年五个同字段维度的招录分布 | 逐年来源、口径及输入哈希 |
| `official_historical_exam_data.json` | 官方 2024—2026 考试人数、政策合格线、计划及来源 | 保留约数、空值和指标定义 |
| `interview_cutoffs_2026/` | 20,227 岗首批公布最低面试分；18 分片 | `scripts/load_interview_cutoffs.mjs` |
| `official_2027_exam_timeline.json` | 2027 国考公告时间线 | 注意中国公告时区 |
| `official_2027_immigration_plan.json` | 29 移民管理机构计划 | 已有全国原文与官方附件子集补强 |

专业数据只解释原文提及及目录候选，不判断个人报名资格。734 词元覆盖 3,357 岗、4,599 人；另 16,069 岗没有显式词元，其完整专业原文仍在。

旧的 `majors_2027` 层（只解析专业列、只加载三个目录）显示 18,176 岗至少有一个目录候选引用、1,250 岗没有候选引用。新的 `major_evidence_2027` 层同时解析专业与备注两列、加载五份目录、加入门类归一与两处解析修正后为 18,698 / 728（1,164 人无候选），5,835 个带复核原因的岗位中有候选的从 4,593 升到 5,107。这些数字不能用作“完整解析成功率”；一个岗位可能只解析了部分表述。8 岗专业列全文明确不限，也仍须满足其他字段。

## 数据来源等级

全国岗位原字段已与官方招考简章工作簿全表逐格核验：19,426 岗、524,502 格、0 内容差异、0 工作表/行号差异。前轮招录机关附件核验（805 岗、1,501 人、21,713 格）保留为独立证据。官方工作簿核验不覆盖后续更正。

2026 面试线取全国首批镜像的公布最低线字段，另核对审计署官网 35 岗。2024—2026 职位表分布为第三方清洗文件中保留的原字段统计。各来源与哈希见对应 manifest 和 [来源核验](../research/DATA_SOURCES_AND_CHECKS.md)。

## 已保留的历史与次级文件

| 文件 | 当前地位 |
| --- | --- |
| `2027_position_derived_aggregates.json` | 早期清洗字段快照。649 词元/3,252 岗及 name_hints 已被现行专业层替代；其他边际也优先从新原表计算 |
| `major_code_namespace_audit_2027.json` | 记录旧解析器、TK 截断与学历目录混名问题的审计证据 |
| `observatory_2027_legacy_snapshot.json` | 原 HTML 28 类汇总，不是新原表官方分类 |
| `m1_hero_scene_2027.json` | 早期镜头数据试制；不是新的事实入口 |
| `annual_recruitment_2024_2027_secondary.json` | 早期第三方年度对照，现用更详实的 histories 文件 |
| `2027_registration_snapshot_20261016_secondary.json` | 固定时间的第三方报名快照，不能称实时、最终或全国逐岗全量 |
| `../content/knowledge_challenge_2027.json` | 早期内容草稿，使用前按当前事实层重新取数 |
| `../research/VALIDATION_20261017.json` | 旧数据包校验；不作为本轮逐岗位校验结果 |

[DATASET_STATUS.json](DATASET_STATUS.json) 给出机器可读的选择规则；原文件保留便于追溯。原 HTML 不修改。

## 校验

从项目根目录运行 `node scripts/verify_position_data.mjs`；加 `--write-report` 保存当前结果。各读取器检查分片哈希和完整性；整包检查原文、主外键、代码集合、目录引用、分布加总及面试线覆盖。本轮实际运行结果在 [DATA_VALIDATION_20261017_V2.json](../research/DATA_VALIDATION_20261017_V2.json)。

旧 `scripts/verify_data.mjs` 仅服务旧快照，保留其原来的验证范围。

